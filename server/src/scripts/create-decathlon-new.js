/**
 * create-decathlon-new.js — Stage 2 of the Decathlon re-import: create the HIGH-CONFIDENCE
 * genuinely-absent photographed products (headlamps, Makalu/MT1200/MT500 bags, Travel packs).
 * Explicit code ALLOWLIST so the ambiguous / likely-dupe candidates never get created.
 * Footwear + the 6 Hiking-Boots->Hiking-Shoes reclassifies are intentionally DEFERRED to
 * the next store-photo trip.
 *
 * Weights/specs come from decathlon-store-specs.json (in-store boards). Name/brand/image/
 * offer come from the live Awin feed (fid/65881), joined by article code = merchant_product_id
 * prefix. Sleeping bags get an exact Size axis from the board range (weight = size-L
 * reference, disclosed). Colour collapsed. category/subcategory copied from an existing
 * sibling of the same itemType for consistency.
 *
 *   node src/scripts/create-decathlon-new.js [--commit] [--csv <path>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const zlib = require("zlib");
const fs = require("fs");
const { categoryForItemType } = require("../config/inferItemType");
const STORE = require("./decathlon-store-specs.json");

const COMMIT = process.argv.includes("--commit");
const CSV_ARG = (() => { const i = process.argv.indexOf("--csv"); return i > -1 ? process.argv[i + 1] : null; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";

// primary article codes to create — VERIFIED genuinely-absent (each checked against the
// catalog by name+weight, 2026-07-09). Excluded after verification: HL50 (8788378, exists),
// ML200 (8978237, exists as "Multi-usage 200 Lumens Headlamp - ml"), UL200 (8787357, code
// collides with existing UL500), Makalu I (8495189) + Makalu II (8495191) (both exist),
// Travel 900 70L Men (8580014, exists as "Travel 900 70+6l").
const ALLOW = new Set([
  "8384991", "8505682",                          // headlamps: Onnight 100, HL100 USB
  "8968608", "8799902",                          // bags: MT1200 UL 0°C, MT500 -5°C
  "8990285", "8787845", "8580006", "8616394",    // Travel 500 30/40L, Travel 900 50L Men/Women
]);
// Keep "Headlamp" — it's the established catalog itemType for headlamps (20 existing items
// incl. all of Black Diamond's), distinct from "Torch Light" (flashlights). Not in SCHEMAS
// (like Backpack/Daypack) so attributes are carried leniently.
const ITEMTYPE = { Headlamp: "Headlamp", "Sleeping Bag": "Sleeping Bag", Backpack: "Backpack" };
const HEADLAMP_ATTRS = true; // build Torch-Light-style attrs even for the schemaless Headlamp type
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
function parseSizeRange(s) {
  if (!s) return null; const up = s.toUpperCase().replace(/\s+/g, " ").trim(); let m;
  if ((m = up.match(/^([A-Z]{1,3})\s*(?:TO|-)\s*([A-Z]{1,3})$/))) { const a = SIZE_ORDER.indexOf(m[1]), b = SIZE_ORDER.indexOf(m[2]); if (a > -1 && b >= a) return SIZE_ORDER.slice(a, b + 1); }
  if ((m = up.match(/^([A-Z]{1,3})\s*(?:AND|&|\+)\s*([A-Z]{1,3})$/))) return [m[1], m[2]].filter((x) => SIZE_ORDER.includes(x));
  return null;
}

// ---- feed ----
const Q = String.fromCharCode(34);
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const idx = Object.fromEntries(lines[0].split(",").map((h, i) => [h, i]));
  const parse = (line) => { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === Q) { if (line[i + 1] === Q) { c += Q; i++; } else q = false; } else c += ch; } else { if (ch === Q) q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } } o.push(c); return o; };
  return { rows: lines.slice(1).map(parse), idx };
}
async function loadFeed() {
  let text;
  if (CSV_ARG && fs.existsSync(CSV_ARG)) text = fs.readFileSync(CSV_ARG, "utf8");
  else { const res = await fetch(process.env.AWIN_DECATHLON_FEED_URL); text = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"); }
  const { rows, idx } = parseCsv(text);
  const PROMO = /sale|new collection|second life|sportswear accessories|festival|clearance|outlet/i;
  const byCode = {};
  for (const r of rows) {
    const code = (r[idx.merchant_product_id] || "").split("-")[0];
    if (!/^\d{6,8}$/.test(code)) continue;
    const cur = byCode[code];
    const mc = r[idx.merchant_category] || "";
    // prefer an in-stock, non-promo-category row
    const score = (r[idx.in_stock] === "1" ? 2 : 0) + (PROMO.test(mc) ? 0 : 1);
    if (!cur || score > cur._score) { r._score = score; byCode[code] = r; }
  }
  return { byCode, idx };
}
const clean = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
// strip a trailing colour (feed `colour` value) off the product name — colour is never
// part of product identity. e.g. "…Head Lamp - Black" (colour "Black") -> "…Head Lamp".
function stripColour(name, colour) {
  let n = name;
  for (const c of String(colour || "").split(/[\/,]/).map((x) => x.trim()).filter(Boolean)) {
    n = n.replace(new RegExp("\\s*[-–]?\\s*" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i"), "");
  }
  return n.replace(/\s*[-–]\s*$/, "").trim() || name;
}
function images(r, idx) {
  return [r[idx.merchant_image_url], r[idx.aw_image_url], r[idx.alternate_image], r[idx.alternate_image_two], r[idx.alternate_image_three], r[idx.alternate_image_four]]
    .filter((u) => u && /^https?:/.test(u)).filter((u, i, a) => a.indexOf(u) === i).slice(0, 6);
}
function batteryType(power) {
  if (/usb-?c/i.test(power)) return "Rechargeable (USB-C)";
  if (/micro-?usb/i.test(power)) return "Rechargeable (Micro USB)";
  if (/aaa|aa\b|batter/i.test(power)) return "AAA";
  return undefined;
}

(async () => {
  const { byCode, idx } = await loadFeed();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  // category/subcategory + existing offer codes for idempotency
  const existing = await C.find({ isActive: true }).select("itemType category subcategory").lean();
  const catByType = {};
  for (const e of existing) { if (!catByType[e.itemType] && e.category) catByType[e.itemType] = { category: e.category, subcategory: e.subcategory }; }
  const usedCodes = new Set((await O.find({ externalProductId: { $exists: true } }).select("externalProductId").lean()).map((o) => o.externalProductId));

  // gather store entries in ALLOW
  const entries = [];
  for (const k of Object.keys(STORE)) { if (k.startsWith("_")) continue; for (const it of STORE[k]) if (it.skus.some((s) => ALLOW.has(s))) entries.push(it); }

  let created = 0, skipped = 0;
  for (const it of entries) {
    const code = it.skus.find((s) => byCode[s]) || it.skus.find((s) => ALLOW.has(s));
    const fr = byCode[code];
    if (!fr) { console.log(`!! ${it.model}: not in feed — skip`); skipped++; continue; }
    if (usedCodes.has(code)) { console.log(`~~ ${it.model}: offer code ${code} already exists — skip`); skipped++; continue; }

    const itemType = ITEMTYPE[it.itemType] || it.itemType;
    const brand = fr[idx.brand_name] || it.brand;
    const name = stripColour(clean(fr[idx.product_name]) || `${brand} ${it.model}`, fr[idx.colour]);
    const existsByName = await C.findOne({ name, brand, isActive: true }).select("_id").lean();
    if (existsByName) { console.log(`~~ ${name}: name already active — skip`); skipped++; continue; }

    const gender = (it.specs && it.specs.gender) || "Unisex";
    const cc = catByType[itemType] || (() => { const r = categoryForItemType(itemType, gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : ""); return { category: r.category, subcategory: r.subcategory }; })();
    const imgs = images(fr, idx);
    let description = clean(fr[idx.description]) || `Decathlon ${brand} ${it.model}.`;
    description = description.slice(0, 1500);

    // attributes + optional variant axis
    const attributes = {};
    let variantAxes, variants, defaultVariantKey;
    if (itemType === "Headlamp" || itemType === "Torch Light") {
      const sp = it.specs || {};
      if (sp.lumens) attributes.maxLumens = sp.lumens;
      if (sp.beamMeters) attributes.maxBeamDistance = sp.beamMeters;
      const bt = batteryType(sp.power || ""); if (bt) attributes.batteryType = bt;
      if (sp.runtimeHours) attributes.burnTimeHigh = sp.runtimeHours;
    } else if (itemType === "Sleeping Bag") {
      const sp = it.specs || {};
      attributes.insulationType = sp.fill === "Down" ? "Down" : "Synthetic";
      if (sp.comfortTempC != null) attributes.tempRatingC = sp.comfortTempC;
      attributes.shape = "Mummy";
      attributes.gender = "Unisex";
      const fp = parseInt((sp.fillDetail || "").match(/(\d{3})\s*cuin/i)?.[1] || "");
      if ([550, 600, 650, 700, 750, 800, 850, 900, 950, 1000].includes(fp)) attributes.fillPower = fp;
      if (/rds/i.test(sp.fillDetail || "")) attributes.rdsDown = true;
      const sizes = parseSizeRange(sp.sizes);
      if (sizes && sizes.length > 1) {
        variantAxes = [{ name: "Size", values: sizes }];
        variants = sizes.map((s) => ({ key: s, options: { Size: s } }));
        defaultVariantKey = sizes.includes("L") ? "L" : sizes[0];
        description += "\n\nListed weight is for size L; other sizes vary.";
      }
    } else if (itemType === "Backpack") {
      const sp = it.specs || {};
      if (sp.capacityLiters) attributes.capacityLiters = sp.capacityLiters;
      if (sp.gender) attributes.gender = sp.gender;
      attributes.bestUse = "Travel";
    }

    console.log(`${created + 1}. ${brand.padEnd(8)} ${name.slice(0, 46).padEnd(46)} [${itemType}] ${it.weightGrams}g ${variantAxes ? "Size[" + variants.length + "]" : ""} imgs:${imgs.length} ${cc.category}/${cc.subcategory || "-"}`);

    if (COMMIT) {
      if (!imgs.length) { console.log(`   !! no image — skip`); skipped++; continue; }
      const doc = new C({
        name, brand, itemType,
        ...(cc.category ? { category: cc.category, subcategory: cc.subcategory } : {}),
        description, imageUrls: imgs, createdBy: ADMIN_ID, isActive: true,
        weightGrams: it.weightGrams,
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
        attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); skipped++; continue; }
      await O.create({ network: "awin", region: "global", merchantId: "awin-decathlon-uk", merchantName: "Decathlon UK", externalProductId: code, productId: doc._id, deepLink: fr[idx.aw_deep_link], priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
