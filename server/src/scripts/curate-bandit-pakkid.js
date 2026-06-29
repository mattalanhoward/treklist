/**
 * curate-bandit-pakkid.js
 *
 * - Bandit Lite: drop the "(Aluula)" suffix; add a Material axis (Aluula / Dyneema)
 *   with per-variant weight AND per-variant attributes (mainFabric differs). Uses
 *   the new variant.attributes field so the gear-details / preview modals swap the
 *   fabric spec when the material is selected. Values from hyberg.de BANDIT LITE.
 * - PAKKID: add the TX50Ultra material option (Material × Size). Dyneema M30/L33,
 *   TX50Ultra M38/L41.
 *
 *   node src/scripts/curate-bandit-pakkid.js            # dry-run
 *   node src/scripts/curate-bandit-pakkid.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  // ---- Bandit Lite ----
  const bandit = await C.findOne({ name: "Bandit Lite (Aluula)", brand: "Hyberg" });
  if (!bandit) console.log("!! Bandit Lite (Aluula) not found");
  else {
    bandit.name = "Bandit Lite";
    bandit.variantAxes = [{ name: "Material", values: ["Aluula", "Dyneema"] }];
    bandit.variants = [
      { key: "Aluula", options: { Material: "Aluula" }, weightGrams: 410, attributes: { mainFabric: "ALUULA Graflyte V-98®" } },
      { key: "Dyneema", options: { Material: "Dyneema" }, weightGrams: 420, attributes: { mainFabric: "Dyneema® Composite Fabric" } },
    ];
    bandit.defaultVariantKey = "Aluula";
    bandit.weightGrams = 410;
    bandit.attributes = { ...(bandit.attributes || {}), mainFabric: "ALUULA Graflyte V-98®" };
    bandit.$locals.lenientAttributes = true;
    console.log(`Bandit Lite: Material[Aluula:410g/Dyneema:420g], per-variant mainFabric`);
    if (COMMIT) await bandit.save();
  }

  // ---- PAKKID ----
  const pakkid = await C.findOne({ name: "PAKKID", itemGroupId: /^hyberg-/ });
  if (!pakkid) console.log("!! PAKKID not found");
  else {
    pakkid.variantAxes = [
      { name: "Material", values: ["Dyneema", "TX50Ultra"] },
      { name: "Size", values: ["M", "L"] },
    ];
    pakkid.variants = [
      { key: "Dyneema / M", options: { Material: "Dyneema", Size: "M" }, weightGrams: 30 },
      { key: "Dyneema / L", options: { Material: "Dyneema", Size: "L" }, weightGrams: 33 },
      { key: "TX50Ultra / M", options: { Material: "TX50Ultra", Size: "M" }, weightGrams: 38 },
      { key: "TX50Ultra / L", options: { Material: "TX50Ultra", Size: "L" }, weightGrams: 41 },
    ];
    pakkid.defaultVariantKey = "Dyneema / M";
    pakkid.weightGrams = 30;
    pakkid.$locals.lenientAttributes = true;
    console.log(`PAKKID: Material×Size = 4 variants (Dyneema 30/33, TX50Ultra 38/41)`);
    if (COMMIT) await pakkid.save();
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
