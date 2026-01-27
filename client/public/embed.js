/*
  TrekList Embed

  Usage (WordPress Custom HTML block):

    <div class="treklist-embed" data-treklist-token="DEeOxfDkvBClbMqB"></div>
    <script async src="https://treklist.co/embed.js"></script>

  Notes:
  - This intentionally uses an iframe for isolation (no CSS conflicts).
  - We auto-resize the iframe height via postMessage so the parent page scrolls normally.
  - Default layout: responsive (100% width) BUT capped + centered for nicer embeds on wide pages.
*/

(function () {
  const GLOBAL_KEY = "__treklistEmbed";
  const state = (window[GLOBAL_KEY] = window[GLOBAL_KEY] || {
    iframesByToken: {},
    allowedOrigins: new Set(),
    listenerAttached: false,
  });

  // Default cap for embeds (feel free to tweak)
  const DEFAULT_MAX_WIDTH_PX = 960;

  function safeUrl(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  function buildIframeSrc(token, baseOrigin) {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return null;
    const origin = baseOrigin || "https://treklist.co";
    return `${origin}/share/${encodeURIComponent(cleanToken)}?embed=1`;
  }

  function ensureMessageListener() {
    if (state.listenerAttached) return;
    state.listenerAttached = true;

    window.addEventListener("message", (event) => {
      // Only accept messages from TrekList origins we created iframes for.
      if (!state.allowedOrigins.has(event.origin)) return;

      const msg = event && event.data;
      if (!msg || msg.type !== "treklist:embed-height") return;

      const token = String(msg.token || "");
      const iframe = state.iframesByToken[token];
      if (!iframe) return;

      const h = Number(msg.height);
      if (!Number.isFinite(h) || h < 100) return;

      iframe.style.height = `${Math.ceil(h) + 2}px`;
    });
  }

  function mountEmbedIntoEl(el, token, options) {
    if (!el || !token) return;
    if (el.getAttribute("data-treklist-mounted") === "1") return;
    el.setAttribute("data-treklist-mounted", "1");

    const scriptUrl = safeUrl((options && options.scriptSrc) || "");
    const baseOrigin = scriptUrl ? scriptUrl.origin : "https://treklist.co";
    const src = buildIframeSrc(token, baseOrigin);
    if (!src) return;

    const iframeUrl = safeUrl(src);
    if (iframeUrl) state.allowedOrigins.add(iframeUrl.origin);
    ensureMessageListener();

    // --- Default capped + centered shell on the container ---
    // Keeps embeds from going full-bleed on wide layouts.
    el.style.width = "100%";
    el.style.maxWidth = `${DEFAULT_MAX_WIDTH_PX}px`;
    el.style.marginLeft = "auto";
    el.style.marginRight = "auto";
    // -------------------------------------------------------

    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "TrekList gear list";
    iframe.loading = "lazy";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("frameborder", "0");
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";

    const startHeight = Number(el.getAttribute("data-treklist-height")) || 600;
    iframe.style.height = `${Math.max(200, startHeight)}px`;

    el.innerHTML = "";
    el.appendChild(iframe);

    state.iframesByToken[String(token)] = iframe;
  }

  // 1) Preferred: <div class="treklist-embed" data-treklist-token="...">
  const containers = Array.from(
    document.querySelectorAll(".treklist-embed[data-treklist-token]"),
  );

  // 2) Also support: <script src=".../embed.js" data-treklist-token="...">
  const scripts = Array.from(document.querySelectorAll("script[src]"))
    .map((s) => {
      const u = safeUrl(s.src);
      return u && u.pathname.endsWith("/embed.js") ? s : null;
    })
    .filter(Boolean);

  scripts.forEach((script) => {
    const token = script.getAttribute("data-treklist-token");
    if (!token) return;

    const targetId = script.getAttribute("data-treklist-target");
    let el = targetId ? document.getElementById(targetId) : null;

    if (!el) {
      el = document.createElement("div");
      el.className = "treklist-embed";
      el.setAttribute("data-treklist-token", token);
      script.parentNode.insertBefore(el, script.nextSibling);
    }

    mountEmbedIntoEl(el, token, { scriptSrc: script.src });
  });

  containers.forEach((el) => {
    const token = el.getAttribute("data-treklist-token");
    mountEmbedIntoEl(el, token, {
      scriptSrc: (document.currentScript || {}).src,
    });
  });
})();
