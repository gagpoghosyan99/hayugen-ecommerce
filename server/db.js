const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { sha256 } = require("./passwords");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'customer',
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL,
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_lines (
  id INTEGER PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (owner_type, owner_id, variant_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  user_id TEXT,
  email TEXT NOT NULL,
  ship_json TEXT NOT NULL,
  pay_json TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  shipping_method TEXT NOT NULL DEFAULT '',
  tracking TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  postal TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  created TEXT NOT NULL,
  PRIMARY KEY (user_id, handle)
);

CREATE TABLE IF NOT EXISTS resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires INTEGER NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires INTEGER NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  body TEXT NOT NULL,
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
  variant_id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  quantity INTEGER
);

CREATE TABLE IF NOT EXISTS rewards_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_public INTEGER NOT NULL DEFAULT 0,
  points_per_order INTEGER NOT NULL DEFAULT 0,
  min_redeem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rewards_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS rewards_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created TEXT NOT NULL
);
`;

function openDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const has = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get("001_init");
  if (!has) db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run("001_init");
  const config = db.prepare("SELECT id FROM rewards_config WHERE id = 1").get();
  if (!config) db.prepare("INSERT INTO rewards_config (id, is_public, points_per_order, min_redeem) VALUES (1, 0, 0, 0)").run();
  return db;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

function payRecord(pay) {
  if (pay && typeof pay === "object") return pay;
  return { method: String(pay || "recorded") };
}

function importStore(db, jsonPath) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count > 0 || !jsonPath || !fs.existsSync(jsonPath)) return false;
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, first_name, last_name, phone, password_hash, password_algo, email_verified, role, created)
    VALUES (@id, @email, @first_name, @last_name, '', @password_hash, 'scrypt', 1, 'customer', @created)
  `);
  const insertSession = db.prepare(`
    INSERT INTO sessions (id, token_hash, user_id, expires, created)
    VALUES (@id, @token_hash, @user_id, @expires, @created)
  `);
  const insertLine = db.prepare(`
    INSERT INTO cart_lines (owner_type, owner_id, variant_id, handle, quantity)
    VALUES (@owner_type, @owner_id, @variant_id, @handle, @quantity)
    ON CONFLICT(owner_type, owner_id, variant_id) DO UPDATE SET quantity = quantity + excluded.quantity
  `);
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, ref, user_id, email, ship_json, pay_json, items_json, total, status, payment_status, shipping_method, tracking, created)
    VALUES (@id, @ref, @user_id, @email, @ship_json, @pay_json, @items_json, @total, @status, 'recorded', '', '', @created)
  `);
  const insertReset = db.prepare(`
    INSERT INTO resets (id, user_id, token_hash, expires, used_at)
    VALUES (@id, @user_id, @token_hash, @expires, NULL)
  `);
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, name, email, body, created) VALUES (@id, @name, @email, @body, @created)
  `);

  const sessionUser = new Map((raw.sessions || []).map((session) => [session.id, session.userId]));
  const userByEmail = new Map((raw.users || []).map((user) => [String(user.email || "").trim().toLowerCase(), user.id]));

  const tx = db.transaction(() => {
    for (const user of raw.users || []) {
      const names = splitName(user.name);
      insertUser.run({
        id: user.id,
        email: String(user.email || "").trim().toLowerCase(),
        first_name: names.first,
        last_name: names.last,
        password_hash: user.password,
        created: user.created || new Date().toISOString(),
      });
    }
    for (const session of raw.sessions || []) {
      if (!session.userId || !session.token) continue;
      insertSession.run({
        id: session.id,
        token_hash: sha256(session.token),
        user_id: session.userId,
        expires: Number(session.expires) || 0,
        created: new Date().toISOString(),
      });
    }
    for (const [key, lines] of Object.entries(raw.carts || {})) {
      if (key === "anon") continue;
      const userId = sessionUser.get(key);
      const ownerType = userId ? "user" : "guest";
      const ownerId = userId || key;
      for (const line of lines || []) {
        if (!line || !line.variantId || !line.handle || !line.quantity) continue;
        insertLine.run({
          owner_type: ownerType,
          owner_id: ownerId,
          variant_id: String(line.variantId),
          handle: line.handle,
          quantity: Number(line.quantity),
        });
      }
    }
    for (const order of raw.orders || []) {
      insertOrder.run({
        id: order.id,
        ref: order.ref,
        user_id: order.userId || null,
        email: String(order.email || "").trim().toLowerCase(),
        ship_json: JSON.stringify(order.ship || {}),
        pay_json: JSON.stringify(payRecord(order.pay)),
        items_json: JSON.stringify(order.items || []),
        total: Number(order.total) || 0,
        status: order.status || "confirmed",
        created: order.created || new Date().toISOString(),
      });
    }
    for (const reset of raw.resets || []) {
      const userId = userByEmail.get(String(reset.email || "").trim().toLowerCase());
      if (!userId || !reset.token) continue;
      insertReset.run({
        id: require("crypto").randomUUID(),
        user_id: userId,
        token_hash: sha256(reset.token),
        expires: Number(reset.expires) || 0,
      });
    }
    for (const message of raw.messages || []) {
      insertMessage.run(message);
    }
  });
  tx();
  return true;
}

function backupJson(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) return null;
  const dir = path.join(path.dirname(jsonPath), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(dir, `store-${stamp}.json`);
  fs.copyFileSync(jsonPath, dest);
  return dest;
}

module.exports = { openDatabase, importStore, backupJson, splitName };
