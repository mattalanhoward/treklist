/**
 * consolidate-zpacks-tents.js
 *
 * Groups Zpacks tent/tarp variations into single variant items (color dropped per
 * the variant model). Reuses one member as the parent (keeps its offer/base attrs),
 * archives the rest (ref-safe). Per-variant attributes swap on selection.
 *   - Plex Solo / Altaplex : Version[Classic,Pro] x Floor[Lite,Standard]
 *   - Duplex               : Version[Lite,Classic,Pro] (single axis; uneven configs)
 *   - Flat Tarp            : Size[7'x9', 8.5'x10'] (per-variant dims/guyouts)
 *
 *   node src/scripts/consolidate-zpacks-tents.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const FLY = { Classic: "0.75 oz DCF", Pro: "0.55 oz DCF", Lite: "0.55 oz DCF" };
const FLOOR = { Lite: "0.75 oz DCF", Standard: "1.0 oz DCF" };

const CLUSTERS = [
  {
    base: "Plex Solo", parent: "Plex Solo Classic Tent", archive: ["Plex Solo Pro Tent"],
    axes: [{ name: "Version", values: ["Classic", "Pro"] }, { name: "Floor", values: ["Lite", "Standard"] }],
    def: "Classic / Standard",
    variants: {
      "Classic / Lite": 348, "Classic / Standard": 413, "Pro / Lite": 373, "Pro / Standard": 439,
    },
    attrOf: (k) => { const [v, f] = k.split(" / "); return { flyMaterial: FLY[v], floorMaterial: FLOOR[f] }; },
  },
  {
    base: "Altaplex", parent: "Altaplex Classic Tent", archive: ["Altaplex Pro Tent"],
    axes: [{ name: "Version", values: ["Classic", "Pro"] }, { name: "Floor", values: ["Lite", "Standard"] }],
    def: "Classic / Standard",
    variants: { "Classic / Lite": 380, "Classic / Standard": 456, "Pro / Lite": 412, "Pro / Standard": 485 },
    attrOf: (k) => { const [v, f] = k.split(" / "); return { flyMaterial: FLY[v], floorMaterial: FLOOR[f] }; },
  },
  {
    base: "Duplex", parent: "Duplex Classic Tent", archive: ["Duplex Pro Tent", "Duplex Lite Tent"],
    axes: [{ name: "Version", values: ["Lite", "Classic", "Pro"] }],
    def: "Classic",
    variants: { Lite: 431, Classic: 504, Pro: 627 },
    attrOf: (k) => ({ flyMaterial: FLY[k] || "Dyneema Composite Fabric (DCF)" }),
  },
  {
    base: "Flat Tarp", parent: "7' x 9' Flat Tarp", archive: ["8.5' x 10' Flat Tarp"],
    axes: [{ name: "Size", values: ["7' x 9'", "8.5' x 10'"] }],
    def: "7' x 9'",
    variants: { "7' x 9'": 132, "8.5' x 10'": 182 },
    attrOf: (k) => k.startsWith("8.5")
      ? { lengthCm: 305, widthCm: 259, coverageAreaSqM: 7.9, guyoutPoints: 12 }
      : { lengthCm: 274, widthCm: 213, coverageAreaSqM: 5.8, guyoutPoints: 8 },
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  for (const cl of CLUSTERS) {
    const p = await C.findOne({ name: cl.parent, isActive: true, itemGroupId: /^zpacks-/ });
    if (!p) { console.log(`!! parent not found: ${cl.parent}`); continue; }
    const axisNames = cl.axes.map((a) => a.name);
    const variants = Object.entries(cl.variants).map(([key, w]) => {
      const parts = key.split(" / ");
      const options = {}; axisNames.forEach((nm, i) => { options[nm] = parts[i]; });
      return { key, options, weightGrams: w, attributes: cl.attrOf(key) };
    });
    console.log(`${cl.base.padEnd(11)} <- parent "${cl.parent}"  ${variants.length} variants, def ${cl.def}=${cl.variants[cl.def]}g  (archive ${cl.archive.length})`);
    if (COMMIT) {
      p.name = cl.base;
      p.variantAxes = cl.axes;
      p.variants = variants;
      p.defaultVariantKey = cl.def;
      p.weightGrams = cl.variants[cl.def];
      p.$locals.lenientAttributes = true;
      await p.save();
      for (const name of cl.archive) {
        const r = await C.updateOne({ name, isActive: true, itemGroupId: /^zpacks-/ }, { $set: { isActive: false } });
        if (!r.matchedCount) console.log(`   ? archive member not found: ${name}`);
      }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
