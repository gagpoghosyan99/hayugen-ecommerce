const express = require("express");
const crypto = require("crypto");
const path = require("path");
const rateLimit = require("express-rate-limit");
const catalog = require("../preview/js/catalog.js");
const { openDatabase, importStore, backupJson, splitName } = require("./db");
const { sha256, verifyPassword, hashPassword } = require("./passwords");

const SESSION_DAYS = 7;
const RESET_MS = 30 * 60 * 1000;
const SHIPPING = [{ id: "yerevan", label: "Yerevan courier", price: 0 }];
const CARD_FIELDS = ["ccnumber", "cccsc", "ccexp", "ccname", "pan", "cvc", "cvv", "cardnumber"];

function createApp(options = {}) {
  const root = path.join(__dirname, "..");
  const dataDir = path.join(root, "data");
  const dbPath = options.dbPath || path.join(dataDir, "maison.sqlite");
  const jsonPath = options.jsonPath === undefined ? path.join(dataDir, "store.json") : options.jsonPath;
  const db = openDatabase(dbPath);
  if (options.importJson !== false && jsonPath) {
    const empty = db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0;
    if (empty && require("fs").existsSync(jsonPath)) {
      if (options.backup !== false) backupJson(jsonPath);
      importStore(db, jsonPath);
    }
  }
  promoteAdmin(db);
  seedStock(db);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.locals.db = db;
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(ensureCsrf);
  app.use(loadSession);

  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.authLimit ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Wait a few minutes." },
  });
  if (options.authLimit !== 0) {
    app.use("/api/register", authLimit);
    app.use("/api/login", authLimit);
    app.use("/api/forgot", authLimit);
    app.use("/api/reset", authLimit);
  }

  app.get("/api/me", (req, res) => {
    const owner = bagOwner(req, res);
    const count = cartCount(owner);
    res.json({
      user: publicUser(req.user),
      cartCount: count,
      mail: false,
      rewardsPublic: rewardsConfig().is_public === 1,
    });
  });

  app.get("/api/shipping", (_req, res) => {
    res.json(SHIPPING);
  });

  app.post("/api/register", asyncRoute(async (req, res) => {
    requireCsrf(req);
    const body = req.body || {};
    const names = registrationNames(body);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const confirm = String(body.confirmPassword || body.confirm || "");
    const phone = String(body.phone || "").trim().slice(0, 40);
    if (!names.first || names.first.length > 80 || names.last.length > 80) {
      return fail(400, "Enter your first and last name.");
    }
    if (!validEmail(email)) return fail(400, "Enter a valid email.");
    if (password.length < 8 || password.length > 200) return fail(400, "Use at least 8 characters.");
    if (confirm !== password) return fail(400, "The passwords do not match.");
    if (!body.privacy) return fail(400, "The privacy notice must be accepted.");

    const passwordHash = await hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      email,
      first_name: names.first,
      last_name: names.last,
      phone,
      password_hash: passwordHash,
      password_algo: "argon2id",
      email_verified: 0,
      role: "customer",
      created: new Date().toISOString(),
    };
    const session = newSession(user.id);
    const guest = readGuest(req);
    try {
      db.transaction(() => {
        db.prepare(`
          INSERT INTO users (id, email, first_name, last_name, phone, password_hash, password_algo, email_verified, role, created)
          VALUES (@id, @email, @first_name, @last_name, @phone, @password_hash, @password_algo, @email_verified, @role, @created)
        `).run(user);
        db.prepare(`
          INSERT INTO sessions (id, token_hash, user_id, expires, created)
          VALUES (@id, @token_hash, @user_id, @expires, @created)
        `).run(session.row);
        rememberVerification(user.id, email);
        if (guest) mergeBag("guest", guest, "user", user.id);
      })();
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return fail(409, "That email already has a file.");
      throw error;
    }
    setCookie(res, req, "hayugen_session", session.token, SESSION_DAYS * 86400);
    res.status(201).json({ user: publicUser(user) });
  }));

  app.post("/api/login", asyncRoute(async (req, res) => {
    requireCsrf(req);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    const ok = user && await verifyPassword(password, user.password_hash, user.password_algo);
    if (!ok) return fail(401, "Email or password is not right.");
    if (user.password_algo !== "argon2id") {
      const nextHash = await hashPassword(password);
      db.prepare("UPDATE users SET password_hash = ?, password_algo = 'argon2id' WHERE id = ?").run(nextHash, user.id);
      user.password_algo = "argon2id";
    }
    const session = newSession(user.id);
    const guest = readGuest(req);
    db.transaction(() => {
      db.prepare(`
        INSERT INTO sessions (id, token_hash, user_id, expires, created)
        VALUES (@id, @token_hash, @user_id, @expires, @created)
      `).run(session.row);
      if (guest) mergeBag("guest", guest, "user", user.id);
    })();
    setCookie(res, req, "hayugen_session", session.token, SESSION_DAYS * 86400);
    res.json({ user: publicUser(user) });
  }));

  app.post("/api/logout", (req, res) => {
    requireCsrf(req);
    if (req.session) db.prepare("DELETE FROM sessions WHERE id = ?").run(req.session.id);
    clearCookie(res, req, "hayugen_session");
    res.json({ ok: true });
  });

  app.post("/api/forgot", (req, res) => {
    requireCsrf(req);
    const email = normalizeEmail(req.body?.email);
    const user = validEmail(email) ? db.prepare("SELECT id FROM users WHERE email = ?").get(email) : null;
    if (user) {
      const token = crypto.randomBytes(24).toString("hex");
      db.prepare(`
        INSERT INTO resets (id, user_id, token_hash, expires, used_at)
        VALUES (?, ?, ?, ?, NULL)
      `).run(crypto.randomUUID(), user.id, sha256(token), Date.now() + RESET_MS);
    }
    res.json({
      ok: true,
      mail: false,
      message: "Mail is not connected, so nothing was sent. The house does not say whether this email is on file.",
    });
  });

  app.post("/api/reset", asyncRoute(async (req, res) => {
    requireCsrf(req);
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    const confirm = String(req.body?.confirmPassword || req.body?.confirm || "");
    if (password.length < 8 || password.length > 200) return fail(400, "Use at least 8 characters.");
    if (confirm !== password) return fail(400, "The passwords do not match.");
    const row = db.prepare("SELECT * FROM resets WHERE token_hash = ?").get(sha256(token));
    if (!row || row.used_at || row.expires < Date.now()) return fail(400, "This reset link is not valid.");
    const passwordHash = await hashPassword(password);
    db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ?, password_algo = 'argon2id' WHERE id = ?").run(passwordHash, row.user_id);
      db.prepare("UPDATE resets SET used_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
    })();
    res.json({ ok: true });
  }));

  app.get("/api/catalog", (req, res) => {
    const cat = String(req.query.cat || "");
    const q = String(req.query.q || "").trim().toLowerCase();
    let items = catalog.slice();
    if (cat) items = items.filter((item) => item.category === cat);
    if (q) {
      items = items.filter((item) =>
        `${item.title} ${item.line} ${item.color} ${item.print} ${item.material}`.toLowerCase().includes(q)
      );
    }
    res.json(items);
  });

  app.get("/api/products/:handle", (req, res) => {
    const product = productByHandle(req.params.handle);
    if (!product) return fail(404, "This piece is not in the salon.");
    res.json(product);
  });

  app.get("/api/cart", (req, res) => {
    const owner = bagOwner(req, res);
    res.json(presentCart(owner));
  });

  app.post("/api/cart", (req, res) => {
    requireCsrf(req);
    const handle = String(req.body?.handle || "");
    const variantId = String(req.body?.variantId || "");
    const quantity = Math.min(20, Math.max(1, Number(req.body?.quantity) || 1));
    const priced = priceLine(handle, variantId);
    if (!priced) return fail(400, "This piece cannot be added.");
    const owner = bagOwner(req, res);
    const stock = db.prepare("SELECT quantity FROM stock WHERE variant_id = ?").get(variantId);
    const existing = db.prepare(`
      SELECT quantity FROM cart_lines WHERE owner_type = ? AND owner_id = ? AND variant_id = ?
    `).get(owner.type, owner.id, variantId);
    const nextQty = Math.min(20, (existing?.quantity || 0) + quantity);
    if (stock && stock.quantity != null && nextQty > stock.quantity) {
      return fail(400, "There are not enough of this piece.");
    }
    db.prepare(`
      INSERT INTO cart_lines (owner_type, owner_id, variant_id, handle, quantity)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_type, owner_id, variant_id) DO UPDATE SET quantity = excluded.quantity
    `).run(owner.type, owner.id, variantId, handle, nextQty);
    res.status(201).json({ ok: true, cart: presentCart(owner) });
  });

  app.patch("/api/cart/:variantId", (req, res) => {
    requireCsrf(req);
    const quantity = Math.min(20, Math.max(0, Number(req.body?.quantity) || 0));
    const variantId = String(req.params.variantId);
    const owner = bagOwner(req, res);
    if (quantity === 0) {
      db.prepare("DELETE FROM cart_lines WHERE owner_type = ? AND owner_id = ? AND variant_id = ?")
        .run(owner.type, owner.id, variantId);
    } else {
      const line = db.prepare(`
        SELECT handle FROM cart_lines WHERE owner_type = ? AND owner_id = ? AND variant_id = ?
      `).get(owner.type, owner.id, variantId);
      if (!line || !priceLine(line.handle, variantId)) return fail(400, "This piece cannot be updated.");
      const stock = db.prepare("SELECT quantity FROM stock WHERE variant_id = ?").get(variantId);
      if (stock && stock.quantity != null && quantity > stock.quantity) {
        return fail(400, "There are not enough of this piece.");
      }
      db.prepare(`
        UPDATE cart_lines SET quantity = ? WHERE owner_type = ? AND owner_id = ? AND variant_id = ?
      `).run(quantity, owner.type, owner.id, variantId);
    }
    res.json({ ok: true, cart: presentCart(owner) });
  });

  app.delete("/api/cart/:variantId", (req, res) => {
    requireCsrf(req);
    const owner = bagOwner(req, res);
    db.prepare("DELETE FROM cart_lines WHERE owner_type = ? AND owner_id = ? AND variant_id = ?")
      .run(owner.type, owner.id, String(req.params.variantId));
    res.json({ ok: true, cart: presentCart(owner) });
  });

  app.get("/api/orders", (req, res) => {
    if (!req.user) return fail(401, "Sign in to continue.");
    res.json(listOrders(req.user));
  });

  app.get("/api/orders/:id", (req, res) => {
    if (!req.user) return fail(401, "Sign in to continue.");
    const order = findOrder(req.params.id);
    if (!order || !ownsOrder(order, req.user)) return fail(404, "That order is not on this file.");
    res.json(publicOrder(order));
  });

  app.post("/api/orders", (req, res) => {
    requireCsrf(req);
    if (Object.keys(req.body || {}).some((key) => CARD_FIELDS.includes(String(key).toLowerCase().replace(/[^a-z0-9]/g, "")))) {
      return fail(400, "Full card details are not accepted by the house.");
    }
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email || req.user?.email);
    const phone = String(req.body?.phone || "").trim().slice(0, 40);
    const address = String(req.body?.address || "").trim();
    const city = String(req.body?.city || "").trim();
    const postal = String(req.body?.postal || "").trim();
    const country = String(req.body?.country || "").trim();
    const pay = String(req.body?.pay || "");
    const shipping = SHIPPING.find((item) => item.id === String(req.body?.shipping || "yerevan")) || SHIPPING[0];
    if (!name || !validEmail(email) || !address || !city || !country) return fail(400, "Dispatch details are incomplete.");
    if (!["transfer", "account"].includes(pay)) {
      return fail(400, "Card charging is not connected. Choose transfer or account.");
    }
    if (pay === "account" && !req.user) return fail(400, "Sign in to place this on the account.");
    const idem = String(req.get("Idempotency-Key") || "").trim().slice(0, 80);
    if (idem) {
      const prior = db.prepare("SELECT * FROM orders WHERE idempotency_key = ?").get(idem);
      if (prior) return res.status(200).json(orderResponse(prior));
    }
    const owner = bagOwner(req, res);
    try {
      const created = db.transaction(() => {
        const lines = db.prepare(`
          SELECT * FROM cart_lines WHERE owner_type = ? AND owner_id = ?
        `).all(owner.type, owner.id);
        if (!lines.length) return fail(400, "The bag is empty.");
        const items = [];
        for (const line of lines) {
          const priced = priceLine(line.handle, line.variant_id);
          if (!priced) return fail(400, "A piece in the bag is no longer available.");
          const stock = db.prepare("SELECT quantity FROM stock WHERE variant_id = ?").get(line.variant_id);
          if (stock && stock.quantity != null && stock.quantity < line.quantity) {
            return fail(400, "There are not enough of a piece in the bag.");
          }
          if (stock && stock.quantity != null) {
            const changed = db.prepare(`
              UPDATE stock SET quantity = quantity - ? WHERE variant_id = ? AND quantity >= ?
            `).run(line.quantity, line.variant_id, line.quantity);
            if (changed.changes !== 1) return fail(400, "There are not enough of a piece in the bag.");
          }
          items.push({
            variantId: line.variant_id,
            handle: line.handle,
            quantity: line.quantity,
            title: priced.product.title,
            price: priced.price,
            lineTotal: priced.price * line.quantity,
            detail: priced.detail,
          });
        }
        const goods = items.reduce((sum, line) => sum + line.lineTotal, 0);
        const order = {
          id: crypto.randomUUID(),
          ref: "HG" + Date.now().toString().slice(-8),
          user_id: req.user?.id || null,
          email,
          ship_json: JSON.stringify({ name, email, phone, address, city, postal, country }),
          pay_json: JSON.stringify({ method: pay }),
          items_json: JSON.stringify(items),
          total: goods + shipping.price,
          status: "pending",
          payment_status: "unpaid",
          shipping_method: shipping.id,
          tracking: "",
          idempotency_key: idem || null,
          created: new Date().toISOString(),
        };
        db.prepare(`
          INSERT INTO orders (
            id, ref, user_id, email, ship_json, pay_json, items_json, total, status, payment_status,
            shipping_method, tracking, idempotency_key, created
          ) VALUES (
            @id, @ref, @user_id, @email, @ship_json, @pay_json, @items_json, @total, @status, @payment_status,
            @shipping_method, @tracking, @idempotency_key, @created
          )
        `).run(order);
        db.prepare("DELETE FROM cart_lines WHERE owner_type = ? AND owner_id = ?").run(owner.type, owner.id);
        if (req.user && bodyHasAddress(req)) saveAddress(req.user.id, order);
        return order;
      })();
      res.status(201).json(orderResponse(created));
    } catch (error) {
      if (error.status) return fail(error.status, error.message);
      if (String(error.message).includes("UNIQUE") && idem) {
        const prior = db.prepare("SELECT * FROM orders WHERE idempotency_key = ?").get(idem);
        if (prior) return res.status(200).json(orderResponse(prior));
      }
      throw error;
    }
  });

  app.get("/api/addresses", (req, res) => {
    if (!req.user) return fail(401, "Sign in to continue.");
    res.json(db.prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, name").all(req.user.id).map(publicAddress));
  });

  app.post("/api/addresses", (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    const address = readAddress(req.body);
    if (!address) return fail(400, "The address is incomplete.");
    const id = crypto.randomUUID();
    db.transaction(() => {
      if (address.isDefault) db.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(req.user.id);
      const count = db.prepare("SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?").get(req.user.id).n;
      db.prepare(`
        INSERT INTO addresses (id, user_id, name, phone, line1, city, postal, country, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, address.name, address.phone, address.line1, address.city, address.postal, address.country, (address.isDefault || count === 0) ? 1 : 0);
    })();
    res.status(201).json(publicAddress(db.prepare("SELECT * FROM addresses WHERE id = ?").get(id)));
  });

  app.patch("/api/addresses/:id", (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    const current = db.prepare("SELECT * FROM addresses WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!current) return fail(404, "That address is not on this file.");
    const address = readAddress({ ...current, line1: current.line1, ...req.body, name: req.body?.name ?? current.name });
    if (!address) return fail(400, "The address is incomplete.");
    db.transaction(() => {
      if (address.isDefault) db.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(req.user.id);
      db.prepare(`
        UPDATE addresses SET name = ?, phone = ?, line1 = ?, city = ?, postal = ?, country = ?, is_default = ?
        WHERE id = ? AND user_id = ?
      `).run(address.name, address.phone, address.line1, address.city, address.postal, address.country, address.isDefault ? 1 : current.is_default, current.id, req.user.id);
    })();
    res.json(publicAddress(db.prepare("SELECT * FROM addresses WHERE id = ?").get(current.id)));
  });

  app.delete("/api/addresses/:id", (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    const result = db.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    if (!result.changes) return fail(404, "That address is not on this file.");
    res.json({ ok: true });
  });

  app.get("/api/favorites", (req, res) => {
    if (!req.user) return fail(401, "Sign in to continue.");
    const rows = db.prepare("SELECT handle, created FROM favorites WHERE user_id = ? ORDER BY created DESC").all(req.user.id);
    res.json(rows.map((row) => ({ ...row, product: productByHandle(row.handle) || null })).filter((row) => row.product));
  });

  app.post("/api/favorites", (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    const handle = String(req.body?.handle || "");
    if (!productByHandle(handle)) return fail(400, "This piece cannot be saved.");
    db.prepare(`
      INSERT INTO favorites (user_id, handle, created) VALUES (?, ?, ?)
      ON CONFLICT(user_id, handle) DO NOTHING
    `).run(req.user.id, handle, new Date().toISOString());
    res.status(201).json({ ok: true });
  });

  app.delete("/api/favorites/:handle", (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND handle = ?").run(req.user.id, req.params.handle);
    res.json({ ok: true });
  });

  app.patch("/api/account", asyncRoute(async (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    const names = registrationNames({ ...req.user, firstName: req.user.first_name, lastName: req.user.last_name, ...req.body });
    const phone = String(req.body?.phone ?? req.user.phone ?? "").trim().slice(0, 40);
    const email = normalizeEmail(req.body?.email || req.user.email);
    if (!names.first) return fail(400, "Enter your first and last name.");
    if (!validEmail(email)) return fail(400, "Enter a valid email.");
    const emailChanged = email !== req.user.email;
    try {
      db.transaction(() => {
        db.prepare(`
          UPDATE users SET first_name = ?, last_name = ?, phone = ?, email = ?, email_verified = ?
          WHERE id = ?
        `).run(names.first, names.last, phone, email, emailChanged ? 0 : req.user.email_verified, req.user.id);
        if (emailChanged) rememberVerification(req.user.id, email);
      })();
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return fail(409, "That email already has a file.");
      throw error;
    }
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json({ user: publicUser(user), mail: false });
  }));

  app.post("/api/account/password", asyncRoute(async (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    const current = String(req.body?.current || "");
    const password = String(req.body?.password || "");
    const confirm = String(req.body?.confirmPassword || req.body?.confirm || "");
    const ok = await verifyPassword(current, req.user.password_hash, req.user.password_algo);
    if (!ok) return fail(400, "The current password is not right.");
    if (password.length < 8 || password.length > 200) return fail(400, "Use at least 8 characters.");
    if (confirm !== password) return fail(400, "The passwords do not match.");
    const passwordHash = await hashPassword(password);
    db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ?, password_algo = 'argon2id' WHERE id = ?").run(passwordHash, req.user.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(req.user.id, req.session.id);
    })();
    res.json({ ok: true });
  }));

  app.post("/api/account/sessions/revoke", (req, res) => {
    requireCsrf(req);
    if (!req.user) return fail(401, "Sign in to continue.");
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(req.user.id, req.session.id);
    res.json({ ok: true });
  });

  app.get("/api/rewards", (req, res) => {
    const config = rewardsConfig();
    if (!config.is_public) return res.json({ public: false });
    if (!req.user) return fail(401, "Sign in to continue.");
    const account = db.prepare("SELECT balance FROM rewards_accounts WHERE user_id = ?").get(req.user.id);
    const events = db.prepare(`
      SELECT delta, reason, created FROM rewards_events WHERE user_id = ? ORDER BY created DESC LIMIT 20
    `).all(req.user.id);
    res.json({ public: true, balance: account?.balance || 0, minRedeem: config.min_redeem, events });
  });

  app.get("/api/admin/orders", (req, res) => {
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    const orders = db.prepare("SELECT * FROM orders ORDER BY created DESC LIMIT 200").all().map(publicOrder);
    res.json(orders);
  });

  app.patch("/api/admin/orders/:id", (req, res) => {
    requireCsrf(req);
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    const order = findOrder(req.params.id);
    if (!order) return fail(404, "That order is not on file.");
    const status = String(req.body?.status || order.status);
    const tracking = String(req.body?.tracking ?? order.tracking ?? "").trim().slice(0, 120);
    if (!["pending", "confirmed", "packed", "shipped", "cancelled"].includes(status)) {
      return fail(400, "That status is not used.");
    }
    db.prepare("UPDATE orders SET status = ?, tracking = ? WHERE id = ?").run(status, tracking, order.id);
    res.json(publicOrder(findOrder(order.id)));
  });

  app.get("/api/admin/stock", (req, res) => {
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    res.json(db.prepare("SELECT variant_id, handle, quantity FROM stock ORDER BY handle").all());
  });

  app.patch("/api/admin/stock", (req, res) => {
    requireCsrf(req);
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    const variantId = String(req.body?.variantId || "");
    const row = db.prepare("SELECT * FROM stock WHERE variant_id = ?").get(variantId);
    if (!row) return fail(404, "That piece is not stocked.");
    const quantity = req.body?.quantity == null || req.body.quantity === "" ? null : Math.max(0, Number(req.body.quantity));
    if (quantity != null && !Number.isFinite(quantity)) return fail(400, "Enter a quantity.");
    db.prepare("UPDATE stock SET quantity = ? WHERE variant_id = ?").run(quantity, variantId);
    res.json(db.prepare("SELECT * FROM stock WHERE variant_id = ?").get(variantId));
  });

  app.get("/api/admin/rewards", (req, res) => {
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    res.json(rewardsConfig());
  });

  app.patch("/api/admin/rewards", (req, res) => {
    requireCsrf(req);
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    const isPublic = req.body?.isPublic ? 1 : 0;
    const points = Math.max(0, Number(req.body?.pointsPerOrder) || 0);
    const minRedeem = Math.max(0, Number(req.body?.minRedeem) || 0);
    db.prepare("UPDATE rewards_config SET is_public = ?, points_per_order = ?, min_redeem = ? WHERE id = 1")
      .run(isPublic, points, minRedeem);
    res.json(rewardsConfig());
  });

  app.post("/api/admin/rewards/credit", (req, res) => {
    requireCsrf(req);
    if (!isAdmin(req)) return fail(403, "This desk is closed.");
    const userId = String(req.body?.userId || "");
    const eventKey = String(req.body?.eventKey || "").trim().slice(0, 120);
    const delta = Number(req.body?.delta);
    const reason = String(req.body?.reason || "").trim().slice(0, 200);
    if (!db.prepare("SELECT id FROM users WHERE id = ?").get(userId)) return fail(404, "That customer is not on file.");
    if (!eventKey || !reason || !Number.isInteger(delta) || delta === 0) return fail(400, "The reward entry is incomplete.");
    try {
      const balance = db.transaction(() => {
        db.prepare("INSERT INTO rewards_accounts (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING").run(userId);
        const current = db.prepare("SELECT balance FROM rewards_accounts WHERE user_id = ?").get(userId).balance;
        if (current + delta < 0) return fail(400, "The balance cannot go below zero.");
        db.prepare(`
          INSERT INTO rewards_events (id, user_id, event_key, delta, reason, created)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), userId, eventKey, delta, reason, new Date().toISOString());
        db.prepare("UPDATE rewards_accounts SET balance = balance + ? WHERE user_id = ?").run(delta, userId);
        return current + delta;
      })();
      res.status(201).json({ balance });
    } catch (error) {
      if (error.status) return fail(error.status, error.message);
      if (String(error.message).includes("UNIQUE")) return fail(409, "That reward was already recorded.");
      throw error;
    }
  });

  app.post("/api/contact", (req, res) => {
    requireCsrf(req);
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!name || !email || !body) return fail(400, "The desk needs a name, email, and note.");
    db.prepare("INSERT INTO messages (id, name, email, body, created) VALUES (?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), name.slice(0, 120), email.slice(0, 200), body.slice(0, 4000), new Date().toISOString());
    res.status(201).json({ ok: true });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "That request is not part of the house." });
  });

  app.use(express.static(path.join(root, "preview")));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(root, "preview", "index.html"));
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    res.status(status).json({ error: status === 500 ? "The house could not complete that." : error.message });
  });

  return app;

  function rewardsConfig() {
    return db.prepare("SELECT is_public, points_per_order, min_redeem FROM rewards_config WHERE id = 1").get();
  }

  function cartCount(owner) {
    return db.prepare("SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_lines WHERE owner_type = ? AND owner_id = ?")
      .get(owner.type, owner.id).n;
  }

  function presentCart(owner) {
    const lines = db.prepare(`
      SELECT * FROM cart_lines WHERE owner_type = ? AND owner_id = ? ORDER BY id
    `).all(owner.type, owner.id).map((line) => {
      const priced = priceLine(line.handle, line.variant_id);
      return {
        variantId: line.variant_id,
        handle: line.handle,
        quantity: line.quantity,
        product: priced?.product || null,
        lineTotal: priced ? priced.price * line.quantity : 0,
      };
    });
    return {
      lines,
      total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  }

  function mergeBag(fromType, fromId, toType, toId) {
    const lines = db.prepare("SELECT * FROM cart_lines WHERE owner_type = ? AND owner_id = ?").all(fromType, fromId);
    for (const line of lines) {
      if (!priceLine(line.handle, line.variant_id)) continue;
      const existing = db.prepare(`
        SELECT quantity FROM cart_lines WHERE owner_type = ? AND owner_id = ? AND variant_id = ?
      `).get(toType, toId, line.variant_id);
      const quantity = Math.min(20, (existing?.quantity || 0) + line.quantity);
      db.prepare(`
        INSERT INTO cart_lines (owner_type, owner_id, variant_id, handle, quantity)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(owner_type, owner_id, variant_id) DO UPDATE SET quantity = excluded.quantity
      `).run(toType, toId, line.variant_id, line.handle, quantity);
    }
    db.prepare("DELETE FROM cart_lines WHERE owner_type = ? AND owner_id = ?").run(fromType, fromId);
  }

  function rememberVerification(userId, email) {
    const token = crypto.randomBytes(24).toString("hex");
    db.prepare(`
      INSERT INTO verifications (id, user_id, email, token_hash, expires, used_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(crypto.randomUUID(), userId, email, sha256(token), Date.now() + 24 * 60 * 60 * 1000);
  }

  function listOrders(user) {
    return db.prepare(`
      SELECT * FROM orders WHERE user_id = ? OR email = ? ORDER BY created DESC
    `).all(user.id, user.email).map(publicOrder);
  }

  function findOrder(id) {
    return db.prepare("SELECT * FROM orders WHERE id = ? OR ref = ?").get(id, id);
  }

  function saveAddress(userId, order) {
    const ship = JSON.parse(order.ship_json);
    const existing = db.prepare(`
      SELECT id FROM addresses WHERE user_id = ? AND line1 = ? AND city = ? AND country = ?
    `).get(userId, ship.address, ship.city, ship.country);
    if (existing) return;
    const count = db.prepare("SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?").get(userId).n;
    db.prepare(`
      INSERT INTO addresses (id, user_id, name, phone, line1, city, postal, country, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, ship.name, ship.phone || "", ship.address, ship.city, ship.postal || "", ship.country, count === 0 ? 1 : 0);
  }

  function loadSession(req, _res, next) {
    req.session = null;
    req.user = null;
    const token = parseCookies(req.headers.cookie).hayugen_session;
    if (!token) return next();
    const session = db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(sha256(token));
    if (!session || session.expires < Date.now()) return next();
    req.session = session;
    req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) || null;
    next();
  }

  function bagOwner(req, res) {
    if (req.user) return { type: "user", id: req.user.id };
    return { type: "guest", id: guestId(req, res) };
  }

  function guestId(req, res) {
    const existing = parseCookies(req.headers.cookie).hayugen_guest;
    if (/^[a-f0-9]{32}$/.test(existing || "")) return existing;
    const id = crypto.randomBytes(16).toString("hex");
    setCookie(res, req, "hayugen_guest", id, 180 * 86400);
    return id;
  }

  function ensureCsrf(req, res, next) {
    const current = parseCookies(req.headers.cookie).hayugen_csrf;
    if (current && current.length >= 32) {
      req.csrf = current;
      return next();
    }
    const token = crypto.randomBytes(24).toString("hex");
    req.csrf = token;
    setCookie(res, req, "hayugen_csrf", token, 7 * 86400, false);
    next();
  }

  function requireCsrf(req) {
    const sent = String(req.get("x-csrf-token") || "");
    const cookie = parseCookies(req.headers.cookie).hayugen_csrf || req.csrf || "";
    if (!cookie || cookie.length < 32 || sent !== cookie) {
      const error = new Error("Reload the page and try again.");
      error.status = 403;
      throw error;
    }
  }
}

function seedStock(db) {
  const insert = db.prepare("INSERT OR IGNORE INTO stock (variant_id, handle, quantity) VALUES (?, ?, NULL)");
  const tx = db.transaction(() => {
    for (const product of catalog) {
      for (const variant of product.variants || []) insert.run(String(variant.id), product.handle);
    }
  });
  tx();
}

function promoteAdmin(db) {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email) return;
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
}

function productByHandle(handle) {
  return catalog.find((item) => item.handle === handle);
}

function priceLine(handle, variantId) {
  const product = productByHandle(handle);
  if (!product) return null;
  const variant = (product.variants || []).find((item) => String(item.id) === String(variantId));
  if (!variant || variant.available === false || !Number.isFinite(Number(variant.price))) return null;
  const detail = (product.options || [])
    .map((option, index) => variant[`option${index + 1}`])
    .filter(Boolean)
    .join(" · ");
  return { product, price: Number(variant.price), detail };
}

function publicUser(user) {
  if (!user) return null;
  const first = user.first_name || "";
  const last = user.last_name || "";
  return {
    id: user.id,
    email: user.email,
    firstName: first,
    lastName: last,
    name: [first, last].filter(Boolean).join(" "),
    phone: user.phone || "",
    emailVerified: Boolean(user.email_verified),
    role: user.role || "customer",
    created: user.created,
  };
}

function publicAddress(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    line1: row.line1,
    city: row.city,
    postal: row.postal,
    country: row.country,
    isDefault: Boolean(row.is_default),
  };
}

function publicOrder(row) {
  return {
    id: row.id,
    ref: row.ref,
    email: row.email,
    total: row.total,
    status: row.status,
    paymentStatus: row.payment_status,
    shippingMethod: row.shipping_method,
    tracking: row.tracking,
    created: row.created,
    items: JSON.parse(row.items_json || "[]"),
    ship: JSON.parse(row.ship_json || "{}"),
    pay: JSON.parse(row.pay_json || "{}"),
  };
}

function orderResponse(row) {
  const order = publicOrder(row);
  return {
    id: order.id,
    ref: order.ref,
    total: order.total,
    email: order.email,
    city: order.ship.city,
    pay: order.pay,
    status: order.status,
    paymentStatus: order.paymentStatus,
  };
}

function ownsOrder(order, user) {
  return order.user_id === user.id || order.email === user.email;
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function registrationNames(body) {
  let first = String(body.firstName || body.first_name || "").trim();
  let last = String(body.lastName || body.last_name || "").trim();
  if (!first && body.name) {
    const names = splitName(body.name);
    first = names.first;
    last = last || names.last;
  }
  return { first, last };
}

function readAddress(body) {
  const name = String(body?.name || "").trim();
  const line1 = String(body?.line1 || body?.address || "").trim();
  const city = String(body?.city || "").trim();
  const country = String(body?.country || "").trim();
  if (!name || !line1 || !city || !country) return null;
  return {
    name: name.slice(0, 120),
    phone: String(body?.phone || "").trim().slice(0, 40),
    line1: line1.slice(0, 240),
    city: city.slice(0, 80),
    postal: String(body?.postal || "").trim().slice(0, 20),
    country: country.slice(0, 80),
    isDefault: Boolean(body?.isDefault),
  };
}

function bodyHasAddress() {
  return true;
}

function newSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    row: {
      id: crypto.randomUUID(),
      token_hash: sha256(token),
      user_id: userId,
      expires: Date.now() + SESSION_DAYS * 86400 * 1000,
      created: new Date().toISOString(),
    },
  };
}

function readGuest(req) {
  const id = parseCookies(req.headers.cookie).hayugen_guest;
  return /^[a-f0-9]{32}$/.test(id || "") ? id : "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) out[key] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function cookieSecure(req) {
  return req.secure || req.get("x-forwarded-proto") === "https" ? "; Secure" : "";
}

function setCookie(res, req, name, value, maxAge, httpOnly = true) {
  const http = httpOnly ? "HttpOnly; " : "";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; ${http}SameSite=Lax; Max-Age=${maxAge}${cookieSecure(req)}`
  );
}

function clearCookie(res, req, name) {
  res.append("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecure(req)}`);
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { createApp, SHIPPING };
