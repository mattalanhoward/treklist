/**
 * archive-tarptent-ggg.js — reconcile the GGG back-door Tarptent items now that we have
 * brand-direct versions (see create-tarptent.js). Archives any ACTIVE Tarptent item
 * whose only offer is Garage Grown Gear (`direct-ggg`) AND for which a same-name active
 * Tarptent item now carries a `direct-tarptent` offer — i.e. the direct import
 * superseded it. Same precedent as Cascade replacing Amazon-linked items with
 * brand-direct. Aeon Li (no direct twin — Sale-only/OOS on tarptent.com) is left alone.
 *
 *   node src/scripts/archive-tarptent-ggg.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const active = await C.find({ brand: /tarptent/i, isActive: true }).lean();
  // names that now have a direct-tarptent offer
  const directNames = new Set();
  for (const it of active) {
    const o = await O.findOne({ productId: it._id, merchantId: "direct-tarptent" }).lean();
    if (o) directNames.add(it.name);
  }

  let archived = 0;
  for (const it of active) {
    const offers = await O.find({ productId: it._id }).lean();
    const onlyGGG = offers.length > 0 && offers.every((o) => o.merchantId === "direct-ggg");
    const hasDirectTwin = directNames.has(it.name);
    // an item is a GGG twin if it's GGG-only AND a *different* item of the same name is now direct
    const isSupersededTwin = onlyGGG && hasDirectTwin;
    if (isSupersededTwin) {
      console.log(`ARCHIVE  ${it.name.padEnd(24)} (GGG-only, superseded by direct twin)`);
      if (COMMIT) { await C.collection.updateOne({ _id: it._id }, { $set: { isActive: false } }); archived++; }
    } else if (onlyGGG) {
      console.log(`KEEP     ${it.name.padEnd(24)} (GGG-only, no direct twin — left as-is)`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${archived}`);
  await mongoose.disconnect();
})();
