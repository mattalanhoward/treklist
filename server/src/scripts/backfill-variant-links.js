/**
 * backfill-variant-links.js — 2026-07-03. Per-variant offer routing backfill.
 * For every owned GlobalItem that references a catalog item + a variantKey, if that
 * catalog variant now carries its own `deepLink`, denormalize it onto the owned item's
 * `affiliate.deepLink` (the placeholder → the exact variant the user selected). The
 * live resolver (`affiliates.js`) already routes correctly; this fixes the stored link
 * the tile view uses + any cached state. Safe/idempotent.
 *
 *   node src/scripts/backfill-variant-links.js [--commit] [--db <name> --confirm <name>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
const dbArg = (() => { const i = process.argv.indexOf("--db"); return i >= 0 ? process.argv[i + 1] : null; })();
const confirmArg = (() => { const i = process.argv.indexOf("--confirm"); return i >= 0 ? process.argv[i + 1] : null; })();
const DB = dbArg || process.env.MONGO_DB_NAME;
if (COMMIT && DB !== "treklist_local" && confirmArg !== DB) {
  console.error(`Refusing to --commit to "${DB}" without --confirm ${DB}`); process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const GlobalItem = require("../models/globalItem");
  const CatalogItem = require("../models/catalogItem");

  const owned = await GlobalItem.find({
    productId: { $exists: true, $ne: null },
    variantKey: { $exists: true, $ne: null },
  }).select("productId variantKey affiliate").lean();

  console.log(`owned items with a variantKey: ${owned.length}`);
  // cache catalog variant links
  const catCache = new Map();
  let updated = 0, noLink = 0, alreadyOk = 0;
  for (const gi of owned) {
    const pid = String(gi.productId);
    if (!catCache.has(pid)) {
      const c = await CatalogItem.findById(pid).select("variants").lean();
      catCache.set(pid, c?.variants || []);
    }
    const v = catCache.get(pid).find((x) => x.key === gi.variantKey);
    if (!v?.deepLink) { noLink++; continue; }
    if (gi.affiliate?.deepLink === v.deepLink) { alreadyOk++; continue; }
    console.log(`  ${pid} [${gi.variantKey}] → ${v.deepLink.split("/").slice(-2).join("/")}`);
    if (COMMIT) await GlobalItem.updateOne({ _id: gi._id }, { $set: { "affiliate.deepLink": v.deepLink } });
    updated++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — updated:${updated} already-ok:${alreadyOk} variant-has-no-link:${noLink}`);
  await mongoose.disconnect();
})();
