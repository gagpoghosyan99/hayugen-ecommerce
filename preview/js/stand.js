(() => {
  const CLOTH = {
    Beige: { fill: "#cbb394", deep: "#9d7d55", hem: "#b89a74", hole: "#f4efe6" },
    Black: { fill: "#1a1917", deep: "#070706", hem: "#2c2a27", hole: "#f4efe6" },
    Brown: { fill: "#5d3b26", deep: "#3a2316", hem: "#714830", hole: "#f4efe6" },
  };

  const optionValue = (product, variant, name) => {
    const index = product.options.findIndex((option) => option.name === name);
    return variant[`option${index + 1}`];
  };

  const unique = (product, name) =>
    product.options.find((option) => option.name === name)?.values || [];

  const ink = (color) => (color === "Beige" ? "#3b2716" : "#f4ead8");

  const hangerMark = `
    <path fill="none" stroke="#b8975a" stroke-width="2.6" d="M110 22V4"/>
    <path fill="none" stroke="#b8975a" stroke-width="2.6" d="M110 4c0-12 18-12 18 3"/>
    <path fill="#7a5330" d="M28 58 110 28l82 30c2 .8 1.4 3.4-.8 3.4H29.2c-2.2 0-2.8-2.6-.8-3.4z"/>
    <path fill="#c0894e" d="M40 58h140L110 32z" opacity=".35"/>
  `;

  const frontMark = (color) => `
    <g fill="${ink(color)}" font-family="Georgia, serif">
      <text x="78" y="168" font-size="7" letter-spacing="2.1">HAYUGEN</text>
    </g>
  `;

  const saryanPrint = (color) => `
    <g transform="translate(67 132)">
      <rect width="30" height="84" fill="#c2582a"/>
      <path d="M0 58 Q15 36 30 56 V84 H0Z" fill="#2f4a32"/>
      <circle cx="16" cy="20" r="7.5" fill="#e6b84a"/>
      <rect x="30" width="30" height="84" fill="#d7a24c"/>
      <path d="M30 64 L45 30 L60 62 V84 H30Z" fill="#4a3a28"/>
      <rect x="60" width="30" height="84" fill="#355572"/>
      <path d="M60 54 Q75 32 90 58 V84 H60Z" fill="#1f3346"/>
      <text x="45" y="100" text-anchor="middle" fill="${ink(color)}" font-size="5.4" letter-spacing="1.1" font-family="Georgia, serif">ENDURING SPIRIT</text>
    </g>
  `;

  const signalPrint = (color) => {
    const mark = ink(color);
    const cut = CLOTH[color]?.fill || CLOTH.Beige.fill;
    return `
      <g transform="translate(60 130)" fill="${mark}">
        <rect x="4" y="0" width="96" height="11"/>
        <rect x="10" y="2.5" width="6" height="6" fill="${cut}"/>
        <rect x="24" y="2.5" width="6" height="6" transform="rotate(45 27 5.5)" fill="${cut}"/>
        <rect x="42" y="2.5" width="6" height="6" fill="${cut}"/>
        <rect x="60" y="2.5" width="6" height="6" transform="rotate(45 63 5.5)" fill="${cut}"/>
        <rect x="78" y="2.5" width="6" height="6" fill="${cut}"/>
        <path d="M16 42c20-20 56-20 76 4-12 12-24 18-38 18S28 54 16 42Z"/>
        <rect x="4" y="70" width="96" height="9"/>
        <text x="52" y="100" text-anchor="middle" font-size="5.4" letter-spacing="1.2" font-family="Georgia, serif">A LEGACY OF</text>
      </g>
    `;
  };

  function pieceSvg(product, side, uid) {
    const cloth = CLOTH[product.color] || CLOTH.Beige;
    const print =
      side === "back"
        ? product.line.includes("Saryan")
          ? saryanPrint(product.color)
          : signalPrint(product.color)
        : frontMark(product.color);
    return `
      <svg class="piece-svg" data-side="${side}" viewBox="0 0 220 340" aria-hidden="true">
        <defs>
          <linearGradient id="fab-${uid}-${side}" x1="0" y1="0" x2="1" y2="0.12">
            <stop offset="0" stop-color="${cloth.deep}"/>
            <stop offset="0.45" stop-color="${cloth.fill}"/>
            <stop offset="1" stop-color="${cloth.deep}"/>
          </linearGradient>
        </defs>
        ${hangerMark}
        <path fill="url(#fab-${uid}-${side})" d="M50 74c16-16 40-24 60-24s44 8 60 24l38-10 16 30-40 20v196c0 8-148 8-148 0V118L-2 98 14 64Z"/>
        <ellipse cx="110" cy="64" rx="22" ry="10" fill="${cloth.hole}"/>
        <path d="M88 60c7 11 37 11 44 0" fill="none" stroke="${cloth.hem}" stroke-width="3" opacity=".55"/>
        <path fill="${cloth.hem}" opacity=".28" d="M76 118l6 198h8L84 122z"/>
        <path fill="${cloth.hem}" opacity=".18" d="M136 120l-5 196h9L146 124z"/>
        <path fill="${cloth.deep}" opacity=".3" d="M18 78l16 28-10 6-20-22z"/>
        <path fill="${cloth.deep}" opacity=".3" d="M202 78l-16 28 10 6 20-22z"/>
        <path fill="none" stroke="${cloth.hem}" stroke-width="2" opacity=".4" d="M70 318h80"/>
        ${print}
      </svg>
    `;
  }

  function mount() {
    const root = document.querySelector("[data-stand]");
    if (!root) return;
    const products = (window.HAYUGEN_CATALOG || []).filter((item) => item.category === "men");
    root.innerHTML = `
      <section class="atelier" aria-label="Clothing stand">
        <div class="atelier-copy">
          <p>The Salon · Yerevan</p>
          <h1>Hayugen</h1>
          <p>Hover a garment. Reverse it. Read the cloth.</p>
        </div>
        <div class="stand" id="stand">
          <span class="stand-dim"></span>
          <span class="stand-post stand-post-left"></span>
          <span class="stand-post stand-post-right"></span>
          <span class="stand-bar"></span>
          <span class="stand-foot stand-foot-left"></span>
          <span class="stand-foot stand-foot-right"></span>
          <span class="stand-floor"></span>
          <div class="rail" role="list">
            ${products
              .map(
                (product, index) => `
              <button class="garment" role="listitem" type="button" data-handle="${product.handle}" aria-label="${product.title}">
                <span class="piece" data-face="front">
                  ${pieceSvg(product, "front", index)}
                  ${pieceSvg(product, "back", index)}
                </span>
                <span class="garment-label">${product.title}</span>
              </button>
            `
              )
              .join("")}
          </div>
          <aside class="inspect" hidden>
            <button class="close-inspect" type="button" data-close>Close</button>
            <p class="page-kicker" data-line></p>
            <h2 data-title></h2>
            <p class="price" data-price></p>
            <h3>Material</h3>
            <p data-material></p>
            <h3>The print</h3>
            <p data-print></p>
            <h3>Size</h3>
            <div class="sizes" data-sizes></div>
            <div class="inspect-actions">
              <button class="face-btn" type="button" data-face="front" aria-pressed="true">Front</button>
              <button class="face-btn" type="button" data-face="back" aria-pressed="false">Rotate back</button>
              <button class="btn" type="button" data-add>Add to bag</button>
              <a class="btn-ghost" data-details href="#">Details</a>
            </div>
            <p class="status" data-status></p>
          </aside>
        </div>
      </section>
    `;

    const stand = root.querySelector("#stand");
    const inspect = root.querySelector(".inspect");
    let current = null;
    let face = "front";
    let selected = {};

    const open = (handle) => {
      current = productBy(handle);
      if (!current) return;
      selected = defaultOptions(current);
      face = "front";
      stand.classList.add("is-inspecting");
      root.querySelectorAll(".garment").forEach((node) => {
        node.classList.toggle("is-open", node.dataset.handle === handle);
        const piece = node.querySelector(".piece");
        if (piece) piece.dataset.face = "front";
      });
      inspect.hidden = false;
      inspect.classList.add("is-open");
      inspect.querySelector("[data-line]").textContent = current.line;
      inspect.querySelector("[data-title]").textContent = current.title;
      inspect.querySelector("[data-price]").textContent = window.HAYUGEN.money(current.price);
      inspect.querySelector("[data-material]").textContent = current.material;
      inspect.querySelector("[data-print]").textContent = current.print;
      inspect.querySelector("[data-details]").href = `./product.html?handle=${current.handle}`;
      inspect.querySelector("[data-status]").textContent = "";
      renderSizes();
      inspect.querySelectorAll("[data-face]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.face === "front"));
      });
    };

    const close = () => {
      stand.classList.remove("is-inspecting");
      root.querySelectorAll(".garment").forEach((node) => node.classList.remove("is-open"));
      inspect.classList.remove("is-open");
      inspect.hidden = true;
      current = null;
    };

    const renderSizes = () => {
      const sizes = unique(current, "Size");
      inspect.querySelector("[data-sizes]").innerHTML = sizes
        .map((size) => {
          const available = current.variants.some((variant) => variant.available && optionValue(current, variant, "Size") === size);
          return `<button class="size-btn" type="button" data-size="${size}" aria-pressed="${selected.Size === size}" ${available ? "" : "disabled"}>${size}</button>`;
        })
        .join("");
    };

    const setFace = (next) => {
      const piece = root.querySelector(".garment.is-open .piece");
      if (!piece || face === next) return;
      piece.classList.add("is-turning");
      window.setTimeout(() => {
        face = next;
        piece.dataset.face = next;
        piece.classList.remove("is-turning");
        inspect.querySelectorAll("[data-face]").forEach((button) => {
          button.setAttribute("aria-pressed", String(button.dataset.face === next));
        });
      }, 260);
    };

    const currentVariant = () =>
      current.variants.find((variant) =>
        current.options.every((option) => {
          if (option.name === "Fabric") return true;
          return optionValue(current, variant, option.name) === selected[option.name];
        })
      );

    let hoverTimer = 0;
    root.querySelector(".rail").addEventListener("mouseover", (event) => {
      const garment = event.target.closest(".garment");
      if (!garment || !window.matchMedia("(hover: hover)").matches) return;
      if (stand.classList.contains("is-inspecting") && garment.classList.contains("is-open")) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => open(garment.dataset.handle), stand.classList.contains("is-inspecting") ? 280 : 160);
    });

    root.addEventListener("click", (event) => {
      const garment = event.target.closest(".garment");
      if (garment) open(garment.dataset.handle);
      if (event.target.closest("[data-close]")) close();
      const size = event.target.closest("[data-size]");
      if (size && !size.disabled) {
        selected.Size = size.dataset.size;
        renderSizes();
      }
      const faceBtn = event.target.closest("[data-face]");
      if (faceBtn) setFace(faceBtn.dataset.face);
      if (event.target.closest("[data-add]") && current) {
        const variant = currentVariant();
        if (!variant?.available) return;
        window.HAYUGEN.addToCart(variant.id, current.handle, 1)
          .then(() => { inspect.querySelector("[data-status]").textContent = "Added to bag"; })
          .catch((error) => { inspect.querySelector("[data-status]").textContent = error.message; });
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function productBy(handle) {
    return (window.HAYUGEN_CATALOG || []).find((item) => item.handle === handle);
  }

  function defaultOptions(product) {
    const options = {};
    product.options.forEach((option) => {
      options[option.name] = option.values[0];
    });
    return options;
  }

  document.addEventListener("DOMContentLoaded", mount);
})();
