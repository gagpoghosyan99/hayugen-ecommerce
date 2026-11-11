if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function startAtTop() {
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  if (nav?.type === "back_forward") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

startAtTop();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) return;
  startAtTop();
});

const money = (cents) =>
  `AMD ${Math.round(Number(cents) / 100).toLocaleString("en-US")}`;

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)hayugen_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const api = {
  async request(path, options = {}, attempt = 0) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (method !== "GET" && method !== "HEAD") headers["X-CSRF-Token"] = csrfToken();
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers,
    });
    if (response.status === 403 && attempt < 1 && method !== "GET" && method !== "HEAD") {
      await fetch("/api/me", { credentials: "same-origin" });
      return api.request(path, options, attempt + 1);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The house could not complete that.");
    return data;
  },
  me: () => api.request("/api/me"),
  catalog: (params = "") => api.request("/api/catalog" + params),
  product: (handle) => api.request("/api/products/" + encodeURIComponent(handle)),
  cart: () => api.request("/api/cart"),
  add: (variantId, handle, quantity = 1) =>
    api.request("/api/cart", { method: "POST", body: JSON.stringify({ variantId, handle, quantity }) }),
  register: (body) => api.request("/api/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => api.request("/api/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => api.request("/api/logout", { method: "POST", body: "{}" }),
  orders: () => api.request("/api/orders"),
  checkout: (body) => api.request("/api/orders", {
    method: "POST",
    headers: { "Idempotency-Key": globalThis.crypto?.randomUUID?.() || String(Date.now()) },
    body: JSON.stringify(body),
  }),
  contact: (body) => api.request("/api/contact", { method: "POST", body: JSON.stringify(body) }),
  forgot: (email) => api.request("/api/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  reset: (body) => api.request("/api/reset", { method: "POST", body: JSON.stringify(body) }),
  order: (id) => api.request("/api/orders/" + encodeURIComponent(id)),
  addresses: () => api.request("/api/addresses"),
  saveAddress: (body) => api.request("/api/addresses", { method: "POST", body: JSON.stringify(body) }),
  updateAddress: (id, body) => api.request("/api/addresses/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) }),
  deleteAddress: (id) => api.request("/api/addresses/" + encodeURIComponent(id), { method: "DELETE" }),
  favorites: () => api.request("/api/favorites"),
  saveFavorite: (handle) => api.request("/api/favorites", { method: "POST", body: JSON.stringify({ handle }) }),
  deleteFavorite: (handle) => api.request("/api/favorites/" + encodeURIComponent(handle), { method: "DELETE" }),
  updateAccount: (body) => api.request("/api/account", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body) => api.request("/api/account/password", { method: "POST", body: JSON.stringify(body) }),
  revokeSessions: () => api.request("/api/account/sessions/revoke", { method: "POST", body: "{}" }),
  rewards: () => api.request("/api/rewards"),
  shipping: () => api.request("/api/shipping"),
  setQty: (variantId, quantity) =>
    api.request("/api/cart/" + encodeURIComponent(variantId), {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  remove: (variantId) =>
    api.request("/api/cart/" + encodeURIComponent(variantId), { method: "DELETE" }),
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function sized(url, width) {
  if (!url) return "";
  const clean = String(url);
  return clean.includes("?") ? `${clean}&width=${width}` : clean;
}

function variantBits(product, variantId) {
  if (!product) return "";
  const variant = product.variants.find((item) => String(item.id) === String(variantId));
  if (!variant) return "";
  return product.options
    .map((option, index) => variant[`option${index + 1}`])
    .filter(Boolean)
    .join(" · ");
}

function tenderLabel(pay) {
  if (!pay || typeof pay === "string") {
    return (
      {
        vault: "Card",
        card: "Card",
        transfer: "Bank transfer",
        client: "Account on file",
        account: "Account on file",
      }[pay] || "Recorded"
    );
  }
  if (pay.method === "card" && pay.last4) return `${pay.brand || "Card"} ···· ${pay.last4}`;
  if (pay.method === "transfer") return "Bank transfer";
  if (pay.method === "account") return "Account on file";
  return "Recorded";
}

let session = { user: null, cartCount: 0 };

function productByHandle(handle) {
  return (window.HAYUGEN_CATALOG || []).find((item) => item.handle === handle);
}

async function addToCart(variantId, handle, quantity = 1) {
  await api.add(variantId, handle, quantity);
  await refreshChrome();
  if (document.body.dataset.page !== "checkout") await openBag();
}

function card(product, index = 1) {
  return `
    <a class="edition" href="./product.html?handle=${encodeURIComponent(product.handle)}">
      <img src="${product.back}&width=900" alt="${product.title}" width="480" height="640" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
      <span class="edition-meta">
        <em>${product.line}</em>
        <strong>${product.title}</strong>
        <b>${money(product.price)}</b>
      </span>
    </a>
  `;
}

function renderChrome() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const page = document.body.dataset.page || "";
  if (header) {
    const gate = document.body.classList.contains("is-gate");
    header.innerHTML = `
      <header class="site-header">
        <a class="wordmark" href="./index.html">
          <img src="./img/logo-light.png" alt="HAYUGEN" width="220" height="98">
        </a>
        <nav class="site-nav" id="site-nav" aria-label="Primary">
          <a href="./index.html" ${page === "home" ? 'aria-current="page"' : ""}>Home</a>
          <a href="./shop.html?cat=men" ${page === "men" ? 'aria-current="page"' : ""}>Man</a>
          <a href="./shop.html?cat=women" ${page === "women" ? 'aria-current="page"' : ""}>Woman</a>
          <a href="./shop.html?cat=accessories" ${page === "accessories" ? 'aria-current="page"' : ""}>Accessories</a>
          <a class="nav-extra" href="${session.user ? "./account.html" : "./login.html"}">${session.user ? "Account" : "Sign in"}</a>
        </nav>
        <div class="header-tools">
          <a href="${session.user ? "./account.html" : "./login.html"}">${session.user ? "Account" : "Sign in"}</a>
          <button class="bag-open" id="bag-open" type="button" aria-controls="bag-drawer" aria-expanded="false">Bag (${session.cartCount})</button>
          <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Menu">
            <span aria-hidden="true"></span>
          </button>
        </div>
      </header>
    `;
  }
  if (footer && !document.body.classList.contains("is-gate")) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-grid">
          <div>
            <a class="wordmark" href="./index.html">
              <img src="./img/logo-light.png" alt="HAYUGEN" width="220" height="98">
            </a>
            <p>Yerevan maison. Cloth, ornament, and silhouette — for people without announcement.</p>
          </div>
          <div>
            <h2>Shop</h2>
            <ul>
              <li><a href="./shop.html?cat=men">Man</a></li>
              <li><a href="./shop.html?cat=women">Woman</a></li>
              <li><a href="./shop.html?cat=accessories">Accessories</a></li>
              <li><a href="./lookbook.html">Lookbook</a></li>
            </ul>
          </div>
          <div>
            <h2>Account</h2>
            <ul>
              <li><a href="./login.html">Sign in</a></li>
              <li><a href="./register.html">Create account</a></li>
              <li><a href="./account.html">Orders</a></li>
              <li><a href="./contact.html">Contact</a></li>
            </ul>
          </div>
          <div>
            <h2>About</h2>
            <ul>
              <li><a href="./about.html">The Maison</a></li>
              <li><a href="./privacy.html">Privacy</a></li>
              <li><a href="./privacy.html#checkout">Payments</a></li>
              <li><a href="./privacy.html#returns">Returns</a></li>
              <li><a href="./privacy.html#shipping">Shipping</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-end">
          <span>© ${new Date().getFullYear()} HAYUGEN — Yerevan</span>
          <span>Carefully made in Yerevan</span>
        </div>
      </footer>
    `;
  }
}

async function refreshChrome() {
  try {
    session = await api.me();
  } catch {
    session = { user: null, cartCount: 0 };
  }
  renderChrome();
  bindNav();
  bindBag();
}

let navAbort;

function bindNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  navAbort?.abort();
  navAbort = new AbortController();
  const { signal } = navAbort;

  const close = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  }, { signal });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  }, { signal });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  }, { signal });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) close();
  }, { signal });
}

function ensureBag() {
  if (document.getElementById("bag-drawer")) return;
  const drawer = document.createElement("dialog");
  drawer.id = "bag-drawer";
  drawer.className = "bag-drawer";
  drawer.setAttribute("aria-labelledby", "bag-title");
  drawer.setAttribute("closedby", "any");
  drawer.innerHTML = `
    <header class="bag-drawer-bar">
      <h2 id="bag-title">Bag</h2>
      <button type="button" class="bag-close" id="bag-close" autofocus>Close</button>
    </header>
    <div class="bag-drawer-body" id="bag-body"><p>Opening the bag…</p></div>
    <footer class="bag-drawer-foot" id="bag-foot"></footer>`;
  document.body.append(drawer);
  drawer.addEventListener("close", () => {
    document.getElementById("bag-open")?.setAttribute("aria-expanded", "false");
  });
  document.getElementById("bag-close").addEventListener("click", closeBag);
  document.getElementById("bag-body").addEventListener("click", onBagClick);
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const outside = (event) => {
      const rect = drawer.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    let pressedOutside = false;
    drawer.addEventListener("pointerdown", (event) => { pressedOutside = outside(event); });
    drawer.addEventListener("pointerup", (event) => {
      if (pressedOutside && outside(event)) drawer.close();
    });
  }
}

async function openBag() {
  ensureBag();
  const drawer = document.getElementById("bag-drawer");
  if (!drawer.open) drawer.showModal();
  document.getElementById("bag-open")?.setAttribute("aria-expanded", "true");
  await paintBag();
}

function closeBag() {
  document.getElementById("bag-open")?.setAttribute("aria-expanded", "false");
  document.getElementById("bag-drawer")?.close();
}

async function paintBag() {
  const body = document.getElementById("bag-body");
  const foot = document.getElementById("bag-foot");
  try {
    const cart = await api.cart();
    if (!cart.lines.length) {
      body.innerHTML = `<p class="lede">The bag is empty.</p>`;
      foot.innerHTML = `<a class="btn" href="./shop.html?cat=men">Shop</a>`;
      return;
    }
    body.innerHTML = cart.lines.map((line) => {
      const title = line.product?.title || "Piece";
      return `<article class="bag-line">
        <img src="${sized(line.product?.front, 240)}" alt="">
        <div>
          <strong>${esc(title)}</strong>
          <p>${esc(variantBits(line.product, line.variantId))}</p>
          <p>${money(line.lineTotal)}</p>
          <div class="qty">
            <button type="button" data-qty="-1" data-id="${esc(line.variantId)}" aria-label="Fewer ${esc(title)}">−</button>
            <span>${line.quantity}</span>
            <button type="button" data-qty="1" data-id="${esc(line.variantId)}" aria-label="More ${esc(title)}">+</button>
            <button type="button" data-remove="${esc(line.variantId)}">Remove</button>
          </div>
        </div>
      </article>`;
    }).join("");
    foot.innerHTML = `
      <p class="bag-total">Subtotal ${money(cart.total)}</p>
      <p class="bag-note" id="bag-note" role="status"></p>
      <a class="btn-ghost" href="./cart.html">View bag</a>
      <a class="btn" href="./checkout.html">Checkout</a>`;
  } catch (error) {
    body.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    foot.innerHTML = "";
  }
}

async function onBagClick(event) {
  const qty = event.target.closest("[data-qty]");
  const remove = event.target.closest("[data-remove]");
  if (!qty && !remove) return;
  const article = event.target.closest(".bag-line");
  const current = Number(article?.querySelector(".qty span")?.textContent || 1);
  const note = document.getElementById("bag-note");
  try {
    if (remove) await api.remove(remove.dataset.remove);
    else await api.setQty(qty.dataset.id, Math.max(0, current + Number(qty.dataset.qty)));
    await refreshChrome();
    await paintBag();
  } catch (error) {
    if (note) note.textContent = error.message;
  }
}

function bindBag() {
  document.getElementById("bag-open")?.addEventListener("click", () => {
    openBag();
  });
}

function bindStuckHeader() {
  const apply = () => {
    const header = document.querySelector(".site-header");
    if (!header) return;
    header.classList.toggle("is-stuck", window.scrollY > 12);
  };
  window.addEventListener("scroll", apply, { passive: true });
  apply();
}

function bindPasswordToggles(root = document) {
  root.querySelectorAll("[data-password-wrap]").forEach((wrap) => {
    const input = wrap.querySelector("input");
    const button = wrap.querySelector("[data-toggle-password]");
    if (!input || !button) return;
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

function bindMarquee() {
  const roots = [...document.querySelectorAll(".marquee")];
  if (!roots.length) return;

  const paint = () => {
    roots.forEach((root) => {
      const track = root.querySelector(".marquee-track");
      const first = track?.querySelector(".marquee-set");
      if (!track || !first) return;
      if (!first.dataset.unit) first.dataset.unit = first.innerHTML;
      first.innerHTML = first.dataset.unit;
      let guard = 0;
      while (first.offsetWidth < root.offsetWidth + 48 && guard++ < 8) {
        first.insertAdjacentHTML("beforeend", first.dataset.unit);
      }
      [...track.querySelectorAll(".marquee-set")].slice(1).forEach((node) => node.remove());
      track.append(first.cloneNode(true));
    });
  };

  paint();
  let timer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(paint, 120);
  });
}

function bindEditorialReveals() {
  const roots = [...document.querySelectorAll("[data-reveal]")];
  if (!roots.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const native = CSS.supports("(animation-timeline: view()) and (animation-range: entry)");
  if (reduce || native) {
    roots.forEach((root) => root.classList.add("is-revealed"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
  roots.forEach((root) => observer.observe(root));
}

document.addEventListener("DOMContentLoaded", () => {
  refreshChrome();
  bindStuckHeader();
  bindPasswordToggles();
  bindMarquee();
  bindEditorialReveals();
});

window.HAYUGEN = {
  money,
  api,
  addToCart,
  productByHandle,
  card,
  refreshChrome,
  openBag,
  session: () => session,
  esc,
  sized,
  variantBits,
  tenderLabel,
};
