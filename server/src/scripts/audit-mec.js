/* audit-mec.js — read-only health/gap audit of MEC catalog in the current DB. */
require("dotenv").config();
const mongoose = require("mongoose");

async function head(url) {
  try {
    let r = await fetch(url, { method: "HEAD" });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { method: "GET" });
    return r.status;
  } catch (e) { return "ERR:" + (e.code || e.message); }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const { validateAttributes, getSchemaForItemType } = require("../config/attributeSchemas");
  const items = await C.find({ brandLC: "mec", isActive: true }).lean();
  const offerCounts = {};
  const offers = await O.find({ productId: { $in: items.map((i) => i._id) } }, { productId: 1 }).lean();
  for (const o of offers) offerCounts[o.productId] = (offerCounts[o.productId] || 0) + 1;
  await mongoose.disconnect();

  console.log(`\n=== MEC AUDIT (${process.env.MONGO_DB_NAME}) — ${items.length} active items ===\n`);
  const byCat = {}, byType = {};
  for (const it of items) {
    byCat[it.category || "(none)"] = (byCat[it.category || "(none)"] || 0) + 1;
    byType[it.itemType || "(none)"] = (byType[it.itemType || "(none)"] || 0) + 1;
  }
  console.log("BY CATEGORY:", JSON.stringify(byCat));
  console.log("BY ITEMTYPE:", JSON.stringify(byType));

  const noOffer = [], noWeight = [], noDesc = [], noImg = [], badAttr = [], altImg = [], dupName = {};
  for (const it of items) {
    dupName[it.name] = (dupName[it.name] || 0) + 1;
    if (!offerCounts[it._id]) noOffer.push(it.name);
    if (!it.description) noDesc.push(it.name);
    if (!it.imageUrls || !it.imageUrls.length) noImg.push(it.name);
    else if (/ALT_|_ALT|placeholder/i.test(it.imageUrls[0])) altImg.push(it.name + "  ::  " + it.imageUrls[0].split("/").pop());
    const hasVarW = it.variants && it.variants.some((v) => v.weightGrams != null);
    if (it.weightGrams == null && !hasVarW) noWeight.push(`${it.itemType} | ${it.name}`);
    if (it.itemType && getSchemaForItemType(it.itemType)) {
      const r = validateAttributes(it.itemType, it.attributes || {}, { strict: true });
      if (!r.valid) badAttr.push(`${it.name} -> ${r.errors.join("; ")}`);
    }
  }
  const dups = Object.entries(dupName).filter(([, n]) => n > 1);
  console.log(`\n--- COVERAGE ---`);
  console.log(`no offer: ${noOffer.length} ${noOffer.join(", ")}`);
  console.log(`no description: ${noDesc.length}`);
  console.log(`no image: ${noImg.length} ${noImg.join(", ")}`);
  console.log(`ALT/non-primary image (${altImg.length}):`); altImg.forEach((x) => console.log("   " + x));
  console.log(`duplicate names: ${dups.length} ${JSON.stringify(dups)}`);
  console.log(`\nMISSING WEIGHT (${noWeight.length}/${items.length}):`); noWeight.forEach((x) => console.log("   " + x));
  console.log(`\nMISSING REQUIRED ATTRS strict (${badAttr.length}):`); badAttr.forEach((x) => console.log("   " + x));

  console.log(`\n--- IMAGE HEALTH (${items.length} primary URLs, parallel) ---`);
  const results = [];
  const B = 10;
  for (let i = 0; i < items.length; i += B) {
    const batch = items.slice(i, i + B);
    const sts = await Promise.all(batch.map((it) => head(it.imageUrls && it.imageUrls[0])));
    batch.forEach((it, j) => results.push([it.name, sts[j], it.imageUrls && it.imageUrls[0]]));
  }
  const broken = results.filter((r) => r[1] !== 200);
  console.log(`checked ${results.length}; BROKEN/NON-200: ${broken.length}`);
  broken.forEach((b) => console.log("   " + b[1] + "  ::  " + b[0] + "  ::  " + (b[2] || "NO_URL")));
})();
