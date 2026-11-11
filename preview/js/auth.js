(() => {
  function nextPath() {
    const raw = new URLSearchParams(location.search).get("next") || "";
    if (!raw) return "./account.html";
    const path = raw.trim();
    if (!/^\.\/[a-z0-9._~/?=&%-]*$/i.test(path)) return "./account.html";
    if (path.includes("..") || path.includes("//")) return "./account.html";
    return path;
  }

  function carryNext(href) {
    const next = new URLSearchParams(location.search).get("next");
    if (!next) return href;
    const url = new URL(href, location.href);
    url.searchParams.set("next", next);
    return `${url.pathname.split("/").pop()}${url.search}`;
  }

  async function redirectIfSignedIn() {
    try {
      const me = await window.HAYUGEN.api.me();
      if (me.user) location.replace(nextPath());
    } catch {
      /* stay on the gate */
    }
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    if (!button.dataset.label) button.dataset.label = button.textContent.trim();
    button.textContent = busy ? "Please wait" : button.dataset.label;
  }

  function showError(node, message) {
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
  }

  window.HAYUGEN_AUTH = { nextPath, carryNext, redirectIfSignedIn, setBusy, showError };
})();
