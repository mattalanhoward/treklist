/**
 * curate-weights-hyberg2.js
 *
 * Weights for the Hyberg NO-WEIGHT items whose spec tables were truncated by the
 * 2000-char description cap. Read from the brand's own Shopify body_html
 * (https://hyberg.de/products/<handle>.json) by hand — full untruncated tables.
 * Weight convention: quilts = headline bare-quilt "Weight" per size; packs =
 * "Complete/Total" (as-shipped) weight per size/material.
 *
 * AER PACK is intentionally left blank: empty description + grams=0, no published
 * weight on the brand site.
 *
 *   node src/scripts/curate-weights-hyberg2.js            # dry-run
 *   node src/scripts/curate-weights-hyberg2.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const COMMIT = process.argv.includes("--commit");

// name -> [axisName, { value: grams, ... }, defaultValue]
const SINGLE_AXIS = {
  // down quilts (Size)
  "LONER Lite 250 Down Quilt":  ["Size", { M: 425, L: 445, XL: 475 }, "M"],
  "LONER Lite 350  Down Quilt": ["Size", { M: 530, L: 545, XL: 575 }, "M"],
  "LONER Lite 450  Down Quilt": ["Size", { M: 630, L: 645, XL: 675 }, "M"],
  "LONER Lite 550 Down Quilt":  ["Size", { M: 730, L: 745, XL: 775 }, "M"],
  "SLUMBER 300 Down quilt":     ["Size", { M: 425, L: 465, XL: 490 }, "M"],
  "SLUMBER 400 Down quilt":     ["Size", { M: 535, L: 565, XL: 590 }, "M"],
  "SLUMBER 500 Down quilt":     ["Size", { M: 635, L: 665, XL: 690 }, "M"],
  // synthetic quilts (Size)
  "LONER APEX I Synthetic Quilt":   ["Size", { M: 420, L: 440, XL: 460 }, "M"],
  "LONER APEX II Synthetic Quilt":  ["Size", { M: 540, L: 560, XL: 580 }, "M"],
  "LONER APEX III Synthetic Quilt": ["Size", { M: 640, L: 660, XL: 680 }, "M"],
  "LONER APEX IV Synthetic Quilt":  ["Size", { M: 680, L: 720, XL: 810 }, "M"],
  "SLUMBER APEX II Synthetic Quilt":  ["Size", { L: 560, XL: 620 }, "L"],
  "SLUMBER APEX III Synthetic Quilt": ["Size", { L: 660, XL: 680 }, "L"],
  "SLUMBER APEX IV Synthetic Quilt":  ["Size", { L: 720, XL: 760 }, "L"],
  // stuff sack (Size)
  "ZIP Bag": ["Size", { S: 38, M: 43, L: 48 }, "M"],
  // packs, single Size axis (Complete/Total)
  "ARCON": ["Size", { M: 905, L: 920 }, "M"],
  "ATTILA": ["Size", { S: 682, M: 710, L: 740 }, "M"],
  "ATTILA ULTRA Ultralight backpack (2024 version)": ["Size", { S: 595, M: 605, L: 615 }, "M"],
};

// name -> { axes:[{name,values}], grid: {"<v1> / <v2>": grams}, default }  (Complete/Total)
const MULTI_AXIS = {
  "EGOIST LITE": {
    axes: [{ name: "Material", values: ["ALUULA", "Dyneema"] }, { name: "Size", values: ["M", "L"] }],
    grid: { "ALUULA / M": 455, "ALUULA / L": 465, "Dyneema / M": 470, "Dyneema / L": 480 },
    default: "ALUULA / M",
  },
  "ATTILA LITE": {
    axes: [{ name: "Material", values: ["ALUULA", "Dyneema", "ULTRA"] }, { name: "Size", values: ["S", "M", "L"] }],
    grid: {
      "ALUULA / S": 575, "ALUULA / M": 590, "ALUULA / L": 605,
      "Dyneema / S": 620, "Dyneema / M": 630, "Dyneema / L": 645,
      "ULTRA / S": 650, "ULTRA / M": 670, "ULTRA / L": 700,
    },
    default: "ALUULA / M",
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;

  for (const [name, [axisName, map, def]] of Object.entries(SINGLE_AXIS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    const vals = Object.keys(map);
    const variants = vals.map((v) => ({ key: v, options: { [axisName]: v }, weightGrams: map[v] }));
    console.log(`${name}  [${axisName}] ${vals.map((v) => `${v}:${map[v]}`).join(" ")}  def=${def}`);
    if (COMMIT) {
      doc.variantAxes = [{ name: axisName, values: vals }];
      doc.variants = variants;
      doc.defaultVariantKey = def;
      doc.weightGrams = map[def];
      doc.$locals.lenientAttributes = true;
      await doc.save();
    }
    n++;
  }

  for (const [name, cfg] of Object.entries(MULTI_AXIS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    const variants = Object.entries(cfg.grid).map(([key, g]) => {
      const parts = key.split(" / ");
      const options = {};
      cfg.axes.forEach((ax, i) => { options[ax.name] = parts[i]; });
      return { key, options, weightGrams: g };
    });
    console.log(`${name}  [${cfg.axes.map((a) => a.name).join("×")}] ${variants.length} variants  def=${cfg.default}`);
    if (COMMIT) {
      doc.variantAxes = cfg.axes;
      doc.variants = variants;
      doc.defaultVariantKey = cfg.default;
      doc.weightGrams = cfg.grid[cfg.default];
      doc.$locals.lenientAttributes = true;
      await doc.save();
    }
    n++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} items (AER PACK left blank — no published weight)`);
  await mongoose.disconnect();
})();
