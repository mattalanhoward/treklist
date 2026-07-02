/**
 * import-opinel.js — Opinel classic folding knives (No.02–No.12), STAINLESS ONLY
 * (user dropped carbon 2026-07-02), flat single items with REAL weights from the
 * official "View All Sizes" chart. itemType Pocket Knife (empty attr schema → blade
 * material / length / lock live in description + tags). Direct opinel-usa.com offers.
 * Upsert: updates the existing No.06–12 items (removes the old Steel variant) and
 * creates No.02–05.
 *
 *   node src/scripts/import-opinel.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// from Opinel "View All Sizes" chart (Modified 12C27 Sandvik stainless). g = oz×28.3495 rounded.
const CHART = {
  "02": { g: 5, blade: '1.36"', overall: '3.25"', lock: false },
  "03": { g: 7, blade: '1.68"', overall: '3.88"', lock: false },
  "04": { g: 9, blade: '2"', overall: '4.68"', lock: false },
  "05": { g: 16, blade: '2.36"', overall: '5.5"', lock: false },
  "06": { g: 34, blade: '2.87"', overall: '6.5"', lock: true },
  "07": { g: 40, blade: '3.07"', overall: '7"', lock: true },
  "08": { g: 45, blade: '3.28"', overall: '7.59"', lock: true },
  "09": { g: 57, blade: '3.51"', overall: '8.18"', lock: true },
  "10": { g: 71, blade: '3.92"', overall: '9"', lock: true },
  "12": { g: 111, blade: '4.82"', overall: '11.04"', lock: true },
};

(async () => {
  let feed = [];
  for (const pg of [1, 2]) {
    const r = await fetch(`https://www.opinel-usa.com/products.json?limit=250&page=${pg}`, { headers: { "User-Agent": UA } });
    feed = feed.concat((await r.json()).products || []);
  }
  // prefer the plain stainless product for images/offer; fall back to carbon (identical knife body)
  const findProduct = (num) => {
    const n = num.replace(/^0/, "");
    return (
      feed.find((p) => new RegExp(`^No\\.0?${n} Stainless Steel Folding Knife$`, "i").test(p.title)) ||
      feed.find((p) => new RegExp(`^No\\.0?${n} Carbon Steel Folding Knife$`, "i").test(p.title)) ||
      null
    );
  };

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const { category, subcategory } = categoryForItemType("Pocket Knife", "Opinel No.08 Folding Knife");
  let upserted = 0;

  for (const [num, spec] of Object.entries(CHART)) {
    const name = `No.${num} Folding Knife`;
    const p = findProduct(num);
    const imgs = p ? (p.images || []).map((i) => i.src).slice(0, 8) : [];
    const desc = `The Opinel No.${num} is a classic French folding knife with a Modified 12C27 Sandvik stainless steel blade (${spec.blade} blade, ${spec.overall} open) and a beechwood handle. ${spec.lock ? "Virobloc safety locking ring." : "Non-locking friction folder."} Made in France.`;
    const tags = ["Stainless steel", "Sandvik 12C27", spec.lock ? "Locking (Virobloc)" : "Non-locking"];

    let doc = await C.findOne({ name, brand: /opinel/i });
    const isNew = !doc;
    console.log(`${isNew ? "create" : "update"}  ${name.padEnd(20)} ${spec.g}g  ${spec.lock ? "lock" : "non-lock"}  imgs:${imgs.length}${p ? "" : " (no feed product!)"}`);
    if (!COMMIT) continue;

    if (isNew) doc = new C({ name, brand: "Opinel", createdBy: ADMIN_ID });
    doc.itemType = "Pocket Knife";
    doc.category = category;
    doc.subcategory = subcategory;
    doc.isActive = true;
    doc.weightGrams = spec.g;
    doc.description = desc;
    doc.tags = tags;
    if (imgs.length) doc.imageUrls = imgs;
    // stainless only → flat item, remove any prior Steel variant
    doc.variantAxes = [];
    doc.variants = [];
    doc.defaultVariantKey = undefined;
    doc.$locals.lenientAttributes = true;
    try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }

    // ensure one direct offer (create if missing)
    const hasOffer = await O.countDocuments({ productId: doc._id });
    if (!hasOffer && p) {
      await O.create({ network: "direct", region: "global", merchantId: "direct-opinel", merchantName: "Opinel", productId: doc._id, deepLink: `https://www.opinel-usa.com/products/${p.handle}`, priority: 0 });
    }
    upserted++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${upserted} upserted`);
  await mongoose.disconnect();
})();
