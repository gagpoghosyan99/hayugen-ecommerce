(() => {
  const MONEY_FALLBACK = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AMD",
    maximumFractionDigits: 0,
  });

  const hangerSvg = `
    <svg class="cr-item__hanger" viewBox="0 0 120 36" aria-hidden="true">
      <path fill="currentColor" d="M60 3.2c4.2 0 7.4 3.1 7.4 7 0 2.6-1.5 4.8-3.8 6l 38.2 12.4c3.2 1 2.6 5.4-1.1 5.4H19.3c-3.7 0-4.3-4.4-1.1-5.4L56.4 16.2c-2.3-1.2-3.8-3.4-3.8-6 0-3.9 3.2-7 7.4-7z"/>
      <circle cx="60" cy="9.4" r="2.1" fill="#3d2a1a"/>
    </svg>
  `;

  class HayugenClothingRail extends HTMLElement {
    connectedCallback() {
      this.init();
    }

    init() {
      this.root = this.querySelector(".cr");
      if (!this.root) return;
      this.rail = this.querySelector(".cr-rail");
      this.focusRoot = this.querySelector(".cr-focus");
      this.products = this.readProducts();
      this.mode = "rail";
      this.selectedId = null;
      this.face = "back";
      this.cartBusy = false;
      this.bind();
      this.prepareEntrance();
    }

    readProducts() {
      const node = this.querySelector("[data-rail-products]");
      if (!node) return [];
      try {
        const data = JSON.parse(node.textContent);
        return Array.isArray(data) ? data : data.products || [];
      } catch {
        return [];
      }
    }

    productById(id) {
      return this.products.find((product) => String(product.id) === String(id));
    }

    bind() {
      if (this.bound) return;
      this.bound = true;
      this.items = [...this.querySelectorAll(".cr-item")];
      this.items.forEach((item, index) => {
        item.style.setProperty("--cr-delay", `${index * 70}ms`);
        item.addEventListener("pointerenter", () => this.onHover(item, true));
        item.addEventListener("pointerleave", () => this.onHover(item, false));
        item.addEventListener("focus", () => this.onHover(item, true));
        item.addEventListener("blur", () => this.onHover(item, false));
        item.addEventListener("click", () => this.select(item.dataset.productId));
      });

      this.querySelector("[data-rail-back]")?.addEventListener("click", () => this.returnToRail());
      this.querySelector("[data-rail-add]")?.addEventListener("click", () => this.addToCart());
      this.querySelectorAll("[data-rail-face]").forEach((button) => {
        button.addEventListener("click", () => this.setFace(button.dataset.railFace));
      });
      this.focusRoot?.addEventListener("click", (event) => {
        const size = event.target.closest("[data-size]");
        const color = event.target.closest("[data-color]");
        if (size && !size.disabled) this.setOption("Size", size.dataset.size);
        if (color && !color.disabled) this.setOption("Color", color.dataset.color);
      });

      this.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.mode === "focus") {
          event.preventDefault();
          this.returnToRail();
        }
        if (this.mode !== "rail") return;
        const current = document.activeElement?.closest?.(".cr-item");
        if (!current) return;
        const index = this.items.indexOf(current);
        if (event.key === "ArrowRight") this.items[Math.min(this.items.length - 1, index + 1)]?.focus();
        if (event.key === "ArrowLeft") this.items[Math.max(0, index - 1)]?.focus();
      });

      window.addEventListener("popstate", () => {
        const handle = location.hash.replace("#look/", "");
        if (handle) {
          const product = this.products.find((item) => item.handle === handle);
          if (product) this.select(product.id, { history: false });
        } else if (this.mode === "focus") {
          this.returnToRail({ history: false });
        }
      });
    }

    prepareEntrance() {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => {
        this.items.forEach((item, index) => {
          item.style.transitionDelay = reduce ? "0ms" : `${index * 70}ms`;
        });
        this.root?.classList.add("is-ready");
      });
    }

    onHover(item, active) {
      if (this.mode !== "rail") return;
      this.items.forEach((node) => node.classList.remove("is-hovered", "is-neighbor-left", "is-neighbor-right"));
      if (!active) return;
      item.classList.add("is-hovered");
      const index = this.items.indexOf(item);
      this.items[index - 1]?.classList.add("is-neighbor-left");
      this.items[index + 1]?.classList.add("is-neighbor-right");
    }

    update(mutator) {
      const apply = () => mutator();
      if (document.startViewTransition && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
        document.documentElement.style.viewTransitionName = "none";
        return document.startViewTransition(apply);
      }
      apply();
      return null;
    }

    select(productId, { history = true } = {}) {
      const product = this.productById(productId);
      if (!product) return;
      const item = this.items.find((node) => node.dataset.productId === String(productId));
      this.items.forEach((node) => {
        node.classList.toggle("is-selected", node === item);
        node.style.setProperty("--cr-vt", node === item ? "cr-garment" : "none");
      });
      this.selectedId = String(product.id);
      this.face = "back";
      this.selectedOptions = this.defaultOptions(product);
      this.update(() => {
        this.mode = "focus";
        this.root.dataset.mode = "focus";
        this.focusRoot?.setAttribute("aria-hidden", "false");
        this.renderFocus(product);
      });
      if (history) {
        const next = `#look/${product.handle}`;
        if (location.hash !== next) history.pushState({ rail: product.handle }, "", next);
      }
      this.querySelector("[data-rail-back]")?.focus();
    }

    returnToRail({ history = true } = {}) {
      this.update(() => {
        this.mode = "rail";
        this.root.dataset.mode = "rail";
        this.focusRoot?.setAttribute("aria-hidden", "true");
        this.items.forEach((node) => {
          node.classList.remove("is-selected", "is-hovered", "is-neighbor-left", "is-neighbor-right");
          node.style.setProperty("--cr-vt", "none");
        });
      });
      const selected = this.items.find((node) => node.dataset.productId === this.selectedId);
      if (selected) {
        const product = this.productById(this.selectedId);
        const img = selected.querySelector(".cr-item__img");
        if (img && product) img.src = this.imageFor(product, "back");
      }
      this.selectedId = null;
      if (history && location.hash.startsWith("#look/")) {
        history.pushState({ rail: null }, "", location.pathname + location.search);
      }
      selected?.focus();
    }

    defaultOptions(product) {
      const options = {};
      (product.options || []).forEach((option) => {
        const first = this.firstAvailableValue(product, option.name);
        options[option.name] = first || option.values?.[0];
      });
      return options;
    }

    firstAvailableValue(product, name) {
      const variant = product.variants.find((item) => item.available);
      if (!variant) return null;
      if (name === "Size") return variant.option1?.match(/^(S|M|L|XL)$/) ? variant.option1 : this.optionValue(variant, name, product);
      return this.optionValue(variant, name, product);
    }

    optionValue(variant, name, product) {
      const index = (product.options || []).findIndex((option) => option.name === name);
      return variant[`option${index + 1}`];
    }

    currentVariant(product) {
      return product.variants.find((variant) =>
        (product.options || []).every((option) => {
          if (option.name === "Fabric") return true;
          return this.optionValue(variant, option.name, product) === this.selectedOptions[option.name];
        })
      );
    }

    setOption(name, value) {
      const product = this.productById(this.selectedId);
      if (!product) return;
      this.selectedOptions[name] = value;
      this.renderFocus(product);
    }

    setFace(face) {
      this.face = face;
      const product = this.productById(this.selectedId);
      const item = this.items.find((node) => node.dataset.productId === this.selectedId);
      const src = this.imageFor(product, face);
      const img = item?.querySelector(".cr-item__img");
      if (img && src) img.src = src;
      this.querySelectorAll("[data-rail-face]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.railFace === face));
      });
    }

    imageFor(product, face) {
      if (!product?.images?.length) return "";
      if (face === "front" && product.images[1]) return this.cdn(product.images[1], 900);
      return this.cdn(product.images[0], 900);
    }

    cdn(url, width) {
      if (!url) return "";
      const absolute = url.startsWith("//") ? `https:${url}` : url;
      return absolute.includes("cdn.shopify.com") ? `${absolute}${absolute.includes("?") ? "&" : "?"}width=${width}` : absolute;
    }

    displayTitle(title) {
      return (title || "").split("|")[0].trim();
    }

    formatMoney(product, variant) {
      if (variant?.price_formatted) return variant.price_formatted;
      if (product.price_formatted && !variant) return product.price_formatted;
      const cents = Number(variant?.price ?? product.price ?? 0);
      if (window.Shopify?.theme?.moneyFormat || this.dataset.moneyFormat) {
        return this.legacyMoney(cents);
      }
      return MONEY_FALLBACK.format(cents / 100);
    }

    legacyMoney(cents) {
      const format = this.dataset.moneyFormat || "{{amount}}";
      const whole = Math.round(cents / 100).toLocaleString("en-US");
      const amount = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return format.replace("{{amount_no_decimals}}", whole).replace("{{amount}}", amount);
    }

    renderFocus(product) {
      const variant = this.currentVariant(product) || product.variants.find((item) => item.available) || product.variants[0];
      this.querySelector("[data-rail-title]").textContent = this.displayTitle(product.title);
      this.querySelector("[data-rail-price]").textContent = this.formatMoney(product, variant);
      const stock = this.querySelector("[data-rail-stock]");
      const available = Boolean(variant?.available);
      stock.textContent = available ? this.dataset.inStockLabel || "In stock" : this.dataset.soldOutLabel || "Sold out";
      stock.dataset.state = available ? "instock" : "soldout";

      const sizes = this.uniqueOption(product, "Size");
      const colors = this.uniqueOption(product, "Color");
      this.renderChoices("[data-rail-sizes]", sizes, "size", "Size");
      this.renderChoices("[data-rail-colors]", colors, "color", "Color");
      this.querySelector("[data-rail-colors-wrap]").hidden = colors.length <= 1;
      this.querySelector("[data-rail-add]").disabled = !available;
      const details = this.querySelector("[data-rail-details]");
      if (details) details.href = product.url;
      this.setFace(this.face);
    }

    uniqueOption(product, name) {
      const option = (product.options || []).find((item) => item.name === name);
      return option?.values || [];
    }

    renderChoices(selector, values, kind, optionName) {
      const root = this.querySelector(selector);
      if (!root) return;
      root.innerHTML = values
        .map((value) => {
          const available = this.productsOptionAvailable(this.productById(this.selectedId), optionName, value);
          const pressed = this.selectedOptions[optionName] === value;
          return `<button type="button" class="cr-${kind}" data-${kind}="${this.escape(value)}" aria-pressed="${pressed}" ${available ? "" : "disabled"}>${this.escape(value)}</button>`;
        })
        .join("");
    }

    productsOptionAvailable(product, name, value) {
      return product.variants.some((variant) => variant.available && this.optionValue(variant, name, product) === value);
    }

    escape(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll('"', "&quot;");
    }

    async addToCart() {
      const product = this.productById(this.selectedId);
      const variant = this.currentVariant(product);
      const status = this.querySelector("[data-rail-status]");
      if (!product || !variant || !variant.available || this.cartBusy) return;
      this.cartBusy = true;
      this.querySelector("[data-rail-add]").disabled = true;
      status.textContent = this.dataset.addingLabel || "Adding…";
      try {
        if (window.HAYUGEN?.addToCart) {
          await window.HAYUGEN.addToCart(variant.id, product.handle, 1);
          status.textContent = this.dataset.addedLabel || "In the bag";
          return;
        }
        if (this.dataset.preview === "true") {
          const cart = JSON.parse(localStorage.getItem("hayugen-preview-cart") || "[]");
          cart.push({ id: variant.id, title: product.title, quantity: 1 });
          localStorage.setItem("hayugen-preview-cart", JSON.stringify(cart));
          status.textContent = `Added · ${cart.length} in preview cart`;
          return;
        }
        const root = window.Shopify?.routes?.root || "/";
        const response = await fetch(`${root}cart/add.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: [{ id: variant.id, quantity: 1 }] }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.description || "Unable to add to cart");
        }
        const cart = await response.json();
        this.refreshThemeCart(cart);
        status.textContent = this.dataset.addedLabel || "Added to cart";
      } catch (error) {
        status.textContent = error.message || "Could not add to cart";
      } finally {
        this.cartBusy = false;
        const variantNow = this.currentVariant(product);
        this.querySelector("[data-rail-add]").disabled = !variantNow?.available;
      }
    }

    refreshThemeCart(cart) {
      document.documentElement.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
      document.dispatchEvent(new CustomEvent("cart:updated", { bubbles: true, detail: { cart } }));
      if (typeof publish === "function" && typeof PUB_SUB_EVENTS !== "undefined") {
        publish(PUB_SUB_EVENTS.cartUpdate, { source: "clothing-rail-hero", cartData: cart });
      }
      const drawer = document.querySelector("cart-drawer");
      if (drawer) {
        if (typeof drawer.open === "function") drawer.open();
        drawer.classList.add("active");
        drawer.removeAttribute("hidden");
      }
      const toggle = document.querySelector("[data-cart-toggle], .header__icon--cart, #cart-icon-bubble");
      toggle?.click?.();
    }
  }

  if (!customElements.get("hayugen-clothing-rail")) {
    customElements.define("hayugen-clothing-rail", HayugenClothingRail);
  }

  window.HayugenClothingRailHanger = hangerSvg;
})();
