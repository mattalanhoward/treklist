/**
 * drop-katabatic-shells.js — remove the "Shells" fill option (bare shell, no down /
 * DIY-fill — not relevant for gear planning) from every Katabatic quilt/bag: strip it
 * from the Fill axis values and drop all variants whose Fill = "Shells".
 * All current defaults are 850fp/900fp (not Shells), so no default change needed.
 *
 *   node src/scripts/drop-katabatic-shells.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const isShell = (v) => /shell/i.test(v || "");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: /katabatic/i, isActive: true, "variantAxes.name": "Fill" }).select("name variantAxes variants defaultVariantKey").lean();
  let updated = 0;
  for (const d of items) {
    const fillAxis = d.variantAxes.find((a) => a.name === "Fill");
    if (!fillAxis || !fillAxis.values.some(isShell)) continue;
    const newAxes = d.variantAxes.map((a) => (a.name === "Fill" ? { ...a, values: a.values.filter((v) => !isShell(v)) } : a));
    const newVariants = d.variants.filter((v) => !isShell(v.options && v.options.Fill));
    const defGone = isShell(d.variants.find((v) => v.key === d.defaultVariantKey)?.options?.Fill);
    console.log(`${d.name.padEnd(20)} ${d.variants.length} → ${newVariants.length} var${defGone ? "  ⚠ default was Shells!" : ""}`);
    if (COMMIT) {
      await C.updateOne({ _id: d._id }, { $set: { variantAxes: newAxes, variants: newVariants } });
      updated++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? updated : items.length} items updated`);
  await mongoose.disconnect();
})();
