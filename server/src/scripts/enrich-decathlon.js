/**
 * enrich-decathlon.js — STAGE 1 of the Decathlon re-import (2026-07-09).
 *
 * The existing Decathlon catalog (184 active house-brand items) is well-formed
 * (82% have weights, all have images + Awin offers, valid itemTypes) but PRE-VARIANT:
 * it predates our size-variant work. This script enriches those items IN PLACE
 * (preserving _id, weight, curation, offers) rather than archive-and-readd.
 *
 * User decision (2026-07-09): MINIMAL / EXACT-ONLY sizing. Decathlon publishes NO
 * size labels anywhere pullable (Awin `Fashion:size` 0% populated; site 403s scraping).
 * The feed reveals the size-variant COUNT (one row per size, own EAN) but not the label.
 * So:
 *   - Sleeping bags (one article code, multiple size-rows): add an exact Size axis from
 *     the in-store board ranges captured in decathlon-store-specs.json (M/L/XL etc.).
 *     Weight is the size-L reference (disclosed).
 *   - Pads: ALREADY separate items per length (L/XL are distinct article codes) with a
 *     lengthSize attribute — leave as-is.
 *   - Everything else with >1 size in the feed: append a "select your size on Decathlon's
 *     page" note (no fabricated labels). Single buy-link (size selector on their page).
 *   - Colour is never a variant — feed colour rows are collapsed.
 *
 * Join: catalog item -> feed via MerchantOffer.externalProductId (the 8-digit article
 * code) -> feed rows keyed by merchant_product_id prefix. Fallbacks: aw_product_id in the
 * offer pclick link, then normalized name.
 *
 * NEVER .save() a projected doc (pre-save hook wipes unselected fields) — updateOne only.
 *
 *   node src/scripts/enrich-decathlon.js [--commit] [--csv <path>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const zlib = require("zlib");
const fs = require("fs");

const COMMIT = process.argv.includes("--commit");
const CSV_ARG = (() => { const i = process.argv.indexOf("--csv"); return i > -1 ? process.argv[i + 1] : null; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const STORE = require("./decathlon-store-specs.json");
const SIZE_NOTE = "Available in multiple sizes — select your size on the Decathlon product page.";
const BAG_DISCLAIMER = "Listed weight is for size L; other sizes vary.";
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
// itemTypes that genuinely come in wearable sizes (so the "sizes on Decathlon's page"
// note is accurate). Excludes tents/poles/pads/packs/pillows/etc. whose extra feed rows
// are colourways or minor variants, not sizes.
const SIZED_TYPES = new Set([
  "Base Layer Top", "Base Layer Bottom", "Hiking Shirt", "Hiking Pants", "Hiking Shorts",
  "Convertible Pants", "Rain Jacket", "Rain Pants", "Insulated Jacket", "Fleece Jacket",
  "Softshell Jacket", "Gloves (Insulated)", "Hat/Headwear", "Neck Gaiter", "Underwear",
  "Bra", "Hiking Socks", "Hiking Boots", "Hiking Shoes", "Trail Running Shoes", "Sandals",
]);
// store-specs code -> full entry (for weightRefNote / weight lookups)
function storeEntryByCode(code) {
  for (const k of Object.keys(STORE)) {
    if (k.startsWith("_")) continue;
    for (const s of STORE[k]) if (Array.isArray(s.skus) && s.skus.includes(code)) return s;
  }
  return null;
}

// ---- feed load ----
const Q = String.fromCharCode(34);
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const hdr = lines[0].split(",");
  const idx = Object.fromEntries(hdr.map((h, i) => [h, i]));
  function parse(line) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === Q) { if (line[i + 1] === Q) { cur += Q; i++; } else q = false; } else cur += c; }
      else { if (c === Q) q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
    }
    out.push(cur); return out;
  }
  return { rows: lines.slice(1).map(parse), idx };
}
async function loadFeed() {
  if (CSV_ARG && fs.existsSync(CSV_ARG)) { console.log("feed <- " + CSV_ARG); return parseCsv(fs.readFileSync(CSV_ARG, "utf8")); }
  const url = process.env.AWIN_DECATHLON_FEED_URL;
  console.log("feed <- Awin fid/65881 (downloading)…");
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = zlib.gunzipSync(buf).toString("utf8");
  return parseCsv(text);
}

// "M to XL" / "S to XL" / "L and XL" / "L" -> ["M","L","XL"] etc.
function parseSizeRange(s) {
  if (!s) return null;
  const up = s.toUpperCase().replace(/\s+/g, " ").trim();
  let m;
  if ((m = up.match(/^([A-Z]{1,3})\s*(?:TO|-)\s*([A-Z]{1,3})$/))) {
    const a = SIZE_ORDER.indexOf(m[1]), b = SIZE_ORDER.indexOf(m[2]);
    if (a > -1 && b > -1 && b >= a) return SIZE_ORDER.slice(a, b + 1);
  }
  if ((m = up.match(/^([A-Z]{1,3})\s*(?:AND|&|\+)\s*([A-Z]{1,3})$/))) {
    return [m[1], m[2]].filter((x) => SIZE_ORDER.includes(x));
  }
  if (/^[A-Z]{1,3}$/.test(up) && SIZE_ORDER.includes(up)) return [up];
  return null;
}
// store-specs code -> {sizes[], ...} for sleeping bags
function buildBagSizeIndex() {
  const out = {};
  for (const it of STORE.sleepingBags || []) {
    const sizes = parseSizeRange(it.specs && it.specs.sizes);
    if (sizes && sizes.length > 1) for (const sku of it.skus) out[sku] = sizes;
  }
  return out;
}

(async () => {
  const { rows, idx } = await loadFeed();
  const codeOf = (r) => (r[idx.merchant_product_id] || "").split("-")[0];
  const byCode = {}, byAw = {}, byName = {};
  const norm = (s) => (s || "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  for (const r of rows) {
    const c = codeOf(r);
    if (/^\d{6,8}$/.test(c)) (byCode[c] = byCode[c] || []).push(r);
    if (r[idx.aw_product_id]) byAw[r[idx.aw_product_id]] = r;
    const n = norm(r[idx.product_name]); if (n && !byName[n]) byName[n] = r;
  }
  // size-variant count within a single colour group
  function sizeCount(code) {
    const rs = byCode[code]; if (!rs) return 0;
    const byColour = {};
    for (const r of rs) { const col = r[idx.colour] || "_"; byColour[col] = (byColour[col] || 0) + 1; }
    return Math.max(...Object.values(byColour));
  }
  const bagSizes = buildBagSizeIndex();

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const HOUSE = /^(Decathlon|Quechua|Forclaz|Simond|Kalenji|Kiprun|Arpenaz|Solognac|Geologic|Wedze|Domyos)$/i;
  const items = await C.find({ brand: HOUSE, isActive: true })
    .select("name brand itemType weightGrams description variantAxes attributes").lean();
  const offs = await O.find({ productId: { $in: items.map((i) => i._id) } })
    .select("productId externalProductId deepLink").lean();
  const offByPid = {};
  for (const o of offs) (offByPid[String(o.productId)] = offByPid[String(o.productId)] || []).push(o);

  function joinCode(it) {
    const os = offByPid[String(it._id)] || [];
    for (const o of os) if (o.externalProductId && byCode[o.externalProductId]) return { code: o.externalProductId, how: "externalProductId" };
    for (const o of os) { const p = (o.deepLink || "").match(/[?&]p=(\d+)/); if (p && byAw[p[1]]) return { code: codeOf(byAw[p[1]]), how: "aw_product_id" }; }
    const nm = byName[norm(it.name)]; if (nm) return { code: codeOf(nm), how: "name" };
    return { code: null, how: "NONE" };
  }

  const plan = { bagAxis: [], sizeNote: [], weightBackfill: [], noChange: 0, unjoined: 0 };
  const ops = [];

  for (const it of items) {
    const { code, how } = joinCode(it);
    const set = {};
    let touched = false;

    // (a) sleeping-bag size axis from board range
    if (it.itemType === "Sleeping Bag" && code && bagSizes[code] && !(it.variantAxes || []).length) {
      const sizes = bagSizes[code];
      set.variantAxes = [{ name: "Size", values: sizes }];
      set.variants = sizes.map((s) => ({ key: s, options: { Size: s } }));
      set.defaultVariantKey = sizes.includes("L") ? "L" : sizes[0];
      let d = it.description || "";
      if (!/weight is for size/i.test(d)) d = (d.trim() + "\n\n" + BAG_DISCLAIMER).trim();
      set.description = d;
      plan.bagAxis.push(`${it.name.slice(0, 42)}  [${sizes.join("/")}]`);
      touched = true;
    }
    // (b) multi-size note (no axis) — only for genuinely-sized apparel/footwear
    else if (code && SIZED_TYPES.has(it.itemType) && sizeCount(code) > 1 && !(it.variantAxes || []).length) {
      const d = it.description || "";
      if (!d.includes(SIZE_NOTE)) {
        set.description = (d.trim() + "\n\n" + SIZE_NOTE).trim();
        plan.sizeNote.push(`${(it.itemType || "?").padEnd(18)} ${it.name.slice(0, 40)}  (${sizeCount(code)} sizes)`);
        touched = true;
      }
    }
    // (c) backfill weight from store-specs by code (+ its reference-size disclosure)
    if (!it.weightGrams && code) {
      const entry = storeEntryByCode(code);
      if (entry && entry.weightGrams) {
        set.weightGrams = entry.weightGrams;
        if (entry.weightRefNote) {
          const d = set.description != null ? set.description : (it.description || "");
          if (!/per single shoe|for size|reference-size|varies by size/i.test(d)) {
            const note = entry.weightRefNote.replace(/^weight\s+/i, ""); // avoid "weight is weight in…"
            set.description = (d.trim() + "\n\nListed weight is " + note + ".").trim();
          }
        }
        plan.weightBackfill.push(`${it.name.slice(0, 42)} -> ${entry.weightGrams}g${entry.weightRefNote ? " (" + entry.weightRefNote.slice(0, 28) + "…)" : ""}`);
        touched = true;
      }
    }

    if (how === "NONE") plan.unjoined++;
    if (!touched) { plan.noChange++; continue; }
    ops.push({ _id: it._id, set });
  }

  // ---- report ----
  console.log(`\nactive house items: ${items.length}  |  unjoined to feed: ${plan.unjoined}`);
  console.log(`\n(a) sleeping-bag size axes: ${plan.bagAxis.length}`);
  plan.bagAxis.forEach((x) => console.log("    + " + x));
  console.log(`\n(b) "sizes on Decathlon page" note: ${plan.sizeNote.length}`);
  plan.sizeNote.slice(0, 40).forEach((x) => console.log("    + " + x));
  if (plan.sizeNote.length > 40) console.log(`    … +${plan.sizeNote.length - 40} more`);
  console.log(`\n(c) weight backfill: ${plan.weightBackfill.length}`);
  plan.weightBackfill.forEach((x) => console.log("    + " + x));
  console.log(`\nno change: ${plan.noChange}  |  total updates: ${ops.length}`);

  if (COMMIT) {
    let n = 0;
    for (const op of ops) { await C.collection.updateOne({ _id: op._id }, { $set: op.set }); n++; }
    console.log(`\nAPPLIED ${n} updates`);
  } else console.log(`\nDRY-RUN — re-run with --commit to apply`);
  await mongoose.disconnect();
})();
