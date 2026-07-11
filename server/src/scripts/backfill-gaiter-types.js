/**
 * backfill-gaiter-types.js — move existing leg/shoe gaiters and neck gaiters out of
 * the catch-all "Hat/Headwear" (and a couple of mistypes) into the two new dedicated
 * itemTypes added 2026-07-08: "Gaiters" (leg/shoe) and "Neck Gaiter".
 *
 * Classification (by name + current subcategory):
 *  - spare gaiter CORD (an accessory, not a gaiter) -> Other / Accessories & Tools
 *  - balaclava (a head/face covering, NOT a neck tube) -> stays Hat/Headwear (fixes
 *    the OR Alpine Fleece Balaclava which was mistyped "Fleece Jacket")
 *  - neck gaiter / neck warmer / buff, or anything already filed under the
 *    "Neck Gaiter" subcategory (e.g. FarPointe Wool Gaiter) -> "Neck Gaiter"
 *  - any other "...gaiter..." -> "Gaiters" (leg/shoe)
 *
 * Category/subcategory is recomputed via categoryForItemType (gendered from name).
 * Light attribute enrichment from name keywords (height/bestUse for leg gaiters,
 * material for neck gaiters). Written with collection.updateOne (NOT .save(), which
 * would re-run the pre-save normalize hook and wipe unselected fields — see the
 * gotcha memory).
 *
 *   node src/scripts/backfill-gaiter-types.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const WOMENS = /\b(women[’']?s|woman[’']?s|female|ladies)\b/i;
const MENS = /\b(men[’']?s|man[’']?s|male)\b/i;
function gender(name) {
  const w = WOMENS.test(name);
  const m = MENS.test(name);
  if (w && !m) return "Womens";
  if (m && !w) return "Mens";
  return "Unisex";
}

function legAttrs(name) {
  const a = { gender: gender(name) };
  if (/\bhigh\b|crocodile|expedition|rocky mountain high/i.test(name)) a.height = "High/Knee";
  else if (/\bmid\b|mid-?height/i.test(name)) a.height = "Mid-Calf";
  else if (/\blow\b|swift run|helium|ul distance|distance gaiter|trail gaiter/i.test(name)) a.height = "Low/Ankle";
  if (/swift run|trail gaiter|distance|running/i.test(name)) a.bestUse = "Trail Running";
  else if (/crocodile|rocky mountain|expedition|mountaineering|frontpoint|cirque/i.test(name)) a.bestUse = "Mountaineering";
  else if (/ferrosi trail|trail/i.test(name)) a.bestUse = "Hiking";
  return a;
}
function neckAttrs(name) {
  const a = { gender: gender(name) };
  if (/merino/i.test(name)) a.material = "Merino Wool";
  else if (/fleece/i.test(name)) a.material = "Fleece";
  else if (/wool/i.test(name)) a.material = "Merino Wool";
  else a.material = "Synthetic";
  return a;
}

function classify(item) {
  const n = item.name;
  if (/spare gaiter cord|gaiter cord/i.test(n)) return { itemType: "Other" };
  if (/balaclava/i.test(n)) return { itemType: "Hat/Headwear" };
  if (/neck gaiter|neck warmer|\bbuff\b/i.test(n) || item.subcategory === "Neck Gaiter") return { itemType: "Neck Gaiter" };
  if (/\bgaiter(s)?\b/i.test(n)) return { itemType: "Gaiters" };
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ name: /gaiter|neck warmer|balaclava/i, isActive: true }).select("name brand itemType category subcategory").lean();

  const plan = [];
  for (const it of items) {
    const cls = classify(it);
    if (!cls) continue;
    const t = cls.itemType;
    let category, subcategory, attributes;
    if (t === "Other") {
      category = "Accessories & Tools";
      subcategory = undefined;
      attributes = {};
    } else {
      const cc = categoryForItemType(t, it.name);
      category = cc.category;
      subcategory = cc.subcategory;
      attributes = t === "Gaiters" ? legAttrs(it.name) : t === "Neck Gaiter" ? neckAttrs(it.name) : {};
    }
    // skip no-ops (already the target type + category)
    if (it.itemType === t && it.category === category && it.subcategory === subcategory) continue;
    plan.push({ _id: it._id, name: it.name, brand: it.brand, from: `${it.itemType} / ${it.category}/${it.subcategory}`, to: `${t} / ${category}/${subcategory}`, category, subcategory, itemType: t, attributes });
  }

  plan.forEach((p) => console.log(`${p.brand.padEnd(18)} ${p.name.slice(0, 40).padEnd(40)} ${p.from}  ->  ${p.to}  ${JSON.stringify(p.attributes)}`));
  console.log(`\n${plan.length} items to reclassify`);

  if (COMMIT) {
    for (const p of plan) {
      const $set = { itemType: p.itemType, category: p.category, attributes: p.attributes };
      const $unset = {};
      if (p.subcategory) $set.subcategory = p.subcategory;
      else $unset.subcategory = "";
      const update = { $set };
      if (Object.keys($unset).length) update.$unset = $unset;
      await C.collection.updateOne({ _id: p._id }, update);
    }
    console.log(`APPLIED: ${plan.length} updated`);
  } else {
    console.log("DRY-RUN");
  }
  await mongoose.disconnect();
})();
