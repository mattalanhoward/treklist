const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/user");
const CatalogItemRequest = require("../models/catalogItemRequest");
const { sendSupportEmail } = require("../utils/mailer");

const router = express.Router();

// POST /api/support/catalog-item-requests
router.post("/catalog-item-requests", auth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const brand = String(req.body?.brand || "").trim();
    const link = String(req.body?.link || "").trim();

    if (!name || !brand) {
      return res.status(400).json({ message: "Name and Brand are required." });
    }

    // pull user context (email/region/locale)
    const user = await User.findById(req.userId)
      .select("email region locale language")
      .lean();

    const doc = await CatalogItemRequest.create({
      name,
      brand,
      link,
      userId: req.userId,
      userEmail: user?.email || "",
      region: user?.region || "",
      locale: user?.locale || "",
      language: user?.language || "",
      source: "globalItemModal",
      userAgent: req.get("user-agent") || "",
      ip:
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "",
    });

    // email support
    const supportTo = "support@treklist.co";
    const subject = `[TrekList] Catalog item request: ${brand} ${name}`;

    const text =
      `New catalog item request\n\n` +
      `Name: ${name}\n` +
      `Brand: ${brand}\n` +
      `Link: ${link || "(none)"}\n\n` +
      `User: ${user?.email || "(unknown)"}\n` +
      `Region: ${user?.region || "(unknown)"}\n` +
      `Locale: ${user?.locale || "(unknown)"}\n` +
      `Language: ${user?.language || "(unknown)"}\n\n` +
      `Request ID: ${doc._id}\n` +
      `Created: ${doc.createdAt}\n`;

    const html =
      `<h3>New catalog item request</h3>` +
      `<ul>` +
      `<li><b>Name:</b> ${escapeHtml(name)}</li>` +
      `<li><b>Brand:</b> ${escapeHtml(brand)}</li>` +
      `<li><b>Link:</b> ${
        link
          ? `<a href="${escapeAttr(link)}">${escapeHtml(link)}</a>`
          : "(none)"
      }</li>` +
      `</ul>` +
      `<h4>User context</h4>` +
      `<ul>` +
      `<li><b>User:</b> ${escapeHtml(user?.email || "(unknown)")}</li>` +
      `<li><b>Region:</b> ${escapeHtml(user?.region || "(unknown)")}</li>` +
      `<li><b>Locale:</b> ${escapeHtml(user?.locale || "(unknown)")}</li>` +
      `<li><b>Language:</b> ${escapeHtml(user?.language || "(unknown)")}</li>` +
      `</ul>` +
      `<p><b>Request ID:</b> ${doc._id}</p>`;

    await sendSupportEmail({ to: supportTo, subject, text, html });

    return res.json({ ok: true, requestId: doc._id });
  } catch (err) {
    console.error("Failed to create catalog item request:", err);
    return res.status(500).json({ message: "Failed to send request." });
  }
});

// tiny helpers (avoid pulling libs)
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  // minimal attr escape
  return escapeHtml(s).replaceAll("`", "&#096;");
}

module.exports = router;
