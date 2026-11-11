(() => {
  const root = document.getElementById("admin-root");

  async function load() {
    const me = await HAYUGEN.api.me().catch(() => ({ user: null }));
    if (!me.user) {
      location.replace("./login.html?next=" + encodeURIComponent("./admin.html"));
      return;
    }
    if (me.user.role !== "admin") {
      root.innerHTML = `<p class="lede">This desk is closed.</p>`;
      return;
    }
    const [orders, stock, rewards] = await Promise.all([
      HAYUGEN.api.request("/api/admin/orders"),
      HAYUGEN.api.request("/api/admin/stock"),
      HAYUGEN.api.request("/api/admin/rewards"),
    ]);
    root.innerHTML = `
      <h1 class="page-title">Desk</h1>
      <section>
        <h2 class="page-kicker">Rewards</h2>
        <p class="hint">Customers do not see points until this is public.</p>
        <form id="rewards" class="form">
          <label class="account-check"><input type="checkbox" name="isPublic" ${rewards.is_public ? "checked" : ""}><span>Show rewards to customers</span></label>
          <div class="field"><label for="points">Points per order</label><input id="points" name="pointsPerOrder" type="text" inputmode="numeric" value="${rewards.points_per_order}"></div>
          <div class="field"><label for="min">Minimum to redeem</label><input id="min" name="minRedeem" type="text" inputmode="numeric" value="${rewards.min_redeem}"></div>
          <button class="btn" type="submit">Save rewards</button>
        </form>
      </section>
      <section>
        <h2 class="page-kicker">Orders</h2>
        <div class="orders">${orders.map((order) => `
          <article class="order" data-order="${HAYUGEN.esc(order.id)}">
            <strong>${HAYUGEN.esc(order.ref)}</strong>
            <p>${HAYUGEN.esc(order.email)} · ${HAYUGEN.esc(order.status)} · ${HAYUGEN.esc(order.paymentStatus)} · ${HAYUGEN.money(order.total)}</p>
            <div class="field"><label>Fulfillment</label>
              <select data-status>
                ${["pending", "confirmed", "packed", "shipped", "cancelled"].map((status) => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>Tracking</label><input data-tracking value="${HAYUGEN.esc(order.tracking || "")}"></div>
            <button type="button" data-save>Save order</button>
          </article>`).join("")}</div>
      </section>
      <section>
        <h2 class="page-kicker">Stock</h2>
        <p class="hint">Empty means the piece is not counted yet. A number is enforced at checkout.</p>
        <div class="orders">${stock.slice(0, 40).map((row) => `
          <article class="order">
            <strong>${HAYUGEN.esc(row.handle)}</strong>
            <p>${HAYUGEN.esc(row.variant_id)}</p>
            <input data-qty value="${row.quantity == null ? "" : row.quantity}" inputmode="numeric">
            <button type="button" data-stock="${HAYUGEN.esc(row.variant_id)}">Save stock</button>
          </article>`).join("")}</div>
      </section>`;

    document.getElementById("rewards").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      await HAYUGEN.api.request("/api/admin/rewards", {
        method: "PATCH",
        body: JSON.stringify({
          isPublic: Boolean(data.isPublic),
          pointsPerOrder: Number(data.pointsPerOrder) || 0,
          minRedeem: Number(data.minRedeem) || 0,
        }),
      });
    });
    root.querySelectorAll("[data-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-order]");
        await HAYUGEN.api.request("/api/admin/orders/" + encodeURIComponent(card.dataset.order), {
          method: "PATCH",
          body: JSON.stringify({
            status: card.querySelector("[data-status]").value,
            tracking: card.querySelector("[data-tracking]").value,
          }),
        });
        button.textContent = "Saved";
      });
    });
    root.querySelectorAll("[data-stock]").forEach((button) => {
      button.addEventListener("click", async () => {
        const input = button.parentElement.querySelector("[data-qty]");
        await HAYUGEN.api.request("/api/admin/stock", {
          method: "PATCH",
          body: JSON.stringify({
            variantId: button.dataset.stock,
            quantity: input.value === "" ? null : Number(input.value),
          }),
        });
        button.textContent = "Saved";
      });
    });
  }

  load().catch((error) => {
    root.innerHTML = `<p class="error">${HAYUGEN.esc(error.message)}</p>`;
  });
})();
