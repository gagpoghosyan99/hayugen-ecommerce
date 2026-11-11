(() => {
  const HANDLE = "hayugen-heritage-grid-t-shirt-armenian-streetwear-copy";
  const VIEWS = [
    { id: "front", src: "./img/showroom/saryan-front.png", label: "Front" },
    { id: "threequarter", src: "./img/showroom/saryan-threequarter.png", label: "Three quarter" },
    { id: "side", src: "./img/showroom/saryan-side.png", label: "Side" },
    { id: "print", src: "./img/showroom/saryan-print.png", label: "The print" },
    { id: "collar", src: "./img/showroom/saryan-collar.png", label: "Collar" },
    { id: "fabric", src: "./img/showroom/saryan-fabric.png", label: "Cloth" },
  ];

  function mount() {
    const root = document.getElementById("home-selected");
    const product = (window.HAYUGEN_CATALOG || []).find((item) => item.handle === HANDLE);
    if (!root || !product || !window.HAYUGEN) return;

    const sizes = product.options.find((option) => option.name === "Size")?.values || [];
    let index = 0;
    let size = sizes[0] || "";

    root.innerHTML = `
      <section class="cloth" aria-labelledby="cloth-title">
        <div class="cloth-copy">
          <p class="cloth-kicker">The stand</p>
          <h2 id="cloth-title">Saryan</h2>
          <p class="cloth-view" id="cloth-view">Front</p>
          <p>${HAYUGEN.esc(product.material)}</p>
          <p>${HAYUGEN.esc(product.print)}</p>
          <p class="cloth-price">${HAYUGEN.money(product.price)}</p>
          <fieldset class="cloth-sizes">
            <legend>Size</legend>
            <div id="cloth-size-row">
              ${sizes.map((value) => `<button type="button" data-size="${HAYUGEN.esc(value)}" aria-pressed="${value === size}">${HAYUGEN.esc(value)}</button>`).join("")}
            </div>
          </fieldset>
          <div class="cloth-actions">
            <button class="btn" id="cloth-add" type="button">Add to bag</button>
            <a class="btn-ghost cloth-link" href="./product.html?handle=${encodeURIComponent(product.handle)}">View the piece</a>
          </div>
          <p class="status" id="cloth-status" role="status"></p>
        </div>
        <div class="cloth-stage" tabindex="0" aria-label="Turn the Saryan T-shirt">
          <span class="cloth-bar" aria-hidden="true"></span>
          <figure class="cloth-frame">
            <img id="cloth-photo" src="${VIEWS[0].src}" alt="Saryan beige T-shirt, front" width="900" height="1200" fetchpriority="low">
          </figure>
          <div class="cloth-turn">
            <button type="button" data-step="-1" aria-label="Previous view">‹</button>
            <span>Turn</span>
            <button type="button" data-step="1" aria-label="Next view">›</button>
          </div>
        </div>
        <div class="cloth-thumbs" role="tablist" aria-label="Garment views">
          ${VIEWS.map((view, i) => `
            <button type="button" role="tab" data-view="${i}" aria-selected="${i === 0}" aria-label="${HAYUGEN.esc(view.label)}">
              <img src="${view.src}" alt="" width="96" height="120">
            </button>`).join("")}
        </div>
      </section>`;

    const photo = root.querySelector("#cloth-photo");
    const viewLabel = root.querySelector("#cloth-view");
    const status = root.querySelector("#cloth-status");
    const stage = root.querySelector(".cloth-stage");

    function show(next) {
      index = (next + VIEWS.length) % VIEWS.length;
      const view = VIEWS[index];
      photo.style.animation = "none";
      photo.src = view.src;
      photo.alt = `Saryan beige T-shirt, ${view.label.toLowerCase()}`;
      photo.offsetHeight;
      photo.style.animation = "";
      viewLabel.textContent = view.label;
      root.querySelectorAll("[data-view]").forEach((button) => {
        button.setAttribute("aria-selected", String(Number(button.dataset.view) === index));
      });
    }

    root.addEventListener("click", async (event) => {
      const step = event.target.closest("[data-step]");
      const thumb = event.target.closest("[data-view]");
      const sizeBtn = event.target.closest("[data-size]");
      if (step) show(index + Number(step.dataset.step));
      if (thumb) show(Number(thumb.dataset.view));
      if (sizeBtn) {
        size = sizeBtn.dataset.size;
        root.querySelectorAll("[data-size]").forEach((button) => {
          button.setAttribute("aria-pressed", String(button === sizeBtn));
        });
      }
      if (event.target.closest("#cloth-add")) {
        const button = root.querySelector("#cloth-add");
        const variant =
          product.variants.find((item) => Object.values(item).includes(size)) || product.variants[0];
        button.disabled = true;
        status.textContent = "";
        try {
          await HAYUGEN.addToCart(variant.id, product.handle, 1);
          status.textContent = `${size} is in the bag.`;
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      }
    });

    stage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        show(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(index - 1);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
