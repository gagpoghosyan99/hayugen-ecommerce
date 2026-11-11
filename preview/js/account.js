(() => {
  const root = document.getElementById("account-root");
  const params = new URLSearchParams(location.search);
  const orderId = params.get("order") || "";
  const section = params.get("section") || (orderId ? "orders" : "home");

  function nav(active) {
    const items = [
      ["home", "Overview"],
      ["orders", "Orders"],
      ["favorites", "Favorites"],
      ["profile", "Details"],
      ["addresses", "Addresses"],
      ["security", "Security"],
      ["search", "Search"],
    ];
    return `<nav class="account-nav" aria-label="Account">${items.map(([id, label]) =>
      `<a href="./account.html?section=${id}" ${id === active ? 'aria-current="page"' : ""}>${label}</a>`
    ).join("")}</nav>`;
  }

  function shell(user, body, active) {
    const note = user.emailVerified ? "" : `<p class="hint">Email is not verified. Mail is not connected, so no message was sent.</p>`;
    return `
      <div class="account-layout">
        <aside class="account-side">
          <h1 class="page-title">${HAYUGEN.esc(user.name)}</h1>
          <p class="account-email">${HAYUGEN.esc(user.email)}</p>
          ${note}
          ${nav(active)}
          <button class="btn-ghost" id="out" type="button">Sign out</button>
        </aside>
        <section>${body}</section>
      </div>`;
  }

  async function paintHome(user) {
    const [orders, favorites, rewards] = await Promise.all([
      HAYUGEN.api.orders().catch(() => []),
      HAYUGEN.api.favorites().catch(() => []),
      HAYUGEN.api.rewards().catch(() => ({ public: false })),
    ]);
    const recent = orders.slice(0, 3);
    root.innerHTML = shell(user, `
      <h2 class="page-kicker">Welcome</h2>
      <p class="lede">Recent orders, saved pieces, and the file on the house.</p>
      <div class="account-stats">
        <p><strong>${orders.length}</strong> orders</p>
        <p><strong>${favorites.length}</strong> favorites</p>
        <p><strong>${rewards.public ? rewards.balance : "—"}</strong> rewards</p>
      </div>
      ${rewards.public ? "" : `<p class="hint">Rewards are not offered until the house turns them on.</p>`}
      <h3>Recent orders</h3>
      ${recent.length ? recent.map(orderCard).join("") : `<p class="lede">No orders yet.</p>`}
    `, "home");
  }

  function orderCard(order) {
    return `<article class="order">
      <strong><a href="./account.html?order=${encodeURIComponent(order.id)}">${HAYUGEN.esc(order.ref)}</a></strong>
      <p>${HAYUGEN.esc(new Date(order.created).toLocaleDateString())} · ${HAYUGEN.esc(order.status)} · ${HAYUGEN.esc(order.paymentStatus || "")} · ${HAYUGEN.money(order.total)}</p>
      <p>${order.items.map((item) => HAYUGEN.esc(item.title || "Piece") + " × " + item.quantity).join(" · ")}</p>
    </article>`;
  }

  async function paintOrders(user) {
    if (orderId) {
      const order = await HAYUGEN.api.order(orderId);
      root.innerHTML = shell(user, `
        <h2 class="page-kicker">${HAYUGEN.esc(order.ref)}</h2>
        <p>${HAYUGEN.esc(order.status)} · Payment ${HAYUGEN.esc(order.paymentStatus)} · ${HAYUGEN.money(order.total)}</p>
        ${order.tracking ? `<p>Tracking ${HAYUGEN.esc(order.tracking)}</p>` : ""}
        <div class="orders">${order.items.map((item) => `<article class="order"><strong>${HAYUGEN.esc(item.title || "Piece")}</strong><p>${HAYUGEN.esc(item.detail || "")} × ${item.quantity} · ${HAYUGEN.money(item.lineTotal)}</p></article>`).join("")}</div>
        <p>${HAYUGEN.esc(order.ship?.name || "")}<br>${HAYUGEN.esc(order.ship?.address || "")}<br>${HAYUGEN.esc(order.ship?.city || "")} ${HAYUGEN.esc(order.ship?.country || "")}</p>
        <p class="hint">${HAYUGEN.esc(HAYUGEN.tenderLabel(order.pay))}. ${order.paymentStatus === "unpaid" ? "An unpaid order is not a receipt." : "This record was kept as it was placed."}</p>
        <p><a href="./account.html?section=orders">All orders</a></p>
      `, "orders");
      return;
    }
    const orders = await HAYUGEN.api.orders();
    root.innerHTML = shell(user, `<h2 class="page-kicker">Orders</h2>${orders.length ? orders.map(orderCard).join("") : `<p class="lede">No orders yet.</p>`}`, "orders");
  }

  async function paintFavorites(user) {
    const items = await HAYUGEN.api.favorites();
    root.innerHTML = shell(user, `
      <h2 class="page-kicker">Favorites</h2>
      <div class="orders" id="favs">${items.length ? items.map((item) => `
        <article class="order">
          <strong>${HAYUGEN.esc(item.product.title)}</strong>
          <p>${HAYUGEN.money(item.product.price)} · ${item.product.available ? "Available" : "Unavailable"}</p>
          <button type="button" data-add="${HAYUGEN.esc(item.product.variants[0].id)}" data-handle="${HAYUGEN.esc(item.handle)}">Add to bag</button>
          <button type="button" data-drop="${HAYUGEN.esc(item.handle)}">Remove</button>
        </article>`).join("") : `<p class="lede">No saved pieces.</p>`}</div>
    `, "favorites");
    document.getElementById("favs")?.addEventListener("click", async (event) => {
      const add = event.target.closest("[data-add]");
      const drop = event.target.closest("[data-drop]");
      if (add) await HAYUGEN.addToCart(add.dataset.add, add.dataset.handle, 1);
      if (drop) {
        await HAYUGEN.api.deleteFavorite(drop.dataset.drop);
        await paintFavorites(user);
      }
    });
  }

  async function paintProfile(user) {
    root.innerHTML = shell(user, `
      <h2 class="page-kicker">Details</h2>
      <form class="form" id="profile">
        <div class="pay-row">
          <div class="field"><label for="first">First name</label><input id="first" name="firstName" value="${HAYUGEN.esc(user.firstName)}" required></div>
          <div class="field"><label for="last">Last name</label><input id="last" name="lastName" value="${HAYUGEN.esc(user.lastName)}" required></div>
        </div>
        <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" value="${HAYUGEN.esc(user.phone)}"></div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value="${HAYUGEN.esc(user.email)}" required></div>
        <p class="hint">Changing the email marks it unverified. Mail is not connected, so no message is sent.</p>
        <button class="btn" type="submit">Save</button>
        <p class="status" id="profile-status" role="status"></p>
      </form>
    `, "profile");
    document.getElementById("profile").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      const status = document.getElementById("profile-status");
      try {
        const saved = await HAYUGEN.api.updateAccount(data);
        status.textContent = saved.mail ? "" : "Saved. No email was sent.";
      } catch (error) {
        status.textContent = error.message;
      }
    });
  }

  async function paintAddresses(user) {
    const rows = await HAYUGEN.api.addresses();
    root.innerHTML = shell(user, `
      <h2 class="page-kicker">Addresses</h2>
      <div class="orders">${rows.map((row) => `<article class="order"><strong>${HAYUGEN.esc(row.name)}${row.isDefault ? " · Default" : ""}</strong><p>${HAYUGEN.esc(row.line1)}, ${HAYUGEN.esc(row.city)}, ${HAYUGEN.esc(row.country)}</p><button type="button" data-address-drop="${HAYUGEN.esc(row.id)}">Delete</button></article>`).join("")}</div>
      <form class="form" id="address">
        <div class="field"><label for="aname">Name</label><input id="aname" name="name" required></div>
        <div class="field"><label for="aline">Address</label><input id="aline" name="line1" required></div>
        <div class="pay-row">
          <div class="field"><label for="acity">City</label><input id="acity" name="city" required></div>
          <div class="field"><label for="apostal">Postal code</label><input id="apostal" name="postal"></div>
        </div>
        <div class="field"><label for="acountry">Country</label><input id="acountry" name="country" required></div>
        <label class="account-check"><input type="checkbox" name="isDefault"><span>Default shipping address</span></label>
        <button class="btn" type="submit">Save address</button>
        <p class="status" id="address-status" role="status"></p>
      </form>
    `, "addresses");
    document.getElementById("address").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      data.isDefault = Boolean(data.isDefault);
      try {
        await HAYUGEN.api.saveAddress(data);
        await paintAddresses(user);
      } catch (error) {
        document.getElementById("address-status").textContent = error.message;
      }
    });
    root.querySelectorAll("[data-address-drop]").forEach((button) => {
      button.addEventListener("click", async () => {
        await HAYUGEN.api.deleteAddress(button.dataset.addressDrop);
        await paintAddresses(user);
      });
    });
  }

  async function paintSecurity(user) {
    root.innerHTML = shell(user, `
      <h2 class="page-kicker">Security</h2>
      <form class="form" id="password">
        <div class="field"><label for="current">Current password</label><input id="current" name="current" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="next">New password</label><input id="next" name="password" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label for="confirm">Confirm password</label><input id="confirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div>
        <button class="btn" type="submit">Change password</button>
        <p class="status" id="security-status" role="status"></p>
      </form>
      <p><button class="btn-ghost" id="revoke" type="button">Sign out other sessions</button></p>
    `, "security");
    document.getElementById("password").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      const status = document.getElementById("security-status");
      try {
        await HAYUGEN.api.changePassword(data);
        status.textContent = "Password saved. Other sessions were closed.";
      } catch (error) {
        status.textContent = error.message;
      }
    });
    document.getElementById("revoke").addEventListener("click", async () => {
      await HAYUGEN.api.revokeSessions();
      document.getElementById("security-status").textContent = "Other sessions were closed.";
    });
  }

  async function paintSearch(user) {
    root.innerHTML = shell(user, `
      <h2 class="page-kicker">Search</h2>
      <form class="form" id="search">
        <div class="field"><label for="q">Find a piece</label><input id="q" name="q" type="search"></div>
        <button class="btn" type="submit">Search</button>
      </form>
      <div class="orders" id="search-results"></div>
    `, "search");
    document.getElementById("search").addEventListener("submit", async (event) => {
      event.preventDefault();
      const q = new FormData(event.target).get("q");
      const items = await HAYUGEN.api.catalog("?q=" + encodeURIComponent(q));
      document.getElementById("search-results").innerHTML = items.length
        ? items.map((item) => `<article class="order"><strong><a href="./product.html?handle=${encodeURIComponent(item.handle)}">${HAYUGEN.esc(item.title)}</a></strong><p>${HAYUGEN.money(item.price)}</p><button type="button" data-fav="${HAYUGEN.esc(item.handle)}">Save</button></article>`).join("")
        : `<p class="lede">Nothing under that name.</p>`;
    });
    document.getElementById("search-results").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-fav]");
      if (!button) return;
      await HAYUGEN.api.saveFavorite(button.dataset.fav);
      button.textContent = "Saved";
    });
  }

  const views = { home: paintHome, orders: paintOrders, favorites: paintFavorites, profile: paintProfile, addresses: paintAddresses, security: paintSecurity, search: paintSearch };

  (async () => {
    const me = await HAYUGEN.api.me().catch(() => ({ user: null }));
    if (!me.user) {
      location.replace("./login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search));
      return;
    }
    const view = views[section] || paintHome;
    root.addEventListener("click", async (event) => {
      if (!event.target.closest("#out")) return;
      await HAYUGEN.api.logout();
      location.href = "./index.html";
    });
    await view(me.user);
  })().catch((error) => {
    root.innerHTML = `<p class="error">${HAYUGEN.esc(error.message)}</p>`;
  });
})();
