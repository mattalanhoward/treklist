// server/src/scripts/backfill-itemtype.js
// =============================================================================
// Backfill itemType on EXISTING catalog items that are uncategorized
// (itemType null or "Other") using the name-based classifier. Only upgrades to
// a confident, more-specific schema type; leaves the item alone when the
// classifier returns null. Writes itemType ONLY (never attributes), so it can't
// trip required-attribute validation.
//
// DRY-RUN by default. --db <name>; --commit to a non-local DB needs --confirm.
//   node src/scripts/backfill-itemtype.js
//   node src/scripts/backfill-itemtype.js --db TrekList --commit --confirm TrekList
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const { inferItemType } = require("../config/inferItemType");

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

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");
  console.log("=".repeat(64));
  console.log(
    `itemType BACKFILL (null/"Other")  (${COMMIT ? "COMMIT — WILL WRITE" : "DRY RUN"})  DB: ${mongoose.connection.name}`,
  );
  console.log("=".repeat(64));

  const items = await C.find({
    $or: [{ itemType: null }, { itemType: "Other" }],
  }).lean();

  const changes = [];
  for (const it of items) {
    const guess = inferItemType(it.name);
    if (guess && guess !== it.itemType) {
      changes.push({ _id: it._id, from: it.itemType, to: guess, name: it.name, brand: it.brand });
    }
  }

  // group by from->to
  const groups = new Map();
  for (const c of changes) {
    const k = `${c.from === null ? "(null)" : c.from} → ${c.to}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  for (const [k, list] of [...groups.entries()].sort()) {
    console.log(`\n  ${k}   [${list.length}]`);
    for (const c of list) console.log(`      ${c.brand || "—"} | ${c.name}`);
  }

  if (COMMIT) {
    for (const c of changes) {
      await C.updateOne({ _id: c._id }, { $set: { itemType: c.to } });
    }
  }

  console.log(
    `\nscanned ${items.length} uncategorized | ${COMMIT ? "updated" : "would update"}: ${changes.length} | left as-is: ${items.length - changes.length}`,
  );
  if (!COMMIT) console.log("(DRY RUN — nothing written.)");
  await mongoose.disconnect();
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
