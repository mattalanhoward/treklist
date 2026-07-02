/**
 * sambob-variants.js — Sam Bob tops all ship in the same size matrix:
 *   Size class (Narrow "Women's" / Wide "Men's")  ×  Size (XS…3XL) = 14 cells.
 * Sam Bob only publishes ONE example weight per product (a different cell each),
 * which the user fills in by hand — so we lay down the full 14-cell matrix with
 * BLANK variant weights on every fleece top + the 5-panel, and normalize the
 * Basin Sun Hoodie (whose cells held duplicated 227g placeholders) to blank too.
 * Base weightGrams is left untouched (acts as the default).
 *
 *   node src/scripts/sambob-variants.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const CLASS_AXIS = 'Size class (read the size chart)';
const SIZE_AXIS = 'Size';
const CLASSES = ['Narrow ("Women\'s")', 'Wide ("Men\'s")'];
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

const AXES = [
  { name: CLASS_AXIS, values: CLASSES },
  { name: SIZE_AXIS, values: SIZES },
];
const VARIANTS = [];
for (const cls of CLASSES)
  for (const size of SIZES)
    VARIANTS.push({ key: `${cls} / ${size}`, options: { [CLASS_AXIS]: cls, [SIZE_AXIS]: size } }); // weightGrams left undefined
const DEFAULT_KEY = `Wide ("Men's") / M`;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  // all fleece tops + the 5-panel hat + Basin sun hoodie; exclude pants & fanny pack.
  const items = await C.find({
    brand: /sam bob/i, isActive: true,
    $or: [{ itemType: "Fleece Jacket" }, { name: /five panel/i }, { name: /basin sun hoodie/i }],
  }).select("name itemType weightGrams variants").lean();

  console.log(`applying 14-cell matrix to ${items.length} Sam Bob tops:\n`);
  let n = 0;
  for (const i of items) {
    const had = (i.variants || []).length;
    console.log(`  ${i.name.padEnd(34)} [${i.itemType}] base:${i.weightGrams ?? "-"}g  was ${had} variants → 14 (blank)`);
    if (!COMMIT) continue;
    await C.updateOne({ _id: i._id }, { $set: { variantAxes: AXES, variants: VARIANTS, defaultVariantKey: DEFAULT_KEY } });
    n++;
  }
  console.log(`\n${COMMIT ? "APPLIED to " + n : "DRY-RUN " + items.length} items`);
  await mongoose.disconnect();
})();
