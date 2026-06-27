// server/src/scripts/fix-travel-towel-size.js
// =============================================================================
// One-off value fix: Travel Towel items whose `size` is off-enum
// (e.g. "Small (20x40in)") fail validation. Derive the correct enum size from
// the product NAME suffix ("- S/M/L/XS/XL"), which matches the real dimensions
// (the stored word was mis-entered: Drylite "- M"/"- L" were saved Small/Medium).
//
// DRY-RUN by default. --db <name> targets a DB; --commit to a non-local DB needs
// --confirm <dbName>.
//   node src/scripts/fix-travel-towel-size.js
//   node src/scripts/fix-travel-towel-size.js --db TrekList --commit --confirm TrekList
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

const SUFFIX_TO_SIZE = { XS: "XS", S: "Small", M: "Medium", L: "Large", XL: "XL" };

function sizeFromName(name) {
  const m = String(name).match(/-\s*(XS|XL|S|M|L)\s*$/i);
  return m ? SUFFIX_TO_SIZE[m[1].toUpperCase()] : undefined;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");
  console.log("=".repeat(64));
  console.log(
    `TRAVEL TOWEL size fix  (${COMMIT ? "COMMIT — WILL WRITE" : "DRY RUN"})  DB: ${mongoose.connection.name}`,
  );
  console.log("=".repeat(64));

  const docs = await C.find({ itemType: "Travel Towel" }).lean();
  let fixed = 0,
    skipped = 0;
  for (const d of docs) {
    const a =
      d.attributes instanceof Map
        ? Object.fromEntries(d.attributes)
        : d.attributes || {};
    if (validateAttributes("Travel Towel", a).valid) continue; // already good
    const size = sizeFromName(d.name);
    const next = { ...a, size };
    const { valid, errors, cleaned } = validateAttributes("Travel Towel", next);
    if (!size || !valid) {
      skipped++;
      console.log(
        `  ✗ ${d.name} — could not derive valid size (${size || "no suffix"})${errors.length ? " — " + errors.join("; ") : ""}`,
      );
      continue;
    }
    fixed++;
    console.log(`  ✓ ${d.name}: size ${JSON.stringify(a.size)} → ${JSON.stringify(size)}`);
    if (COMMIT) {
      await C.updateOne({ _id: d._id }, { $set: { attributes: cleaned } });
    }
  }
  console.log(`\n${COMMIT ? "fixed" : "would fix"}: ${fixed} | skipped: ${skipped}`);
  if (!COMMIT) console.log("(DRY RUN — nothing written.)");
  await mongoose.disconnect();
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
