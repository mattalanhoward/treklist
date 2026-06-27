// server/src/scripts/recategorize-other-drybags.js
// =============================================================================
// Recategorize itemType "Other" items that are clearly dry bags / stuff sacks
// (e.g. SIMOND "... Waterproof Bag") into "Dry Bag / Stuff Sack", populating
// `volumeLiters` parsed from the name. Only matches names with BOTH a bag/sack
// keyword AND a parseable litre value, so it can't grab non-bags.
//
// DRY-RUN by default. --db <name> targets a DB; --commit to a non-local DB needs
// --confirm <dbName>.
//   node src/scripts/recategorize-other-drybags.js
//   node src/scripts/recategorize-other-drybags.js --db TrekList --commit --confirm TrekList
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const { validateAttributes } = require("../config/attributeSchemas");

const COMMIT = process.argv.includes("--commit");
function argVal(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const DB = argVal("--db") || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && argVal("--confirm") !== DB) {
  console.error(
    `\nRefusing to --commit to non-local DB "${DB}".\n` +
      `Re-run with:  --db ${DB} --commit --confirm ${DB}\n`,
  );
  process.exit(1);
}

const NEW_TYPE = "Dry Bag / Stuff Sack";
const BAG_RE = /dry\s*bag|waterproof bag|stuff\s*sack|dry\s*sack/i;
const litres = (name) => {
  const m = String(name).match(/(\d+(?:\.\d+)?)\s*(?:l|litre|liter)\b/i);
  return m ? parseFloat(m[1]) : undefined;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");
  console.log("=".repeat(64));
  console.log(
    `OTHER → Dry Bag recategorize  (${COMMIT ? "COMMIT — WILL WRITE" : "DRY RUN"})  DB: ${mongoose.connection.name}`,
  );
  console.log("=".repeat(64));

  const others = await C.find({ itemType: "Other" }).lean();
  let done = 0,
    skipped = 0;
  for (const o of others) {
    if (!BAG_RE.test(o.name)) continue;
    const vol = litres(o.name);
    const existing =
      o.attributes instanceof Map
        ? Object.fromEntries(o.attributes)
        : o.attributes || {};
    const next = { ...existing, volumeLiters: vol };
    const { valid, errors, cleaned } = validateAttributes(NEW_TYPE, next);
    if (!vol || !valid) {
      skipped++;
      console.log(`  ✗ ${o.name} — ${!vol ? "no parseable litres" : errors.join("; ")}`);
      continue;
    }
    done++;
    console.log(`  ✓ ${o.brand} | ${o.name}  → ${NEW_TYPE}  ${JSON.stringify(cleaned)}`);
    if (COMMIT) {
      await C.updateOne(
        { _id: o._id },
        { $set: { itemType: NEW_TYPE, attributes: cleaned } },
      );
    }
  }
  console.log(`\n${COMMIT ? "recategorized" : "would recategorize"}: ${done} | skipped: ${skipped}`);
  if (!COMMIT) console.log("(DRY RUN — nothing written.)");
  await mongoose.disconnect();
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
