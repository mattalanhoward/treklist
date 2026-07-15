/**
 * fix-size-ordering.js — apparel Size variant axes were imported in Shopify's arbitrary
 * order (e.g. L, M, S, XL, XS). Reorder every item's Size axis (values + variants) into a
 * sensible order: clothing XXS→5XL, length Short→Extra Long, or numeric ascending. Leaves
 * axes it can't rank untouched. updateOne only (never .save() a projected doc).
 *
 *   node src/scripts/fix-size-ordering.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const CLOTHING = ["xxxs", "xxs", "xs", "xsmall", "s", "small", "sm", "m", "medium", "md", "l", "large", "lg", "xl", "xlarge", "1x", "1xl", "xxl", "2x", "2xl", "xxxl", "3x", "3xl", "4xl", "5xl"];
const CRANK = {}; CLOTHING.forEach((v, i) => (CRANK[v] = i));
Object.assign(CRANK, { xxs: 1, xs: 2, s: 4, small: 4, sm: 4, m: 7, medium: 7, md: 7, l: 10, large: 10, lg: 10, xl: 13, xlarge: 13, "1x": 14, "1xl": 14, xxl: 16, "2x": 16, "2xl": 16, xxxl: 19, "3x": 19, "3xl": 19, "4xl": 22, "5xl": 24 });
const LENGTH = { short: 0, reg: 1, regular: 1, standard: 1, long: 2, "extra long": 3, xlong: 3, "x-long": 3 };
function rank(v) {
  const s = String(v).toLowerCase().replace(/[\s.]/g, "").replace(/size/g, "").trim();
  if (s in CRANK) return { g: 0, r: CRANK[s] };
  const l = String(v).toLowerCase().trim();
  if (l in LENGTH) return { g: 0, r: LENGTH[l] };
  const num = parseFloat(String(v).replace(/[^\d.]/g, ""));
  if (!isNaN(num) && /^\s*\d/.test(String(v))) return { g: 1, r: num };
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ isActive: true, "variantAxes.0": { $exists: true } }).select("name brand variantAxes variants defaultVariantKey").lean();

  let changed = 0, skipped = 0;
  for (const it of items) {
    const axes = it.variantAxes || [];
    const sizeAx = axes.find((a) => /size|length/i.test(a.name));
    if (!sizeAx || (sizeAx.values || []).length < 2) { skipped++; continue; }
    const ranked = sizeAx.values.map((v, i) => ({ v, i, k: rank(v) }));
    const rankable = ranked.filter((x) => x.k).length;
    if (rankable < Math.ceil(sizeAx.values.length / 2)) { skipped++; continue; } // mostly unrankable -> leave
    const sorted = [...ranked].sort((a, b) => {
      if (!a.k && !b.k) return a.i - b.i;
      if (!a.k) return 1; if (!b.k) return -1;
      return a.k.g - b.k.g || a.k.r - b.k.r || a.i - b.i;
    });
    const newValues = sorted.map((x) => x.v);
    if (newValues.join("|") === sizeAx.values.join("|")) { skipped++; continue; } // already sorted

    const newAxes = axes.map((a) => (a === sizeAx || a.name === sizeAx.name ? { ...a, values: newValues } : a));
    // reorder variants to follow the sorted size values (stable within other axes)
    const order = Object.fromEntries(newValues.map((v, i) => [v, i]));
    const newVariants = [...(it.variants || [])].sort((a, b) => {
      const av = (a.options && (a.options[sizeAx.name] ?? a.options.Size)) ?? a.key;
      const bv = (b.options && (b.options[sizeAx.name] ?? b.options.Size)) ?? b.key;
      return (order[av] ?? 99) - (order[bv] ?? 99);
    });
    if (changed < 12) console.log(`${it.brand} | ${it.name.slice(0, 34)}: [${sizeAx.values.join(",")}] -> [${newValues.join(",")}]`);
    changed++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { variantAxes: newAxes, variants: newVariants } });
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: reordered ${changed}, unchanged ${skipped}`);
  await mongoose.disconnect();
})();
