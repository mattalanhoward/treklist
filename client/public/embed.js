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

  // ── Parent-level modal overlay (escapes the iframe stacking context) ────────

  var activeModalOverlay = null;
  var activeModalIframe = null;

  function gToOz(g) {
    return typeof g === "number" ? g / 28.349523125 : null;
  }

  function fmtWeight(g, unit) {
    if (g == null || isNaN(Number(g))) return "";
    var n = Number(g);
    if (unit === "oz") return (gToOz(n) || 0).toFixed(2) + " oz";
    return Math.round(n) + " g";
  }

  function closeEmbedModal(sourceIframe) {
    if (activeModalOverlay) {
      activeModalOverlay.remove();
      activeModalOverlay = null;
    }
    document.removeEventListener("keydown", handleModalKey);
    // Notify the iframe that the modal was closed (so it can clear selectedItem)
    var target = sourceIframe || activeModalIframe;
    if (target && target.contentWindow) {
      try {
        target.contentWindow.postMessage({ type: "treklist:modal-closed" }, "*");
      } catch (e) {}
    }
    activeModalIframe = null;
  }

  function handleModalKey(e) {
    if (e.key === "Escape") closeEmbedModal(null);
  }

  function openEmbedModal(item, unit, sourceIframe) {
    closeEmbedModal(null);

    activeModalIframe = sourceIframe || null;

    var safeImages = (Array.isArray(item.imageUrls) ? item.imageUrls : []).filter(function (u) {
      return typeof u === "string" && u.trim() && /^https?:\/\//i.test(u.trim());
    });
    var hasImage = safeImages.length > 0;
    var linkHref = (item.affiliate && (item.affiliate.deepLink || item.affiliate.url)) || item.link || null;
    var linkLabel = (item.affiliate && item.affiliate.merchantName) || item.brand || "View product";

    var rows = [
      ["Type", item.itemType],
      ["Name", item.name],
      ["Brand", item.brand],
      ["Weight", fmtWeight(Number(item.weight_g) || 0, unit)],
      ["Quantity", String(item.qty != null ? item.qty : 1)],
    ];
    if (item.consumable) rows.push(["Consumable", "Yes"]);
    if (item.worn) rows.push(["Worn", "Yes"]);

    var rowsHtml = rows.map(function (r) {
      var val = r[1] != null && r[1] !== "" ? r[1] : "—";
      return '<div style="display:grid;grid-template-columns:130px 1fr;gap:8px;padding:4px 12px;">'
        + '<div style="font-weight:600;color:#172b4d;">' + esc(r[0]) + ':</div>'
        + '<div style="color:#172b4d;word-break:break-word;">' + esc(String(val)) + '</div>'
        + '</div>';
    }).join("");

    var imgHtml = hasImage
      ? '<div style="display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid rgba(23,43,77,0.15);border-radius:6px;padding:8px;margin-bottom:16px;">'
        + '<img src="' + esc(safeImages[0]) + '" alt="" style="max-height:240px;max-width:100%;object-fit:contain;" />'
        + '</div>'
      : "";

    var descHtml = item.description
      ? '<div style="margin-top:16px;padding:0 12px;">'
        + '<div style="font-weight:600;color:#172b4d;margin-bottom:4px;">Description</div>'
        + '<div style="color:#172b4d;white-space:pre-line;line-height:1.6;">' + esc(item.description) + '</div>'
        + '</div>'
      : "";

    var linkHtml = linkHref
      ? '<a href="' + esc(linkHref) + '" target="_blank" rel="noopener noreferrer"'
        + ' style="display:inline-block;padding:6px 12px;background:#44546f;color:#fff;font-weight:600;border-radius:6px;text-decoration:none;">'
        + esc(linkLabel) + '</a>'
      : "";

    var overlay = document.createElement("div");
    overlay.setAttribute("id", "treklist-modal-overlay");
    overlay.style.cssText = [
      "position:fixed", "inset:0", "background:rgba(0,0,0,0.45)",
      "display:flex", "align-items:center", "justify-content:center",
      "z-index:2147483647", "padding:16px", "box-sizing:border-box",
    ].join(";");

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:8px;padding:24px;width:100%;max-width:' + (hasImage ? "800px" : "560px") + ';max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.3);position:relative;box-sizing:border-box;font-family:system-ui,sans-serif;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
      + '<h2 style="margin:0;font-size:18px;font-weight:700;color:#172b4d;">Item Details</h2>'
      + '<button id="treklist-modal-close" style="background:none;border:none;cursor:pointer;font-size:22px;line-height:1;color:#ef4444;padding:0 4px;" aria-label="Close">&times;</button>'
      + '</div>'
      + imgHtml
      + rowsHtml
      + descHtml
      + '<div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;">'
      + linkHtml
      + '<button id="treklist-modal-close-btn" style="padding:6px 12px;background:#f1f2f4;border:none;border-radius:6px;cursor:pointer;font-size:14px;color:#172b4d;">Close</button>'
      + '</div>'
      + '</div>';

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeEmbedModal(sourceIframe);
    });
    overlay.querySelector("#treklist-modal-close").addEventListener("click", function () {
      closeEmbedModal(sourceIframe);
    });
    overlay.querySelector("#treklist-modal-close-btn").addEventListener("click", function () {
      closeEmbedModal(sourceIframe);
    });

    document.body.appendChild(overlay);
    activeModalOverlay = overlay;
    document.addEventListener("keydown", handleModalKey);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ────────────────────────────────────────────────────────────────────────────

  function ensureMessageListener() {
    if (state.listenerAttached) return;
    state.listenerAttached = true;

    window.addEventListener("message", (event) => {
      // Only accept messages from TrekList origins we created iframes for.
      if (!state.allowedOrigins.has(event.origin)) return;

      const msg = event && event.data;
      if (!msg) return;

      if (msg.type === "treklist:embed-height") {
        const token = String(msg.token || "");
        const iframe = state.iframesByToken[token];
        if (!iframe) return;
        const h = Number(msg.height);
        if (!Number.isFinite(h) || h < 100) return;
        iframe.style.height = `${Math.ceil(h) + 2}px`;
        return;
      }

      if (msg.type === "treklist:modal-open") {
        const token = String(msg.token || "");
        const iframe = state.iframesByToken[token] || null;
        openEmbedModal(msg.item || {}, msg.unit || "g", iframe);
        return;
      }

      if (msg.type === "treklist:modal-close") {
        closeEmbedModal(null);
        return;
      }
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
