/**
 * create-kathmandu.js — Kathmandu (kathmandu.co.nz), a large NZ/AU Shopify store. Scope
 * (user, 2026-08-07): the BACKPACKING-RELEVANT house-brand GEAR only — NOT the clothing
 * line, water bottles, chairs, third-party vendors, kids, travel/lifestyle, or the
 * car-camping/beach/family kit (dayroom & beach shelters, 12kg family tents, thick
 * car-camping air-beds). Reads `kathmandu-raw.json` (the gear-scope products dumped from
 * the feed; Cloudflare rate-limits bulk products.json so a saved dump is used).
 *
 * ⚠ Kathmandu lists a SEPARATE product per colourway → COLOUR-COLLAPSE by base name (the
 * colour is the Colour option value, stripped from the title end). Size lives in the
 * Size option (sometimes ALSO in the title for bags → stripped). Temperature stays in the
 * bag name (identity); Size (Regular/Large/torso) is the variant axis.
 *
 * ⚠ WEIGHTS: the feed `grams` are SHIPPING weights (a 40L pack reads 2000g but is ~850g;
 * down bags all read 2000g) → imported NULL here, backfilled from PDPs by
 * backfill-kathmandu-weights.js. Direct offers, deep-link to the representative product.
 *
 *   node src/scripts/create-kathmandu.js [--commit]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const BRAND = "Kathmandu";

const MAP = {
  "Tents All": "Backpacking Tent", "Down Mummy": "Sleeping Bag", "Down Rectangular": "Sleeping Bag",
  "Synthetic Bags": "Sleeping Bag", "Sleeping Bag Liners": "Sleeping Bag Liner", "Sleeping Mats": "Inflatable Sleeping Pad",
  "Outdoor Packs 40L+": "Backpack", "Outdoor Daypacks 0-39L": "Daypack", "Active Daypacks 0-39L": "Daypack",
  "Bladders": "Hydration Reservoir", "Head Torches": "Headlamp", "Hand Torches": "Torch Light", "Camp Lighting": "Camp Lantern",
  "First Aid & Survival": "First Aid Kit", "Gas": "Stove Fuel", "Kitchenware": "Backpacking Pot", "Tableware": "Utensil",
  "MF Towels": "Travel Towel",
  // dropped this pass: "Insulated Flasks & Mugs" (= resold Hydro Flask, third-party) and
  // "KMD Boots" (footwear — deferred like clothing; incl. lifestyle Winterburn boots).
};
// car-camping / beach / family / kids — dropped from the backpacking scope
const CARCAMP = /dayroom|beach|cabana|gazebo|compass hub|roamer|air bed|double (mat|air)|family|picnic|\b(7-9|4-5|2-3) person\b|retreat (80|280|360)|kids|mini globe|blanket/i;

// build a whitespace/slash-flexible regex for a colour value (feed titles vary, e.g. "Dark Fern/ Dark Moss")
const looseColour = (c) => c.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*").replace(/\//g, "\\s*/\\s*");
function baseName(p) {
  let t = p.title.replace(/\s+/g, " ").trim();
  const colour = (p.options.find((o) => /colou?r/i.test(o.name)) || {}).values?.[0];
  if (colour) t = t.replace(new RegExp("\\s*-\\s*" + looseColour(colour) + "\\s*$", "i"), "").trim();
  t = t.replace(/\s*-\s*(Regular|Large|Long|Extra Large)\s*$/i, "").trim(); // size-in-title (bags)
  return t;
}
// canonicalise messy sleeping-bag names so dup listings merge (e.g. "Camper -3 S/Bag" == "Camper - 3 Sleeping Bag")
function canonicalBagName(base) {
  const temp = tempOf(base);
  const down = /down/i.test(base);
  const model = base.replace(/\s*-?\s*-?\d{1,2}\s*°?\s*C?\b/, " ").replace(/\b(down|s\/bag|sleeping bag|sleeping|bag)\b/gi, " ").replace(/\s+/g, " ").trim();
  return `${model}${temp != null ? ` ${temp}°C` : ""}${down ? " Down" : ""} Sleeping Bag`.replace(/\s+/g, " ").trim();
}
function normSize(v) {
  const s = String(v).trim();
  if (/^(one|onel|onesize|os)$/i.test(s)) return null;
  if (/^\d+\s*ltr$/i.test(s)) return null;      // volume → in name
  if (/^\d+\s*per$/i.test(s)) return null;      // capacity → in name
  if (/^wregl$/i.test(s)) return "Women's Regular";
  if (/^regl$/i.test(s)) return "Regular";
  if (/^lrgl$/i.test(s)) return "Large";
  return s; // torso (S/M, M/L…), mat length (185CM)…
}
const genderOf = (n) => (/women|ladies|w's/i.test(n) ? "Womens" : /\bmen|m's|boys/i.test(n) ? "Mens" : "Unisex");
const capOf = (n) => { const m = n.match(/(\d)\s*(?:person|per)\b/i); return m ? `${m[1]}-Person` : null; };
const volOf = (n) => { const m = n.match(/(\d{1,3})\s*L\b/i); return m ? Number(m[1]) : null; };
function tempOf(n) {
  let m = n.match(/(-?\d{1,2})\s*°\s*C\b/i); if (m) return +m[1];                                  // explicit °C
  m = n.match(/\s-\s*(\d{1,2})\s+(?:down\s+)?(?:sleeping|s\/bag)/i); if (m) return -(+m[1]);        // "Ridge - 6 Sleeping"
  m = n.match(/(?:sleeping bag|s\/bag)\s+(-?\d{1,2})\b/i); if (m) return +m[1];                     // "Camper Sleeping Bag -8"
  m = n.match(/\s(-?\d{1,2})\s+(?:down\s+)?(?:sleeping|s\/bag)/i); if (m) return +m[1];             // "Camper -8 S/Bag", "Seeker 5 Sleeping"
  return null;
}
function attrsFor(itemType, name, pt) {
  const a = { gender: genderOf(name) };
  if (itemType === "Backpacking Tent") { const c = capOf(name); if (c) a.capacity = c; a.seasonRating = "3-Season"; }
  if (itemType === "Sleeping Bag") { a.insulationType = /down/i.test(pt) || /down/i.test(name) ? "Down" : "Synthetic"; const t = tempOf(name); if (t != null) a.tempRatingC = t; }
  if (itemType === "Backpack" || itemType === "Daypack") { const v = volOf(name); if (v) a.volumeLiters = v; }
  return a;
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "kathmandu-raw.json"), "utf8"));
  const kept = raw.filter((p) => MAP[p.product_type] && !CARCAMP.test(p.title));
  const groups = {};
  for (const p of kept) { const b = MAP[p.product_type] === "Sleeping Bag" ? canonicalBagName(baseName(p)) : baseName(p); (groups[b] = groups[b] || []).push(p); }

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let done = 0; const byType = {};

  for (const [name, g] of Object.entries(groups).sort()) {
    let itemType = MAP[g[0].product_type];
    if (itemType === "Inflatable Sleeping Pad" && /foam/i.test(name)) itemType = "Foam Sleeping Pad";
    // representative = product with the most images
    const rep = g.slice().sort((a, b) => (b.images.length - a.images.length))[0];
    const attributes = attrsFor(itemType, name, g[0].product_type);
    // Size axis = unique normalized sizes across the whole colour group
    const sizeVals = [...new Set(g.flatMap((p) => (p.options.find((o) => o.name === "Size") || { values: [] }).values.map(normSize)).filter(Boolean))];
    let variantAxes, variants, defaultVariantKey;
    if (sizeVals.length > 1) {
      variantAxes = [{ name: "Size", values: sizeVals }];
      variants = sizeVals.map((s) => ({ key: s, options: { Size: s } }));
      defaultVariantKey = sizeVals.find((s) => /regular|^m$|^s\/m$/i.test(s)) || sizeVals[0];
    }
    const { category, subcategory } = categoryForItemType(itemType, name);
    const deepLink = `https://www.kathmandu.co.nz/products/${rep.handle}`;
    const body = (rep.body_html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim().slice(0, 360);

    byType[itemType] = (byType[itemType] || 0) + 1;
    console.log(`${itemType.padEnd(22)} ${name.slice(0, 42).padEnd(42)} ${sizeVals.length > 1 ? "[" + sizeVals.join("/") + "]" : ""} ${JSON.stringify(attributes)}`);
    if (COMMIT) {
      if (!rep.images.length) { console.log(`  !! no images — skip ${name}`); continue; }
      const existing = await C.findOne({ name, brand: BRAND });
      const setF = {
        name, brand: BRAND, itemType, category, subcategory, description: body, imageUrls: rep.images,
        isActive: true, attributes, weightGrams: null,
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : { variantAxes: [], variants: [], defaultVariantKey: null }),
      };
      if (existing) { await C.collection.updateOne({ _id: existing._id }, { $set: setF }); }
      else {
        const doc = new C({ ...setF, createdBy: ADMIN_ID }); doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`  !! ${name}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-kathmandu", merchantName: BRAND, productId: doc._id, deepLink, priority: 0 });
      }
      done++;
    }
  }
  console.log(`\nby itemType:`, JSON.stringify(byType));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? done + " written" : Object.keys(groups).length + " distinct items"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
