const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { createApp } = require("../server/app");
const { sha256 } = require("../server/passwords");
const catalog = require("../preview/js/catalog");

const piece = catalog.find((item) =>
  (item.variants || []).some((variant) => variant.available !== false && Number.isFinite(Number(variant.price)))
);
const variant = piece.variants.find((item) => item.available !== false && Number.isFinite(Number(item.price)));

function client() {
  const cookies = new Map();
  return {
    async send(base, route, options = {}) {
      const method = options.method || "GET";
      const headers = { ...(options.headers || {}) };
      if (options.body && !headers["content-type"] && !headers["Content-Type"]) {
        headers["content-type"] = "application/json";
      }
      const cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
      if (cookie) headers.cookie = cookie;
      if (method !== "GET" && cookies.has("hayugen_csrf")) {
        headers["x-csrf-token"] = decodeURIComponent(cookies.get("hayugen_csrf"));
      }
      const response = await fetch(base + route, { ...options, headers });
      for (const line of response.headers.getSetCookie?.() || []) {
        const [pair] = line.split(";");
        const eq = pair.indexOf("=");
        cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
      }
      const data = await response.json().catch(() => ({}));
      return { status: response.status, data };
    },
  };
}

describe("commerce foundation", { concurrency: false }, () => {
  let server;
  let base;
  let db;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hayugen-"));
  const password = "password12";

  before(async () => {
    const app = createApp({
      dbPath: path.join(dir, "test.sqlite"),
      importJson: false,
      backup: false,
      authLimit: 0,
    });
    db = app.locals.db;
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server?.close();
    db?.close();
  });

  it("rejects a duplicate email and a bad login", async () => {
    const person = client();
    await person.send(base, "/api/me");
    const body = JSON.stringify({
      firstName: "Ani",
      lastName: "Test",
      email: "ani.commerce@example.com",
      password,
      confirmPassword: password,
      privacy: true,
    });
    const created = await person.send(base, "/api/register", { method: "POST", body });
    assert.equal(created.status, 201);
    assert.equal(created.data.user.emailVerified, false);
    const again = await person.send(base, "/api/register", { method: "POST", body });
    assert.equal(again.status, 409);

    const stranger = client();
    await stranger.send(base, "/api/me");
    const bad = await stranger.send(base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "ani.commerce@example.com", password: "wrong-password" }),
    });
    assert.equal(bad.status, 401);
  });

  it("expires a reset and does not claim that mail was sent", async () => {
    const person = client();
    await person.send(base, "/api/me");
    const forgot = await person.send(base, "/api/forgot", {
      method: "POST",
      body: JSON.stringify({ email: "ani.commerce@example.com" }),
    });
    assert.equal(forgot.data.mail, false);
    assert.match(forgot.data.message, /nothing was sent/i);

    const user = db.prepare("SELECT id FROM users WHERE email = ?").get("ani.commerce@example.com");
    const expired = "expiredtokenexpiredtokenexpired12";
    db.prepare("INSERT INTO resets (id, user_id, token_hash, expires, used_at) VALUES (?, ?, ?, ?, NULL)")
      .run(crypto.randomUUID(), user.id, sha256(expired), Date.now() - 1000);
    const stale = await person.send(base, "/api/reset", {
      method: "POST",
      body: JSON.stringify({ token: expired, password, confirmPassword: password }),
    });
    assert.equal(stale.status, 400);

    const token = "validtokenvalidtokenvalidtoken12";
    db.prepare("INSERT INTO resets (id, user_id, token_hash, expires, used_at) VALUES (?, ?, ?, ?, NULL)")
      .run(crypto.randomUUID(), user.id, sha256(token), Date.now() + 60_000);
    const fresh = await person.send(base, "/api/reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "password13", confirmPassword: "password13" }),
    });
    assert.equal(fresh.status, 200);
    const reuse = await person.send(base, "/api/reset", {
      method: "POST",
      body: JSON.stringify({ token, password: "password13", confirmPassword: "password13" }),
    });
    assert.equal(reuse.status, 400);
  });

  it("keeps guest bags apart and merges the same variant once", async () => {
    const left = client();
    const right = client();
    await left.send(base, "/api/me");
    await right.send(base, "/api/me");
    const added = await left.send(base, "/api/cart", {
      method: "POST",
      body: JSON.stringify({ handle: piece.handle, variantId: String(variant.id), quantity: 2 }),
    });
    assert.equal(added.status, 201);
    const other = await right.send(base, "/api/cart");
    assert.equal(other.data.lines.length, 0);
    const own = await left.send(base, "/api/cart");
    assert.equal(own.data.lines.length, 1);
    assert.equal(own.data.lines[0].quantity, 2);

    const signed = await left.send(base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "ani.commerce@example.com", password: "password13" }),
    });
    assert.equal(signed.status, 200);
    const merged = await left.send(base, "/api/cart");
    assert.equal(merged.data.lines.length, 1);
    await left.send(base, "/api/cart", {
      method: "POST",
      body: JSON.stringify({ handle: piece.handle, variantId: String(variant.id), quantity: 1 }),
    });
    const once = await left.send(base, "/api/cart");
    assert.equal(once.data.lines.length, 1);
    assert.equal(once.data.lines[0].quantity, 3);
    assert.equal(once.data.lines[0].lineTotal, variant.price * 3);
  });

  it("changes quantity and rejects an unknown piece", async () => {
    const person = client();
    await person.send(base, "/api/me");
    await person.send(base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "ani.commerce@example.com", password: "password13" }),
    });
    const updated = await person.send(base, "/api/cart/" + encodeURIComponent(variant.id), {
      method: "PATCH",
      body: JSON.stringify({ quantity: 4 }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.cart.lines[0].quantity, 4);
    const unknown = await person.send(base, "/api/cart", {
      method: "POST",
      body: JSON.stringify({ handle: "not-a-piece", variantId: "0", quantity: 1 }),
    });
    assert.equal(unknown.status, 400);
  });

  it("stores a pending unpaid order and refuses a card", async () => {
    const person = client();
    await person.send(base, "/api/me");
    await person.send(base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "ani.commerce@example.com", password: "password13" }),
    });
    const ship = {
      name: "Ani Test",
      email: "ani.commerce@example.com",
      address: "1 Abovyan",
      city: "Yerevan",
      country: "Armenia",
      pay: "transfer",
      shipping: "yerevan",
    };
    const order = await person.send(base, "/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "test-order-1" },
      body: JSON.stringify(ship),
    });
    assert.equal(order.status, 201);
    assert.equal(order.data.status, "pending");
    assert.equal(order.data.paymentStatus, "unpaid");
    assert.equal(order.data.total, variant.price * 4);
    const again = await person.send(base, "/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": "test-order-1" },
      body: JSON.stringify(ship),
    });
    assert.equal(again.status, 200);
    assert.equal(again.data.ref, order.data.ref);

    await person.send(base, "/api/cart", {
      method: "POST",
      body: JSON.stringify({ handle: piece.handle, variantId: String(variant.id), quantity: 1 }),
    });
    const card = await person.send(base, "/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...ship, pay: "card", ccNumber: "4242424242424242" }),
    });
    assert.equal(card.status, 400);
    const still = await person.send(base, "/api/cart");
    assert.equal(still.data.lines.length, 1);
  });

  it("keeps one favorite and closes the desk to a customer", async () => {
    const person = client();
    await person.send(base, "/api/me");
    await person.send(base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "ani.commerce@example.com", password: "password13" }),
    });
    await person.send(base, "/api/favorites", { method: "POST", body: JSON.stringify({ handle: piece.handle }) });
    await person.send(base, "/api/favorites", { method: "POST", body: JSON.stringify({ handle: piece.handle }) });
    const favorites = await person.send(base, "/api/favorites");
    assert.equal(favorites.data.length, 1);
    const closed = await person.send(base, "/api/admin/orders");
    assert.equal(closed.status, 403);

    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run("ani.commerce@example.com");
    const open = await person.send(base, "/api/admin/orders");
    assert.equal(open.status, 200);
    const credit = await person.send(base, "/api/admin/rewards/credit", {
      method: "POST",
      body: JSON.stringify({
        userId: db.prepare("SELECT id FROM users WHERE email = ?").get("ani.commerce@example.com").id,
        eventKey: "welcome",
        delta: 10,
        reason: "Desk credit",
      }),
    });
    assert.equal(credit.status, 201);
    const duplicate = await person.send(base, "/api/admin/rewards/credit", {
      method: "POST",
      body: JSON.stringify({
        userId: db.prepare("SELECT id FROM users WHERE email = ?").get("ani.commerce@example.com").id,
        eventKey: "welcome",
        delta: 10,
        reason: "Desk credit",
      }),
    });
    assert.equal(duplicate.status, 409);
  });

  it("keeps an imported order status", async () => {
    const fixture = path.join(dir, "store.json");
    fs.writeFileSync(fixture, JSON.stringify({
      users: [{ id: "old-user", email: "old@example.com", name: "Old Customer", password: "aa:bb", created: "2020-01-01T00:00:00.000Z" }],
      sessions: [],
      carts: { anon: [{ variantId: "1", handle: "shared", quantity: 1 }] },
      orders: [{
        id: "old-order",
        ref: "HGOLD",
        userId: "old-user",
        email: "old@example.com",
        status: "confirmed",
        total: 1500000,
        items: [],
        ship: { city: "Yerevan" },
        pay: "vault",
        created: "2020-01-02T00:00:00.000Z",
      }],
      messages: [],
      resets: [],
    }));
    const imported = createApp({
      dbPath: path.join(dir, "import.sqlite"),
      jsonPath: fixture,
      backup: false,
      authLimit: 0,
    });
    const row = imported.locals.db.prepare("SELECT status, payment_status FROM orders WHERE ref = ?").get("HGOLD");
    const anon = imported.locals.db.prepare("SELECT COUNT(*) AS n FROM cart_lines WHERE owner_id = 'anon'").get();
    assert.equal(row.status, "confirmed");
    assert.equal(row.payment_status, "recorded");
    assert.equal(anon.n, 0);
    imported.locals.db.close();
  });
});
