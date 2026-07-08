/**
 * migrate-globalitem-variant-index.js — replace the GlobalItem unique index
 * {owner, productId} → {owner, productId, variantKey} so a user can own multiple
 * variants of one catalog item (e.g. Prospector 50L AND 60L). Drops the old index;
 * the model definition creates the new one. Idempotent.
 *
 *   node src/scripts/migrate-globalitem-variant-index.js [--commit] [--db <n> --confirm <n>]
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
  const coll = mongoose.connection.collection("globalitems");
  const before = await coll.indexes();
  console.log("indexes before:", before.map((i) => i.name).join(", "));

  const NEW = "uniq_owner_productId_variant";
  // stale/superseded unique indexes that block owning >1 variant of a catalog item
  // (not in the current model): the productId-only + the status-scoped orphans.
  const DROP = ["uniq_owner_productId", "uniq_owner_productId_status", "uniq_owner_affiliate_product_status"];
  for (const name of DROP) {
    if (before.some((i) => i.name === name)) {
      console.log(`  drop ${name}`);
      if (COMMIT) await coll.dropIndex(name);
    } else console.log(`  (${name} already absent)`);
  }

  if (!before.some((i) => i.name === NEW)) {
    console.log(`  create ${NEW} {owner, productId, variantKey}`);
    if (COMMIT) await coll.createIndex(
      { owner: 1, productId: 1, variantKey: 1 },
      { unique: true, name: NEW, partialFilterExpression: { productId: { $exists: true, $type: "objectId" } } }
    );
  } else console.log(`  (${NEW} already present)`);

  if (COMMIT) console.log("indexes after:", (await coll.indexes()).map((i) => i.name).join(", "));
  console.log(COMMIT ? "APPLIED" : "DRY (pass --commit)");
  await mongoose.disconnect();
})();
