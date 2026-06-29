/**
 * curate-zpacks-remove-leftovers.js
 *
 * Archives Zpacks one-off leftover SKUs (OVERSTOCK + Clearance — limited single
 * sizes) and the two manually-added duplicate "Zpacks Classic Sleeping Bag
 * 10°F/30°F" items (already covered by the "Classic Sleeping Bag" Temperature
 * variant parent). Reversible (isActive:false).
 *
 *   node src/scripts/curate-zpacks-remove-leftovers.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const DUPES = ["Zpacks Classic Sleeping Bag 10°F", "Zpacks Classic Sleeping Bag 30°F"];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const r1 = await C.updateMany({ brand: /zpacks/i, isActive: true, name: /^overstock|^clearance/i }, COMMIT ? { $set: { isActive: false } } : {});
  const r2 = await C.updateMany({ brand: /zpacks/i, isActive: true, name: { $in: DUPES } }, COMMIT ? { $set: { isActive: false } } : {});
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: overstock/clearance matched ${r1.matchedCount}, duplicate Classic bags matched ${r2.matchedCount}`);
  await mongoose.disconnect();
})();
