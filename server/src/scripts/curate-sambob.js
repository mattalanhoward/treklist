/**
 * curate-sambob.js — further Sam Bob cleanup (2026-07-02):
 * (1) archive duplicate listings that carry bogus box-weights (3175 g / 5443 g) — the
 *     "<name>: Hoodies" (colon/plural) versions with sane weights supersede them; +
 *     the stray untyped "Alpha 90".
 * (2) standardize typing: Sam Bob is all Alpha-Direct/grid/Octa active-insulation
 *     fleece → type every hoodie/crewneck as **Fleece Jacket** (some were Insulated
 *     Jacket). Fleece Jacket also carries the fleeceType attribute (Alpha Direct / Grid).
 *
 *   node src/scripts/curate-sambob.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ARCHIVE = [
  "Alpha 90 Hoodie",   // dup of "Alpha 90: Hoodies" (was 3175 g)
  "Alpha 120 Hoodie",  // dup of "Alpha 120: Hoodies" (was 3175 g)
  "Microgrid Hoodie",  // dup of "Microgrid Hoodies" (was 5443 g)
  "Octa Hoodie",       // dup of "Octa: Hoodies"
  "Alpha 90",          // stray, untyped, no data
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let arch = 0, retyped = 0;

  for (const name of ARCHIVE) {
    const d = await C.findOne({ name, brand: /sam bob/i, isActive: true });
    if (!d) { console.log(`  ! archive "${name}" not found`); continue; }
    console.log(`archive  ${name}  (${d.weightGrams ?? "-"}g)`);
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { isActive: false } }); arch++; }
  }

  // standardize: all remaining Sam Bob "Insulated Jacket" (Alpha Direct) → Fleece Jacket
  const toRetype = await C.find({ brand: /sam bob/i, isActive: true, itemType: "Insulated Jacket" }).select("name").lean();
  const { category, subcategory } = categoryForItemType("Fleece Jacket", "Unisex Hoodie");
  for (const d of toRetype) {
    console.log(`retype   ${d.name}  Insulated Jacket → Fleece Jacket`);
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { itemType: "Fleece Jacket", category, subcategory } }); retyped++; }
  }

  const active = await C.find({ brand: /sam bob/i, isActive: true }).select("name itemType weightGrams").lean();
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"}: archived ${arch || ARCHIVE.length}, retyped ${retyped || toRetype.length} | active after: ${COMMIT ? active.length : active.length - ARCHIVE.length}`);
  if (COMMIT) { console.log("\nweightless remaining:", active.filter((a) => a.weightGrams == null).map((a) => a.name).join(", ") || "none"); }
  await mongoose.disconnect();
})();
