/**
 * curate-hyberg-attrs-quilts.js
 *
 * Fills Quilt attributes from hyberg.de specs (hand-read, verified). NIMBUS I–IV
 * are single-temp items. The 4 consolidated parents (LONER Lite / SLUMBER /
 * LONER APEX / SLUMBER APEX) carry PER-FILL variant attributes — tempRatingC (and
 * fillWeightG for down, Climashield level for synthetic) swap with the Fill axis.
 *
 *   node src/scripts/curate-hyberg-attrs-quilts.js            # dry-run
 *   node src/scripts/curate-hyberg-attrs-quilts.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// NIMBUS: single-temp down quilts (800FP duck down, RDS)
const NIMBUS = {
  "NIMBUS I Down Quilt":   4,
  "NIMBUS II Down Quilt":  1,
  "NIMBUS III Down Quilt": -2,
  "NIMBUS IV Down Quilt":  -5,
};

// consolidated parents: base attrs + per-Fill overrides
const CONSOLIDATED = {
  "LONER Lite Down Quilt": {
    base: { insulationType: "Down", tempRatingC: 1, fillPower: 850, rdsDown: true, waterResistantDown: true, footboxType: "Zippered", attachmentSystem: "Pad Straps" },
    perFill: { "250": { tempRatingC: 4, fillWeightG: 230 }, "350": { tempRatingC: 1, fillWeightG: 330 }, "450": { tempRatingC: -2, fillWeightG: 430 }, "550": { tempRatingC: -5, fillWeightG: 530 } },
  },
  "SLUMBER Down Quilt": {
    base: { insulationType: "Down", tempRatingC: -1, fillPower: 850, rdsDown: true, waterResistantDown: true, footboxType: "Sewn Closed", attachmentSystem: "Pad Straps" },
    perFill: { "300": { tempRatingC: 2, fillWeightG: 280 }, "400": { tempRatingC: -1, fillWeightG: 380 }, "500": { tempRatingC: -4, fillWeightG: 470 } },
  },
  "LONER APEX Synthetic Quilt": {
    base: { insulationType: "Synthetic", tempRatingC: 5, syntheticInsulationType: "Climashield APEX", footboxType: "Sewn Closed", attachmentSystem: "Pad Straps" },
    perFill: { "I": { tempRatingC: 8, syntheticInsulationType: "Climashield APEX 100" }, "II": { tempRatingC: 5, syntheticInsulationType: "Climashield APEX 133" }, "III": { tempRatingC: 2, syntheticInsulationType: "Climashield APEX 167" }, "IV": { tempRatingC: -1, syntheticInsulationType: "Climashield APEX 200" } },
  },
  "SLUMBER APEX Synthetic Quilt": {
    base: { insulationType: "Synthetic", tempRatingC: 2, syntheticInsulationType: "Climashield APEX", footboxType: "Sewn Closed", attachmentSystem: "Pad Straps" },
    perFill: { "II": { tempRatingC: 5, syntheticInsulationType: "Climashield APEX 133" }, "III": { tempRatingC: 2, syntheticInsulationType: "Climashield APEX 167" }, "IV": { tempRatingC: -1, syntheticInsulationType: "Climashield APEX 200" } },
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;

  for (const [name, tempC] of Object.entries(NIMBUS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { insulationType: "Down", tempRatingC: tempC, fillPower: 800, rdsDown: true, attachmentSystem: "Pad Straps" };
    doc.$locals.lenientAttributes = true;
    console.log(`${name.padEnd(26)} ${JSON.stringify(doc.attributes)}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("  !! " + e.message); } } else n++;
  }

  for (const [name, cfg] of Object.entries(CONSOLIDATED)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { ...cfg.base };
    for (const v of doc.variants) {
      const fill = v.options?.get?.("Fill") ?? v.options?.Fill;
      if (fill && cfg.perFill[fill]) v.attributes = { ...(v.attributes || {}), ...cfg.perFill[fill] };
    }
    doc.markModified("variants");
    doc.$locals.lenientAttributes = true;
    console.log(`${name.padEnd(26)} base=${JSON.stringify(cfg.base)}  +per-Fill tempRatingC`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("  !! " + e.message); } } else n++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/8`);
  await mongoose.disconnect();
})();
