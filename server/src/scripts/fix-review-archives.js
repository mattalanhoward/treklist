/**
 * fix-review-archives.js — archives, duplicate merges, and Snow Peak scope cull/re-admit from
 * the 2026-07-10 review (server/reports/catalog-review-2026-07-10.md).
 * - Nitecore: accessories/signal lights/bundles out (scope was headlamps + power banks only).
 * - Duplicate pairs: repoint the loser's offers to the winner, then archive the loser.
 * - Smartwool Kids' items out (no-kids convention, matches Icebreaker filter).
 * - Snow Peak lifestyle cull (~31) + re-admit chopsticks & small Ti flasks from the live feed
 *   (weightless; scrape-snowpeak-weights.js fills them afterwards).
 * Ref-safe: any target with GlobalItem/GearItem refs is skipped and reported.
 * updateOne/insert only; archived = isActive:false (restorable).
 *
 *   node src/scripts/fix-review-archives.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";

const NITECORE_ARCHIVE = [
  /^Battery Cap \(Tail Cap\)/i, /^NHC10 Helmet/i, /^Nitecore BM06 Headlamp Bike Mount/i,
  /^Nitecore Bracket for H Series/i, /^Nitecore Bracket for NU and UT Series/i,
  /^Nitecore Headband for H Series/i, /^Nitecore Headlamp Bracket for NVG/i,
  /^Nitecore HLB1500/i, /^Nitecore Carbon Battery 12K Extended/i, /^Nitecore Carbon Battery 6K Extended/i,
  /^Replacement Lens for the Nitecore/i,
  /^NU05 v2/i, /^Nitecore NU06 LE/i, /^Nitecore NU06 MI/i, /^Nitecore NU07 LE/i,
  /Headlamp with NB10000 Gen 4 Power Bank$/i, /Headlamp with NB Air Power Bank$/i,
  /with Carbon Battery 6K Extended Runtime Kit$/i, /with NB20000 Gen 3 Power Bank$/i,
  /Includes Extra HLB-1500 Battery$/i,
  /^Nitecore NWL30/i, /^Nitecore SCL10/i,
];
// dupe merges: [brand, loser exact name, winner exact name]
const DUPES = [
  ["Nitecore", "NB20000", "Nitecore NB20000 Gen 3 Dual USB-C Power Bank"],
  ["Nitecore", "NU20 Classic", "Nitecore NU20 Classic 360 Lumen USB-C Lightweight Outdoor Headlamp"],
  ["Nitecore", "NB Air 5000mAh", "Nitecore NB Air Ultra Lightweight and Slim USB-C 5000mAh Power Bank"],
  ["Nitecore", "NB Plus 10,000mAh", "Nitecore NB Plus 10,000mAh Lightweight Power Bank"],
  ["Flextail", "Zero Pump Air Pump", "ZERO PUMP"],
  ["Flextail", "Zero Power 10,000 C", "ZERO POWER 10,000C"],
  ["Flextail", "ZERO MATTRESS R05 Regular 183cm", "ZERO MATTRESS R05"],
  ["MSR", "Front Range™ 4-Person Ultralight Tarp Shelter", "Front Range™ 4 Person Ultralight Tarp Shelter"],
];
const FLEXTAIL_ARCHIVE = [/^Mosquito Repellent Mats for FLEXTAIL/i];
const SNOWPEAK_CULL = [
  "Shimo Stein", "Shimo Tumbler", "Shimo Tumbler Set", "Shimo Can Cooler in 350ml", "Shimo Can Cooler in 500ml",
  "Kanpai Bottle 350ml", "Kanpai Bottle 500ml", "Titanium 350 Kanpai Bottle",
  "Titanium Sake Cup", "Titanium Sake Bottle", "Milk Bottle in 350ml", "Charcuterie Plate",
  "Field Barista Kettle", "Field Barista Coffee Drip", "Field Barista Set", "Field Coffee Master", "Field Coffee Brewer",
  "Summer Stacking Mug Set", "Stacking Mug Set M", "Stacking Mug Set H",
  "Earthen Zen Pot", "Classic Kettle 1.8", "12pc. Titanium Cutlery Set",
  "Tableware Plate L", "Tableware Bowl L", "Tableware Bowl M", "Tableware Dish",
  "Burner Sheet", "Folding Torch", "Bamboo Spatula", "Hotlips 2 Piece Set",
  // stragglers found during the weight scrape (name variants the first list missed)
  "Field Barista Kettle in Black", "Field Coffee Master Set", "Ti-Single 300 Cup Cover", "Stainless Steel Food Canister",
  "Kanpai Cooler Lid", "Kanpai Tumbler Lid",
];
// Snow Peak re-admits (excluded by over-broad name filter): feed title -> itemType
const SNOWPEAK_READMIT = {
  "Wabuki Chopsticks": "Utensil",
  "Titanium Chopsticks": "Utensil",
  "Anodized Titanium Chopsticks": "Utensil",
  "Titanium Flask in 250 mL": "Water Bottle",
  "Round Titanium Flask in 150 mL": "Water Bottle",
};
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const GlobalItem = require("../models/globalItem");
  const GearItem = require("../models/gearItem");

  const refCount = async (id) => (await GlobalItem.countDocuments({ productId: id })) + (await GearItem.countDocuments({ productId: id }));
  let archived = 0, skippedRefs = 0;
  const archive = async (it, why) => {
    const refs = await refCount(it._id);
    if (refs > 0) { console.log(`  !! REFS(${refs}) — skipped: ${it.brand}: ${it.name}`); skippedRefs++; return false; }
    console.log(`  archive [${why}] ${it.brand}: ${it.name.slice(0, 60)}`);
    archived++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { isActive: false } });
    return true;
  };

  console.log("== NITECORE strays/bundles ==");
  const nc = await C.find({ brand: "Nitecore", isActive: true }).select("name brand").lean();
  for (const it of nc) if (NITECORE_ARCHIVE.some((re) => re.test(it.name))) await archive(it, "nitecore-scope");

  console.log("\n== FLEXTAIL junk ==");
  const fx = await C.find({ brand: "Flextail", isActive: true }).select("name brand").lean();
  for (const it of fx) if (FLEXTAIL_ARCHIVE.some((re) => re.test(it.name))) await archive(it, "flextail-junk");

  console.log("\n== DUPLICATE MERGES (repoint offers -> winner, archive loser) ==");
  // Dupes archive EVEN WITH REFS: per the archive-and-readd trace, GlobalItem/GearItem keep
  // their denormalized snapshot + affiliate deepLink when the catalog item goes inactive.
  for (const [brand, loserName, winnerName] of DUPES) {
    const loser = await C.findOne({ brand, name: loserName, isActive: true }).select("name brand").lean();
    const winner = await C.findOne({ brand, name: winnerName, isActive: true }).select("name brand").lean();
    if (!loser || !winner) { console.log(`  !! pair not found: ${loserName} / ${winnerName}`); continue; }
    const refs = await refCount(loser._id);
    if (refs > 0) console.log(`  (note: "${loserName}" has ${refs} refs — archived anyway, snapshot keeps working)`);
    const loserOffers = await O.find({ productId: loser._id }).lean();
    const winnerOffers = await O.find({ productId: winner._id }).lean();
    for (const lo of loserOffers) {
      const dup = winnerOffers.find((w) => w.merchantId === lo.merchantId);
      if (dup) {
        console.log(`  drop redundant ${lo.merchantId} offer of loser "${loserName}"`);
        if (COMMIT) await O.deleteOne({ _id: lo._id });
      } else {
        console.log(`  repoint ${lo.merchantId} offer: "${loserName}" -> "${winnerName}"`);
        if (COMMIT) await O.updateOne({ _id: lo._id }, { $set: { productId: winner._id } });
      }
    }
    console.log(`  archive [dup] ${loser.brand}: ${loser.name.slice(0, 60)}`);
    archived++;
    if (COMMIT) await C.collection.updateOne({ _id: loser._id }, { $set: { isActive: false } });
  }

  console.log("\n== SMARTWOOL kids ==");
  const kids = await C.find({ brand: "Smartwool", isActive: true, name: /^(kids'?|junior)\b/i }).select("name brand").lean();
  for (const it of kids) await archive(it, "kids");

  console.log("\n== SNOW PEAK lifestyle cull ==");
  for (const name of SNOWPEAK_CULL) {
    const it = await C.findOne({ brand: "Snow Peak", name, isActive: true }).select("name brand").lean();
    if (!it) { console.log(`  !! not found: ${name}`); continue; }
    await archive(it, "sp-lifestyle");
  }

  console.log("\n== SNOW PEAK re-admits (chopsticks, small Ti flasks) ==");
  let feed = [];
  for (let page = 1; page <= 4; page++) {
    try {
      const r = await fetch(`https://www.snowpeak.com/products.json?limit=250&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) break;
      const j = await r.json();
      if (!j.products || !j.products.length) break;
      feed.push(...j.products);
    } catch (e) { break; }
  }
  console.log(`  feed: ${feed.length} products`);
  for (const [title, itemType] of Object.entries(SNOWPEAK_READMIT)) {
    const p = feed.find((x) => strip(x.title) === title);
    if (!p) { console.log(`  !! not in feed: ${title}`); continue; }
    if (await C.findOne({ name: title, brand: "Snow Peak", isActive: true }).select("_id").lean()) { console.log(`  == exists: ${title}`); continue; }
    const { category, subcategory } = categoryForItemType(itemType, "");
    const images = (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 5);
    console.log(`  create [${itemType}] ${title} (weight via scrape pass)`);
    if (COMMIT) {
      const doc = new C({
        name: title, brand: "Snow Peak", itemType, ...(category ? { category, subcategory } : {}),
        description: strip(p.body_html).slice(0, 1000), imageUrls: images, createdBy: ADMIN_ID, isActive: true, attributes: {},
      });
      doc.$locals.lenientAttributes = true;
      await doc.save();
      await O.create({ network: "direct", region: "global", merchantId: "direct-snowpeak", merchantName: "Snow Peak", productId: doc._id, deepLink: `https://www.snowpeak.com/products/${p.handle}`, priority: 0 });
    }
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${archived}, ref-skipped ${skippedRefs}`);
  await mongoose.disconnect();
})();
