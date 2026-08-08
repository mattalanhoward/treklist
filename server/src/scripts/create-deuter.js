/**
 * create-deuter.js — Deuter (deuter.com), custom SSR site, NO open feed and curl is
 * bot-redirected. Done by RENDERED SCRAPE (WebFetch reads the SSR product pages; the
 * deuter.com/media image CDN is not walled). Enumerated from the us-en sitemap (colour-
 * collapse by slug); ⚠ the sitemap over-lists EU-only models that 404 in the US range,
 * so URLs are the CANONICAL 7-digit product URLs (packs) / live sitemap colour URLs
 * (bags) confirmed via WebFetch. Specs (weight/back-length/temp/fill/image) were scraped
 * per PDP (2026-08-08) and stored in deuter-scraped.json.
 *
 * Scope (user): backpacks + dayhike packs 18-65 L (no travel/laptop/commuter/kids, no
 * Guide climbing line), men's + women's (SL = women's fit), + sleeping bags. No mats
 * (Deuter has none in the US range). Colour dropped. 58 items (40 packs + 18 bags).
 *
 * Update-or-create by name (supersedes the 6 old manual Deuter entries where names match).
 *
 *   node src/scripts/create-deuter.js [--commit]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const BRAND = "Deuter";
const BAG = /^(astro|orbit|exosphere|dreamlite)/;
const BACKPACK_LINE = /^(aircontact-core|aircontact-lite|aircontact-ultra|aircontact-pro|futura-air-trek|futura-pro|trail-pro)/;

const titleCase = (slug) => slug.split("-").map((w) => (w === "sl" ? "SL" : w === "el" ? "EL" : w === "ac" ? "AC" : w === "sq" ? "SQ" : /^\d+$/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(" ").replace(/(\d+) (\d+)/, "$1+$2");
const fTemp = (slug) => { const m = slug.match(/-(\d+)f$/); return m ? Math.round((+m[1] - 32) * 5 / 9) : null; };

function packItem(slug, d) {
  const name = titleCase(slug);
  const volume = +slug.replace(/^[a-z-]*?(?=\d)/, "").match(/^(\d+)/)[1];
  const women = /-sl(-|$)/.test(slug);
  const itemType = BACKPACK_LINE.test(slug) ? "Backpack" : "Daypack";
  const attributes = { volumeLiters: volume, gender: women ? "Womens" : "Unisex", ...(d.back ? { torsoFitRange: d.back } : {}) };
  const desc = `The Deuter ${titleCase(slug)} is a ${volume} L ${women ? "women's-fit (SL) " : ""}${itemType === "Backpack" ? "trekking/backpacking pack" : "hiking daypack"} with Deuter's ventilated back system${d.back ? `, adjustable back length ${d.back}` : ""}. Weight ${d.w} g.`;
  return { name, itemType, attributes, desc, wt: d.w, img: d.img, url: d.url };
}
function bagItem(slug, d) {
  const tF = fTemp(slug);
  let model;
  if (/^astro/.test(slug)) model = titleCase(slug.replace(/-\d+c-\d+f$/, "")); // Astro 300 / Astro Pro 800 / Astro 500 SQ
  else { const base = slug.split("-")[0][0].toUpperCase() + slug.split("-")[0].slice(1); model = `${base}${/-sq-/.test(slug) ? " SQ" : ""} ${tF > 0 ? "+" + tF : tF}°`; }
  const name = model;
  const fp = (d.fill.match(/(\d{3})\s*(?:FP|cuin)/i) || [])[1];
  const attributes = {
    insulationType: d.down ? "Down" : "Synthetic",
    ...(d.comfort <= 16 ? { tempRatingC: d.comfort } : {}), // schema caps tempRatingC at 16
    shape: /-sq-/.test(slug) ? "Rectangular" : "Mummy", gender: "Unisex",
    ...(fp ? { fillPower: +fp } : {}),
  };
  const desc = `The Deuter ${model} is a ${d.down ? "down" : "synthetic"} sleeping bag (${d.fill}), EN/ISO comfort rating ${d.comfort} °C. Weight ${d.w} g.`;
  return { name, itemType: "Sleeping Bag", attributes, desc, wt: d.w, img: d.img, url: d.url };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "deuter-scraped.json"), "utf8"));
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, updated = 0; const byType = {};

  for (const [slug, d] of Object.entries(data)) {
    const it = BAG.test(slug) ? bagItem(slug, d) : packItem(slug, d);
    if (!it.img) { console.log(`  !! no image — skip ${it.name}`); continue; }
    const { category, subcategory } = categoryForItemType(it.itemType, it.name);
    byType[it.itemType] = (byType[it.itemType] || 0) + 1;
    const existing = await C.findOne({ name: it.name, brand: BRAND });
    console.log(`${existing ? "UPD" : "NEW"} ${it.itemType.padEnd(12)} ${it.name.slice(0, 34).padEnd(34)} ${it.wt}g ${JSON.stringify(it.attributes)}`);
    if (COMMIT) {
      const set = { name: it.name, brand: BRAND, itemType: it.itemType, category, subcategory, description: it.desc, imageUrls: [it.img], isActive: true, weightGrams: it.wt, attributes: it.attributes, variantAxes: [], variants: [], defaultVariantKey: null };
      if (existing) { await C.collection.updateOne({ _id: existing._id }, { $set: set }); updated++; }
      else {
        const doc = new C({ ...set, createdBy: ADMIN_ID }); doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`  !! ${it.name}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-deuter", merchantName: BRAND, productId: doc._id, deepLink: it.url, priority: 0 });
        created++;
      }
    }
  }
  console.log(`\nby itemType:`, JSON.stringify(byType));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${created}, updated ${updated} (of ${Object.keys(data).length})`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
