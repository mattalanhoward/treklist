/**
 * consolidate-decathlon-pads.js — the Decathlon inflatable pads were imported as
 * SEPARATE items per length (L / XL), several with SWAPPED size labels, one model
 * missing its XL, and code/weight inconsistencies. Per our locked variant standard,
 * length is a fit-spec => one item with a Size axis. This rebuilds each inflatable
 * model into ONE item with Size [Regular, Long] variants carrying per-variant weight,
 * sku, and buy-link, using the in-store BOARD data (decathlon-store-specs.json) as the
 * source of truth for weight/R-value/size (NOT the corrupted item names).
 *
 * Matching existing item -> model = (inflatable + model token MT500/MT900/MT100 in name
 * + R-value). Within a model, L/XL is assigned by NEAREST board weight (ignoring the
 * unreliable name labels). Reuse the L item's _id as the consolidated item (preserves
 * references + its offer); archive the redundant XL item(s). Per-variant deepLinks are
 * harvested from each matched item's Awin offer; a missing variant's link falls back to
 * the feed (by board code) if available.
 *
 * Foam pads (single size) are left untouched. updateOne only (never .save() projected).
 *
 *   node src/scripts/consolidate-decathlon-pads.js [--commit] [--csv <path>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const zlib = require("zlib");
const fs = require("fs");
const COMMIT = process.argv.includes("--commit");
const CSV_ARG = (() => { const i = process.argv.indexOf("--csv"); return i > -1 ? process.argv[i + 1] : null; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// Ground-truth models from the store boards. weights in grams, per single size.
const MODELS = [
  { token: "mt500", rValue: 1.5, brand: "Simond", padType: "Air",            name: "Trekking Air Mattress MT500",             seasonRating: "Summer Only",   L: { w: 510, dims: "180×52×5 cm",   code: "8799965" }, XL: { w: 600, dims: "195×60×5 cm",   code: "8799966" } },
  { token: "mt500", rValue: 3.3, brand: "Simond", padType: "Air",            name: "Insulated Trekking Air Mattress MT500",   seasonRating: "3-Season",      L: { w: 670, dims: "180×52×5 cm",   code: "8853280" }, XL: { w: 800, dims: "195×60×5 cm",   code: "8853281" } },
  { token: "mt900", rValue: 1.5, brand: "Simond", padType: "Air",            name: "Trekking Air Mattress MT900",             seasonRating: "Summer Only",   L: { w: 520, dims: "183×54×8.5 cm", code: "8975036" }, XL: { w: 620, dims: "195×63×8.5 cm", code: "8975038" } },
  { token: "mt900", rValue: 5.4, brand: "Simond", padType: "Air",            name: "Insulated Trekking Air Mattress MT900",   seasonRating: "4-Season",      L: { w: 615, dims: "183×54×9 cm",   code: "8975202" }, XL: { w: 730, dims: "195×63×9 cm",   code: "8975212" } },
  { token: "mt100", rValue: 2.7, brand: "Forclaz", padType: "Self-Inflating", name: "Self-Inflating Trekking Mattress MT100", seasonRating: "3-Season",      L: { w: 920, dims: "180×52×2.5 cm", code: "8612278" }, XL: { w: 1020, dims: "193×60×2.5 cm", code: "8612279" } },
];

// ---- optional feed (for a missing variant's buy-link) ----
const Q = String.fromCharCode(34);
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const idx = Object.fromEntries(lines[0].split(",").map((h, i) => [h, i]));
  function parse(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === Q) { if (line[i + 1] === Q) { c += Q; i++; } else q = false; } else c += ch; } else { if (ch === Q) q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } } o.push(c); return o; }
  return { rows: lines.slice(1).map(parse), idx };
}
async function loadFeed() {
  try {
    let text;
    if (CSV_ARG && fs.existsSync(CSV_ARG)) text = fs.readFileSync(CSV_ARG, "utf8");
    else { const res = await fetch(process.env.AWIN_DECATHLON_FEED_URL); text = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"); }
    const { rows, idx } = parseCsv(text);
    const byCode = {};
    for (const r of rows) { const c = (r[idx.merchant_product_id] || "").split("-")[0]; if (/^\d{6,8}$/.test(c) && !byCode[c]) byCode[c] = r[idx.aw_deep_link]; }
    return byCode;
  } catch (e) { console.log("(feed unavailable: " + e.message + ")"); return {}; }
}

(async () => {
  const feedLink = await loadFeed();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const pads = await C.find({ isActive: true, brand: /simond|forclaz|quechua/i, itemType: "Inflatable Sleeping Pad" })
    .select("name brand itemType weightGrams attributes imageUrls").lean();
  const offs = await O.find({ productId: { $in: pads.map((p) => p._id) } }).select("productId deepLink").lean();
  const linkBy = {}; for (const o of offs) if (!linkBy[String(o.productId)]) linkBy[String(o.productId)] = o.deepLink;
  const norm = (s) => (s || "").toLowerCase();

  const ops = [];  // { type:'update'|'archive', ... }
  const usedIds = new Set();

  for (const m of MODELS) {
    // candidate existing items: inflatable, model token, R within 0.7
    const cands = pads.filter((p) => norm(p.name).includes(m.token) && Math.abs((p.attributes && p.attributes.rValue || -9) - m.rValue) <= 0.7 && !usedIds.has(String(p._id)));
    if (!cands.length) { console.log(`!! ${m.name}: no existing items matched — skip`); continue; }
    // assign each candidate to L or XL by nearest board weight
    for (const c of cands) c._side = Math.abs((c.weightGrams || 0) - m.L.w) <= Math.abs((c.weightGrams || 0) - m.XL.w) ? "L" : "XL";
    const lItem = cands.find((c) => c._side === "L") || cands[0];
    const xlItem = cands.find((c) => c._side === "XL" && c !== lItem);
    cands.forEach((c) => usedIds.add(String(c._id)));

    const linkL = (lItem && linkBy[String(lItem._id)]) || feedLink[m.L.code] || null;
    const linkXL = (xlItem && linkBy[String(xlItem._id)]) || feedLink[m.XL.code] || null;

    const variants = [
      { key: "Regular", options: { Size: "Regular" }, weightGrams: m.L.w, sku: m.L.code, ...(linkL ? { deepLink: linkL } : {}) },
      { key: "Long", options: { Size: "Long" }, weightGrams: m.XL.w, sku: m.XL.code, ...(linkXL ? { deepLink: linkXL } : {}) },
    ];
    const attributes = { ...(lItem.attributes || {}), rValue: m.rValue, padType: m.padType === "Self-Inflating" ? "Self-Inflating" : "Air", seasonRating: m.seasonRating };
    delete attributes.lengthSize; delete attributes.widthSize; // now expressed by the Size axis
    const set = {
      name: m.name, brand: m.brand,
      variantAxes: [{ name: "Size", values: ["Regular", "Long"] }],
      variants, defaultVariantKey: "Regular",
      weightGrams: m.L.w,
      attributes,
      description: `Decathlon ${m.brand} ${m.name} — inflatable trekking mattress, R-value ${m.rValue}. Available in Regular (${m.L.dims}, ${m.L.w} g) and Long (${m.XL.dims}, ${m.XL.w} g). Select a size to see its weight.`,
    };

    ops.push({ type: "update", id: lItem._id, name: lItem.name, set, keptSide: lItem._side, xlFrom: xlItem ? xlItem.name : "(XL had no item — board weight only)", linkXL: !!linkXL });
    if (xlItem) ops.push({ type: "archive", id: xlItem._id, name: xlItem.name });
  }

  // ---- report ----
  console.log(`\nDecathlon inflatable pad items now: ${pads.length}  ->  after: ${MODELS.length} consolidated (+ ${ops.filter((o) => o.type === "archive").length} archived)\n`);
  for (const op of ops.filter((o) => o.type === "update")) {
    console.log(`CONSOLIDATE -> "${op.set.name}"  [Regular ${op.set.variants[0].weightGrams}g / Long ${op.set.variants[1].weightGrams}g]  R${op.set.attributes.rValue}`);
    console.log(`   reuse _id of: "${op.name}"`);
    console.log(`   Long buy-link: ${op.linkXL ? "yes" : "MISSING (item-level fallback)"}`);
  }
  console.log("\nARCHIVE (redundant):");
  ops.filter((o) => o.type === "archive").forEach((o) => console.log(`   - "${o.name}"`));

  if (COMMIT) {
    for (const op of ops) {
      if (op.type === "update") await C.collection.updateOne({ _id: op.id }, { $set: op.set });
      else await C.collection.updateOne({ _id: op.id }, { $set: { isActive: false } });
    }
    console.log(`\nAPPLIED: ${ops.filter((o) => o.type === "update").length} consolidated, ${ops.filter((o) => o.type === "archive").length} archived`);
  } else console.log("\nDRY-RUN — re-run with --commit to apply");
  await mongoose.disconnect();
})();
