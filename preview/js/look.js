(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const DURATION = reduce ? 1 : 680;

  function byHandle(handle) {
    return (window.HAYUGEN_CATALOG || []).find((item) => item.handle === handle);
  }

  function looks() {
    const pick = (...handles) => handles.map(byHandle).filter(Boolean);
    const figures = [
      {
        src: "./img/look/look-02.png",
        products: pick(
          "hayugen-heritage-grid-t-shirt-armenian-streetwear-copy",
          "hayugen-heritage-signal-cap-armenian-streetwear-copy"
        ),
      },
      {
        src: "./img/look/look-05.png",
        products: pick(
          "saryan-beige-t-shirt-armenian-art-streetwear-hayugen-copy",
          "hayugen-heritage-signal-cap-armenian-streetwear-copy"
        ),
      },
      {
        src: "./img/look/look-01.png",
        products: pick(
          "hayugen-heritage-grid-t-shirt-armenian-streetwear",
          "hayugen-heritage-signal-cap-armenian-streetwear"
        ),
      },
      {
        src: "./img/look/look-03.png",
        products: pick(
          "saryan-black-t-shirt-armenian-art-streetwear-hayugen-copy",
          "hayugen-heritage-signal-cap-armenian-streetwear"
        ),
      },
      {
        src: "./img/look/look-04.png",
        products: pick("hayugen-heritage-signal-t-shirt-armenian-streetwear"),
      },
      {
        src: "./img/look/look-06.png",
        products: pick("saryan-black-t-shirt-armenian-art-streetwear-hayugen-copy"),
      },
    ];
    return figures.map((item, index) => ({
      src: item.src,
      name: `The Look 0${index + 1}`,
      copy: item.products[0]?.print || item.products[0]?.material || "",
      products: item.products,
    }));
  }

  function optionValue(product, variant, name) {
    const index = product.options.findIndex((option) => option.name === name);
    return variant[`option${index + 1}`];
  }

  function pose(slot) {
    const w = window.innerWidth;
    const phone = w < 700;
    const tablet = w < 1100;
    const max = phone ? 1 : 2;
    const abs = Math.abs(slot);
    const dir = Math.sign(slot);
    let dist = 0;
    if (abs === 1) dist = w * (phone ? 0.3 : tablet ? 0.205 : 0.222);
    else if (abs >= 2) dist = w * (tablet ? 0.365 : 0.378);
    const hidden = abs > max;
    return {
      x: dir * dist,
      y: 0,
      scale: abs === 0 ? 1.05 : abs === 1 ? (phone ? 0.88 : 0.9) : 0.78,
      opacity: hidden ? 0 : abs === 0 ? 1 : abs === 1 ? 1 : 0.9,
      blur: reduce || abs === 0 ? 0 : abs === 1 ? 0.35 : 2.8,
      z: hidden ? 0 : 24 - abs * 6,
      hidden,
    };
  }

  function transformOf(p) {
    return `translate3d(calc(-50% + ${p.x}px), ${p.y}px, 0) scale(${p.scale})`;
  }

  function wheelDelta(event) {
    let y = event.deltaY;
    if (event.deltaMode === 1) y *= 16;
    if (event.deltaMode === 2) y *= window.innerHeight;
    return y;
  }

  function mount() {
    const root = document.querySelector("[data-look]");
    if (!root) return;
    const items = looks();
    const count = items.length;
    const abort = new AbortController();
    const { signal } = abort;

    let center = 2;
    let busy = false;
    let acc = 0;
    let locked = 0;
    let coolUntil = 0;
    let inView = true;
    let photo = 0;
    let activeHandle = "";
    let selected = {};
    let lastFocus = null;

    root.innerHTML = `
      <section class="look-hero" id="look">
        <h1 class="visually-hidden">HAYUGEN</h1>
        <div class="look-studio" aria-hidden="true">
          <span class="look-studio-window"></span>
          <span class="look-studio-floor"></span>
        </div>
        <div class="look-stage" tabindex="0" aria-label="Runway looks">
          ${items.map((item, index) => `
            <article class="look-person" data-index="${index}" data-label="${item.name}" aria-label="${item.name}">
              <img src="${item.src}?v=14" alt="${item.name}" width="360" height="1124" ${index === 2 ? 'fetchpriority="high"' : 'fetchpriority="low"'}>
            </article>
          `).join("")}
        </div>
        <button class="look-step prev" type="button" data-step="-1" aria-label="Previous look">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.25 6.75 8.75 12l5.5 5.25"/></svg>
        </button>
        <button class="look-step next" type="button" data-step="1" aria-label="Next look">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.75 6.75 15.25 12l-5.5 5.25"/></svg>
        </button>
        <ol class="look-dots">
          ${items.map((_, index) => `<li><button type="button" data-dot="${index}" aria-label="Look ${index + 1}"></button></li>`).join("")}
          <li class="look-dots-label">Runway</li>
        </ol>
      </section>
      <div class="look-veil" data-veil hidden></div>
      <aside class="look-drawer" role="dialog" aria-modal="true" aria-labelledby="look-drawer-title" hidden>
        <button class="look-drawer-close" type="button" data-close aria-label="Close">×</button>
        <div class="look-gallery">
          <img class="look-gallery-main" data-hero alt="">
          <button class="look-gallery-nav prev" type="button" data-photo="-1" aria-label="Previous photo">‹</button>
          <button class="look-gallery-nav next" type="button" data-photo="1" aria-label="Next photo">›</button>
        </div>
        <div class="look-thumbs" data-thumbs></div>
        <div class="look-drawer-body">
          <h2 id="look-drawer-title" data-title></h2>
          <p class="look-lede" data-copy></p>
          <div data-cards></div>
          <div class="look-detail" data-detail hidden></div>
          <p class="look-status" data-status></p>
        </div>
      </aside>
    `;

    const hero = root.querySelector(".look-hero");
    const stage = root.querySelector(".look-stage");
    const people = [...stage.querySelectorAll(".look-person")];
    const dots = [...root.querySelectorAll("[data-dot]")];
    const prevBtn = root.querySelector("[data-step='-1']");
    const nextBtn = root.querySelector("[data-step='1']");
    const drawer = root.querySelector(".look-drawer");
    const veil = root.querySelector(".look-veil");

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.intersectionRatio > 0.55;
    }, { threshold: [0.35, 0.55, 0.8] });
    io.observe(hero);
    signal.addEventListener("abort", () => io.disconnect());

    function apply(el, next, isCenter) {
      el.style.transform = transformOf(next);
      el.style.opacity = String(next.opacity);
      el.style.zIndex = String(next.z);
      el.style.pointerEvents = next.hidden ? "none" : "auto";
      el.style.visibility = next.hidden ? "hidden" : "visible";
      const img = el.querySelector("img");
      img.getAnimations().forEach((animation) => animation.cancel());
      img.style.filter = "";
      img.style.setProperty("--look-blur", `${next.blur}px`);
      el.classList.toggle("is-center", isCenter);
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", isCenter
        ? `${el.dataset.label}. Open details`
        : `${el.dataset.label}. Show this look`);
    }

    const sole = [0, 0, 0, 2, 0, 0];

    function layout() {
      people.forEach((person) => {
        const index = Number(person.dataset.index);
        const slot = index - center;
        const next = { ...pose(slot), y: sole[index] || 0 };
        const isCenter = slot === 0;
        apply(person, next, isCenter);
        if (isCenter) person.setAttribute("aria-current", "true");
        else person.removeAttribute("aria-current");
      });
      dots.forEach((dot, index) => dot.classList.toggle("is-on", index === center));
      if (prevBtn) prevBtn.disabled = center === 0;
      if (nextBtn) nextBtn.disabled = center === count - 1;
      preload(center);
    }

    function preload(index) {
      [index - 1, index, index + 1].forEach((i) => {
        if (!items[i]) return;
        const img = people[i]?.querySelector("img");
        if (img) {
          img.loading = "eager";
          img.fetchPriority = i === index ? "high" : "low";
        }
      });
    }

    function galleryOf(index) {
      const look = items[index];
      const shots = [{ src: look.src, alt: look.name }];
      look.products.forEach((product) => {
        [product.front, product.back, ...(product.images || []).slice(0, 2)].forEach((src) => {
          if (src && !shots.some((shot) => shot.src === src)) {
            shots.push({ src: `${src}${src.includes("?") ? "&" : "?"}width=900`, alt: product.title });
          }
        });
      });
      return shots;
    }

    async function goTo(nextCenter) {
      nextCenter = Math.max(0, Math.min(count - 1, nextCenter));
      if (busy || nextCenter === center) return false;
      const dir = Math.sign(nextCenter - center);
      busy = true;
      const runs = [];
      people.forEach((person) => {
        const index = Number(person.dataset.index);
        const fromSlot = index - center;
        const toSlot = index - nextCenter;
        const from = { ...pose(fromSlot), y: sole[index] || 0 };
        const to = { ...pose(toSlot), y: sole[index] || 0 };
        const leaving = fromSlot === 0;
        const incoming = toSlot === 0;
        person.style.zIndex = String(incoming ? 28 : leaving ? 18 : to.z);
        person.style.visibility = to.hidden && from.hidden ? "hidden" : "visible";
        person.style.pointerEvents = "none";
        person.classList.toggle("is-center", incoming);
        const walk = leaving || incoming
          ? [
              { transform: transformOf(from), opacity: from.opacity, offset: 0 },
              { transform: transformOf({
                ...from,
                x: from.x + (to.x - from.x) * 0.4 - dir * 12,
                scale: from.scale + (to.scale - from.scale) * 0.36,
              }), opacity: from.opacity + (to.opacity - from.opacity) * 0.32, offset: 0.36 },
              { transform: transformOf(to), opacity: to.opacity },
            ]
          : [
              { transform: transformOf(from), opacity: from.opacity },
              { transform: transformOf(to), opacity: to.opacity },
            ];
        runs.push(person.animate(walk, { duration: DURATION, easing: EASE, fill: "forwards" }));
        const img = person.querySelector("img");
        if (from.blur !== to.blur) {
          const shade = "saturate(1.06) contrast(1.04) drop-shadow(0 16px 12px rgb(64 46 32 / 16%)) drop-shadow(0 32px 34px rgb(64 46 32 / 10%))";
          runs.push(img.animate(
            [
              { filter: `blur(${from.blur}px) ${shade}` },
              { filter: `blur(${to.blur}px) ${shade}` },
            ],
            { duration: DURATION, easing: EASE, fill: "forwards" }
          ));
        }
      });
      await Promise.all(runs.map((run) => run.finished.catch(() => {})));
      people.forEach((person) => {
        person.getAnimations().forEach((animation) => {
          animation.commitStyles?.();
          animation.cancel();
        });
      });
      center = nextCenter;
      layout();
      busy = false;
      coolUntil = performance.now() + 160;
      return true;
    }

    function step(dir) {
      return goTo(center + dir);
    }

    function renderDetail(product) {
      const box = drawer.querySelector("[data-detail]");
      if (!product) {
        box.hidden = true;
        box.innerHTML = "";
        return;
      }
      activeHandle = product.handle;
      selected = {};
      product.options.forEach((option) => { selected[option.name] = option.values[0]; });
      const colors = product.options.find((option) => option.name === "Color")?.values || [];
      const sizes = product.options.find((option) => option.name === "Size")?.values || [];
      box.hidden = false;
      box.innerHTML = `
        ${product.material ? `<h3>Material</h3><p>${product.material}</p>` : ""}
        ${product.print ? `<h3>The print</h3><p>${product.print}</p>` : ""}
        ${colors.length ? `<h3>Color</h3><div class="look-swatches">${colors.map((color) =>
          `<button class="look-swatch" type="button" data-opt="Color" data-val="${color}" aria-pressed="${selected.Color === color}">${color}</button>`
        ).join("")}</div>` : ""}
        ${sizes.length ? `<h3>Size</h3><div class="look-sizes">${sizes.map((size) => {
          const ok = product.variants.some((variant) => variant.available && optionValue(product, variant, "Size") === size);
          return `<button class="look-size" type="button" data-opt="Size" data-val="${size}" aria-pressed="${selected.Size === size}" ${ok ? "" : "disabled"}>${size}</button>`;
        }).join("")}</div>` : ""}
        <p>${window.HAYUGEN.money(product.price)}${product.available ? "" : " · Unavailable"}</p>
        <button class="btn" type="button" data-add ${product.available ? "" : "disabled"}>Add to cart</button>
        <a class="btn-ghost" href="./product.html?handle=${encodeURIComponent(product.handle)}">View product</a>
      `;
    }

    function renderDrawer() {
      const look = items[center];
      const shots = galleryOf(center);
      photo = Math.min(photo, shots.length - 1);
      drawer.querySelector("[data-title]").textContent = look.name;
      drawer.querySelector("[data-copy]").textContent = look.copy;
      drawer.querySelector("[data-status]").textContent = "";
      const heroImg = drawer.querySelector("[data-hero]");
      heroImg.src = shots[photo].src;
      heroImg.alt = shots[photo].alt;
      drawer.querySelector("[data-thumbs]").innerHTML = shots.map((shot, index) =>
        `<button type="button" data-thumb="${index}" class="${index === photo ? "is-on" : ""}"><img src="${shot.src}" alt=""></button>`
      ).join("");
      drawer.querySelector("[data-cards]").innerHTML = look.products.map((product) => `
        <button class="look-card${product.handle === activeHandle ? " is-on" : ""}" type="button" data-card="${product.handle}">
          <img src="${product.front}&width=240" alt="">
          <div>
            <strong>${product.title}</strong>
            <span>${window.HAYUGEN.money(product.price)}</span>
          </div>
          <span class="look-card-go" aria-hidden="true">→</span>
        </button>
      `).join("");
      if (!activeHandle && look.products[0]) renderDetail(look.products[0]);
      else renderDetail(byHandle(activeHandle) || look.products[0]);
    }

    function setPhoto(next) {
      const shots = galleryOf(center);
      photo = (next + shots.length) % shots.length;
      const heroImg = drawer.querySelector("[data-hero]");
      heroImg.src = shots[photo].src;
      heroImg.alt = shots[photo].alt;
      drawer.querySelectorAll("[data-thumb]").forEach((thumb) => {
        thumb.classList.toggle("is-on", Number(thumb.dataset.thumb) === photo);
      });
    }

    function openDrawer() {
      lastFocus = document.activeElement;
      photo = 0;
      activeHandle = items[center].products[0]?.handle || "";
      renderDrawer();
      veil.hidden = false;
      drawer.hidden = false;
      requestAnimationFrame(() => {
        veil.classList.add("is-on");
        drawer.classList.add("is-open");
      });
      document.body.classList.add("look-locked");
      stage.inert = true;
      drawer.querySelector("[data-close]").focus();
    }

    function closeDrawer() {
      veil.classList.remove("is-on");
      drawer.classList.remove("is-open");
      document.body.classList.remove("look-locked");
      stage.inert = false;
      const finish = () => {
        if (drawer.classList.contains("is-open")) return;
        drawer.hidden = true;
        veil.hidden = true;
      };
      const anims = [...drawer.getAnimations(), ...veil.getAnimations()];
      if (anims.length) Promise.allSettled(anims.map((a) => a.finished)).then(finish);
      else finish();
      lastFocus?.focus?.();
    }

    function currentVariant(product) {
      return product.variants.find((variant) =>
        product.options.every((option) => {
          if (option.name === "Fabric") return true;
          return optionValue(product, variant, option.name) === selected[option.name];
        })
      );
    }

    function fitStage() {
      const header = document.querySelector(".site-header");
      const hh = header ? Math.round(header.getBoundingClientRect().height) : 82;
      hero.style.height = `calc(100dvh - ${hh}px)`;
    }

    fitStage();
    layout();

    function onWheel(event) {
      if (!inView || document.body.classList.contains("look-locked")) return;
      const y = wheelDelta(event);
      const sign = Math.sign(y);
      if (Math.abs(y) < 1.6) {
        locked = 0;
        acc = 0;
        return;
      }
      const out = (center === 0 && y < 0) || (center === count - 1 && y > 0);
      if (out && !busy) return;
      event.preventDefault();
      if (busy || performance.now() < coolUntil) return;
      if (locked && sign === locked) return;
      if (locked && sign !== locked) {
        locked = 0;
        acc = 0;
      }
      acc += y;
      if (acc > 72) {
        step(1);
        acc = 0;
        locked = 1;
      } else if (acc < -72) {
        step(-1);
        acc = 0;
        locked = -1;
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false, signal });

    let touchX = 0;
    let touchY = 0;
    let touching = false;
    let swiped = false;
    stage.addEventListener("pointerdown", (event) => {
      if (document.body.classList.contains("look-locked")) return;
      touching = true;
      swiped = false;
      touchX = event.clientX;
      touchY = event.clientY;
    }, { signal });
    stage.addEventListener("pointerup", (event) => {
      if (!touching) return;
      touching = false;
      const dx = touchX - event.clientX;
      const dy = touchY - event.clientY;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swiped = true;
        step(dx > 0 ? 1 : -1);
      }
    }, { signal });
    stage.addEventListener("pointercancel", () => { touching = false; }, { signal });
    function personFromPoint(clientX, clientY) {
      const centerEl = people[center];
      const cRect = centerEl.getBoundingClientRect();
      const cMid = cRect.left + cRect.width / 2;
      const cCol = Math.max(72, cRect.width * 0.34);
      if (clientY >= cRect.top && clientY <= cRect.bottom && Math.abs(clientX - cMid) <= cCol) {
        return centerEl;
      }
      let best = null;
      let bestDist = Infinity;
      for (const person of people) {
        if (person.style.visibility === "hidden") continue;
        const rect = person.getBoundingClientRect();
        if (clientY < rect.top || clientY > rect.bottom) continue;
        const mid = rect.left + rect.width / 2;
        const col = person === centerEl
          ? cCol
          : Math.max(64, rect.width * 0.48);
        const dist = Math.abs(clientX - mid);
        if (dist > col) continue;
        if (dist < bestDist) {
          bestDist = dist;
          best = person;
        }
      }
      return best;
    }

    stage.addEventListener("click", (event) => {
      if (swiped) {
        swiped = false;
        return;
      }
      const person = personFromPoint(event.clientX, event.clientY);
      if (!person || busy) return;
      const index = Number(person.dataset.index);
      if (index === center) openDrawer();
      else goTo(index);
    }, { signal });

    stage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") { step(1); event.preventDefault(); }
      if (event.key === "ArrowLeft") { step(-1); event.preventDefault(); }
      if (event.key === "Enter" || event.key === " ") {
        openDrawer();
        event.preventDefault();
      }
    }, { signal });

    window.addEventListener("keydown", (event) => {
      if (!inView || document.body.classList.contains("look-locked")) return;
      if (event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.target.closest(".look-drawer, .look-stage")) return;
      if (event.key === "ArrowRight") { step(1); event.preventDefault(); }
      if (event.key === "ArrowLeft") { step(-1); event.preventDefault(); }
    }, { signal });

    root.querySelector(".look-dots").addEventListener("click", (event) => {
      const dot = event.target.closest("[data-dot]");
      if (!dot || busy) return;
      const target = Number(dot.dataset.dot);
      goTo(target);
    }, { signal });

    root.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        step(Number(button.dataset.step));
      }, { signal });
    });

    veil.addEventListener("click", closeDrawer, { signal });
    drawer.addEventListener("click", async (event) => {
      if (event.target.closest("[data-close]")) { closeDrawer(); return; }
      if (event.target.closest("[data-photo]")) {
        setPhoto(photo + Number(event.target.closest("[data-photo]").dataset.photo));
        return;
      }
      const thumb = event.target.closest("[data-thumb]");
      if (thumb) { setPhoto(Number(thumb.dataset.thumb)); return; }
      const card = event.target.closest("[data-card]");
      if (card) {
        activeHandle = card.dataset.card;
        renderDrawer();
        return;
      }
      const opt = event.target.closest("[data-opt]");
      if (opt) {
        selected[opt.dataset.opt] = opt.dataset.val;
        renderDetail(byHandle(activeHandle));
        return;
      }
      if (event.target.closest("[data-add]")) {
        const product = byHandle(activeHandle);
        const variant = product && currentVariant(product);
        if (!variant?.available) return;
        try {
          await window.HAYUGEN.addToCart(variant.id, product.handle, 1);
          drawer.querySelector("[data-status]").textContent = "Added to bag";
        } catch (error) {
          drawer.querySelector("[data-status]").textContent = error.message;
        }
      }
    }, { signal });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) {
        closeDrawer();
        event.preventDefault();
      }
    }, { signal });

    drawer.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusable = [...drawer.querySelectorAll("button, a, [href], input, select, textarea")].filter((el) => !el.disabled && el.offsetParent);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }, { signal });

    window.addEventListener("resize", () => {
      fitStage();
      if (!busy) layout();
    }, { signal });
    window.addEventListener("pagehide", () => abort.abort(), { signal });
  }

  document.addEventListener("DOMContentLoaded", mount);
})();
