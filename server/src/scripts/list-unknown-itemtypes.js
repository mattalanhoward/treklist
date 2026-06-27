// server/src/scripts/list-unknown-itemtypes.js
// =============================================================================
// READ-ONLY: List every CatalogItem whose itemType is NOT in the schema enum.
// Grouped by itemType value, showing _id / brand / name / hasAttrs / isActive.
// Used to decide the itemType -> schema normalization map case-by-case.
//   cd server && node src/scripts/list-unknown-itemtypes.js
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const { isValidItemType } = require("../config/attributeSchemas");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
  });
  const C = require("../models/catalogItem");
  const items = await C.find({}).lean();

  const groups = new Map();
  for (const it of items) {
    if (it.itemType == null) continue;
    if (isValidItemType(it.itemType)) continue;
    if (!groups.has(it.itemType)) groups.set(it.itemType, []);
    groups.get(it.itemType).push(it);
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  let totalDocs = 0;
  for (const [type, docs] of sorted) {
    totalDocs += docs.length;
    console.log(`\n=== ${JSON.stringify(type)}  (${docs.length}) ===`);
    for (const d of docs) {
      const a =
        d.attributes instanceof Map
          ? Object.fromEntries(d.attributes)
          : d.attributes || {};
      const nAttrs = Object.keys(a).length;
      console.log(
        `  ${d._id}  ${(d.brand || "—").padEnd(18)}  ${d.name}` +
          `   [attrs:${nAttrs}${d.isActive === false ? " INACTIVE" : ""}]`,
      );
    }
  }
  console.log(
    `\n${sorted.length} out-of-schema itemType values, ${totalDocs} docs total.`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
