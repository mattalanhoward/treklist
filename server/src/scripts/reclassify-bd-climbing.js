/**
 * reclassify-bd-climbing.js — Black Diamond's climbing gear was imported (pre-schema) as
 * itemType "Other". Now that Climbing Helmet / Climbing Harness / Ice Axe / Crampon /
 * Via Ferrata Set exist, reclassify BD's "Other" climbing items into them and move them to
 * Accessories & Tools / Climbing Gear. Batteries/chargers/traction devices stay "Other".
 *
 * In-place updateOne ($set) — never .save() a projected doc. Adds gender (helmet/harness)
 * and axeType/headType (ice axe) derived from the name; leaves other attributes intact.
 *
 *   node src/scripts/reclassify-bd-climbing.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const RULES = [
  [/helmet/i, "Climbing Helmet"],
  [/harness/i, "Climbing Harness"],
  [/via ?ferrata/i, "Via Ferrata Set"],
  [/ice ?axe|whippet|ice tool|\bpiolet\b|venom|raven/i, "Ice Axe"],
  [/crampon/i, "Crampon"],
];
const classify = (n) => { for (const [re, t] of RULES) if (re.test(n)) return t; return null; };
const genderOf = (n) => (/women|female|ladies/i.test(n) ? "Womens" : /\bmen'?s\b/i.test(n) ? "Mens" : "Unisex");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: "Black Diamond", isActive: true, itemType: "Other" }).select("name itemType").lean();

  const plan = [];
  for (const it of items) {
    const t = classify(it.name);
    if (!t) continue;
    const set = { itemType: t, category: "Accessories & Tools", subcategory: "Climbing Gear" };
    if (t === "Climbing Helmet" || t === "Climbing Harness") set["attributes.gender"] = genderOf(it.name);
    if (t === "Ice Axe") {
      set["attributes.axeType"] = /venom|technical|tech|ice tool/i.test(it.name) ? "Technical/Ice" : "Mountaineering/Walking";
      if (/hammer/i.test(it.name)) set["attributes.headType"] = "Hammer";
      else if (/adze/i.test(it.name)) set["attributes.headType"] = "Adze";
    }
    plan.push({ _id: it._id, name: it.name, t, set });
  }

  const by = {};
  plan.forEach((p) => (by[p.t] = (by[p.t] || 0) + 1));
  console.log(`BD "Other": ${items.length} | reclassifying: ${plan.length}`);
  console.log("by type:", JSON.stringify(by));
  console.log("\nsample:");
  plan.slice(0, 12).forEach((p) => console.log(`  ${p.t.padEnd(16)} <- ${p.name}${p.set["attributes.gender"] ? " [" + p.set["attributes.gender"] + "]" : ""}${p.set["attributes.axeType"] ? " [" + p.set["attributes.axeType"] + (p.set["attributes.headType"] ? "/" + p.set["attributes.headType"] : "") + "]" : ""}`));

  if (COMMIT) {
    let n = 0;
    for (const p of plan) { await C.collection.updateOne({ _id: p._id }, { $set: p.set }); n++; }
    console.log(`\nAPPLIED ${n} reclassifications`);
  } else console.log("\nDRY-RUN — re-run with --commit to apply");
  await mongoose.disconnect();
})();
