/**
 * consolidate-katabatic-flex.js — merge the 5 separate Katabatic "Flex N°F Quilt"
 * items into ONE "Flex Quilt" with Temperature × Size × Fill variants (per-variant
 * weight + tempRating + fillPower). Matches the Zpacks precedent (Solo Quilt /
 * Classic Sleeping Bag = one Temperature × Size parent).
 *
 * Parent = Flex 15°F item (keeps its _id/offer/images); other 4 archived. One buy-link
 * for all temps (per-variant offers not yet supported — the 5 temp URLs are logged for
 * a future ledger). Elite models (Alsek/Chisos/etc.) are distinct models — left alone.
 *
 *   node src/scripts/consolidate-katabatic-flex.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const TEMPS = ["5°F", "15°F", "22°F", "30°F", "40°F"]; // axis order (cold → warm)
const PARENT_TEMP = "15°F"; // keep this item as the consolidated parent
const DEFAULT_KEY = "15°F / 6' / 900fp ExpeDRY Goose Down";
const fToC = (f) => Math.round(((f - 32) * 5) / 9);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  // load the 5 Flex items keyed by their temp label
  const docs = await C.find({ brand: /katabatic/i, isActive: true, name: /^Flex \d/i }).lean();
  const byTemp = {};
  for (const d of docs) {
    const m = d.name.match(/Flex\s+(\d+)°F/i);
    if (m) byTemp[`${m[1]}°F`] = d;
  }
  const missing = TEMPS.filter((t) => !byTemp[t]);
  if (missing.length) { console.error("missing Flex temps:", missing); process.exit(1); }

  // collect axis values from the parent's variants (all temps share the same Size/Fill sets)
  const parent = byTemp[PARENT_TEMP];
  const sizes = parent.variantAxes.find((a) => a.name === "Size").values;
  const fills = parent.variantAxes.find((a) => a.name === "Fill").values;
  const fillPower = (fill) => { const m = String(fill).match(/(\d{3})\s*fp/i); return m ? Number(m[1]) : undefined; };

  const variants = [];
  for (const temp of TEMPS) {
    const src = byTemp[temp];
    const wByKey = new Map(src.variants.map((v) => [v.key, v])); // key = "size / fill"
    const tempF = Number(temp.replace(/\D/g, ""));
    for (const size of sizes) {
      for (const fill of fills) {
        const sv = wByKey.get(`${size} / ${fill}`);
        const attributes = { tempRatingF: tempF, tempRatingC: fToC(tempF) };
        const fp = fillPower(fill);
        if (fp) attributes.fillPower = fp;
        variants.push({
          key: `${temp} / ${size} / ${fill}`,
          options: { Temperature: temp, Size: size, Fill: fill },
          weightGrams: sv ? sv.weightGrams : undefined,
          sku: sv ? sv.sku : undefined,
          attributes,
        });
      }
    }
  }

  const axes = [
    { name: "Temperature", values: TEMPS },
    { name: "Size", values: sizes },
    { name: "Fill", values: fills },
  ];
  const def = variants.find((v) => v.key === DEFAULT_KEY) || variants[0];
  const defTempF = Number(PARENT_TEMP.replace(/\D/g, ""));

  console.log(`Flex Quilt: ${axes.map((a) => `${a.name}[${a.values.length}]`).join(" × ")} = ${variants.length} variants`);
  console.log(`  default: ${def.key} (${def.weightGrams}g)`);
  console.log(`  weights range: ${Math.min(...variants.map((v) => v.weightGrams || 9999))}–${Math.max(...variants.map((v) => v.weightGrams || 0))}g`);
  console.log(`  archive: ${TEMPS.filter((t) => t !== PARENT_TEMP).map((t) => byTemp[t].name).join(", ")}`);
  console.log(`  temp URLs for ledger:`);
  for (const t of TEMPS) console.log(`    ${t}: ${byTemp[t].name}`);

  if (COMMIT) {
    await C.updateOne({ _id: parent._id }, {
      $set: {
        name: "Flex Quilt",
        variantAxes: axes,
        variants,
        defaultVariantKey: def.key,
        weightGrams: def.weightGrams,
        attributes: { insulationType: "Down", waterResistantDown: true, tempRatingF: defTempF, tempRatingC: fToC(defTempF), fillPower: 900 },
      },
    });
    for (const t of TEMPS) if (t !== PARENT_TEMP) await C.updateOne({ _id: byTemp[t]._id }, { $set: { isActive: false } });
    console.log("\nAPPLIED: consolidated 5 → 1 (Flex Quilt), archived 4");
  } else {
    console.log("\nDRY-RUN");
  }
  await mongoose.disconnect();
})();
