/**
 * qa-osprey-fix.js — Osprey QA fixes (CATALOG_QA_HANDOFF §6, catalog-qa 2026-07-04).
 *
 * Osprey products.json is 403-blocked; the 15 ARCHIVED Osprey items are the
 * pre-consolidation originals and carry each volume's OWN images/ASIN/attrs.
 * This script:
 *  A. adopts archived-twin images + own-ASIN deepLink (+ fill-only attrs) onto the
 *     active split sibling that currently shares the smallest volume's image/ASIN;
 *  B. splits "Talon" (volume-as-Size-axis violation) → Talon 22 + un-archive 26/33/44;
 *  C. splits "Kyte LT" → Kyte LT 28 + un-archive Kyte LT 35;
 *  D. un-archives Tempest 44 (missing volume in the 22/26/33/44 line);
 *  E. renames Kestrel 38L→Kestrel 38, Sportlite 25L→Sportlite 25.
 *
 * Dry-run by default; --commit to write. Refuses non-treklist_local.
 * Uses collection.updateOne only (never .save() on projected docs).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// active-name → archived-name twins for image/ASIN adoption (A)
const ADOPT = [
  ["Atmos AG 65", "Atmos AG 65 - Men's", "https://www.amazon.com/dp/B09JXQDZG5?tag=treklistapp-20"],
  ["Atmos AG LT 65", "Atmos AG LT 65 - Men's", "https://www.amazon.com/dp/B0BKQK7HMD?tag=treklistapp-20"],
  ["Sirrus 34", "Sirrus 34 - Women's", "https://www.amazon.com/dp/B09JXJYQQT?tag=treklistapp-20"],
  ["Sirrus 36", "Sirrus 36 - Women's", "https://www.amazon.com/dp/B09JY1KJJ2?tag=treklistapp-20"],
  ["Stratos 36", "Stratos 36 - Men's", "https://www.amazon.com/dp/B09JXJVNMH?tag=treklistapp-20"],
  ["Tempest 26", "Tempest 26 - Women's", "https://www.amazon.com/dp/B0DSCNN9WY?tag=treklistapp-20"],
  ["Tempest 33", "Tempest 33 - Women's", "https://www.amazon.com/dp/B0DSCM8ZTS?tag=treklistapp-20"],
  ["Hikelite 28", "Hikelite 28", "https://www.amazon.com/dp/B0BKQJ2BXS?tag=treklistapp-20"],
  ["Hikelite 32", "Hikelite 32", "https://www.amazon.com/dp/B0BKQKM8JK?tag=treklistapp-20"],
  ["Talon Velocity 30", "Talon Velocity 30 Men's", "https://www.amazon.com/dp/B0CGQ32FWQ?tag=treklistapp-20"],
];
// attrs worth carrying over from the archived twin when the active item lacks them
const FILL_ATTRS = ["mainFabric", "torsoFitRange", "backPanelType", "loadCapacityKg"];

// archived items to reactivate (D/B/C): archived-name → new active name
const REVIVE = [
  ["Talon 26 - Men's", "Talon 26"],
  ["Talon 33 - Men's", "Talon 33"],
  ["Talon 44 - Men's", "Talon 44"],
  ["Kyte LT 35 - Women's", "Kyte LT 35"],
  ["Tempest 44 Women's", "Tempest 44"],
];

const RENAME = [
  ["Talon", "Talon 22"],
  ["Kyte LT", "Kyte LT 28"],
  ["Kestrel 38L", "Kestrel 38"],
  ["Sportlite 25L", "Sportlite 25"],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const log = (...a) => console.log(COMMIT ? "[COMMIT]" : "[dry]", ...a);
  const byName = async (name, active) =>
    CatalogItem.findOne({ brandLC: "osprey", name, isActive: active ? { $ne: false } : false }).lean();

  // A. adopt archived twin images/ASIN/attrs
  for (const [activeName, archName, deepLink] of ADOPT) {
    const act = await byName(activeName, true);
    const arch = await byName(archName, false);
    if (!act || !arch) { console.error("MISSING", activeName, "act:", !!act, "arch:", !!arch); continue; }
    const attrFill = {};
    for (const k of FILL_ATTRS)
      if (arch.attributes?.[k] != null && act.attributes?.[k] == null) attrFill[`attributes.${k}`] = arch.attributes[k];
    log(`ADOPT ${activeName}: img0 ${((act.imageUrls||[])[0]||"").slice(-24)} -> ${((arch.imageUrls||[])[0]||"").slice(-24)}, +attrs ${Object.keys(attrFill).join(",")||"none"}, offer -> ${deepLink.slice(23, 44)}`);
    if (COMMIT) {
      await CatalogItem.collection.updateOne({ _id: act._id }, { $set: { imageUrls: arch.imageUrls, ...attrFill } });
      const r = await MerchantOffer.updateMany({ productId: act._id, network: "amazon" }, { $set: { deepLink } });
      log(`  offer updated: ${r.modifiedCount}`);
    }
  }

  // B/C prep. capture Talon 44 fit weights from the bare Talon's variant matrix
  const bareTalon = await byName("Talon", true);
  const t44sm = bareTalon?.variants?.find((v) => (v.options?.Size || v.options?.get?.("Size")) === "44L (S/M)");
  const t44lxl = bareTalon?.variants?.find((v) => (v.options?.Size || v.options?.get?.("Size")) === "44L (L/XL)");

  // D/B/C. revive archived items as active split products
  for (const [archName, newName] of REVIVE) {
    const arch = await byName(archName, false);
    if (!arch) { console.error("MISSING archived", archName); continue; }
    const set = { isActive: true, name: newName };
    if (newName === "Talon 44" && t44sm && t44lxl) {
      set.variantAxes = [{ name: "Torso Size", values: ["S/M", "L/XL"] }];
      set.variants = [
        { key: "S/M", options: { "Torso Size": "S/M" }, weightGrams: t44sm.weightGrams },
        { key: "L/XL", options: { "Torso Size": "L/XL" }, weightGrams: t44lxl.weightGrams },
      ];
      set.defaultVariantKey = "S/M";
    }
    log(`REVIVE "${archName}" -> "${newName}" (w ${arch.weightGrams}g, vol ${arch.attributes?.volumeLiters})${set.variants ? " + S/M-L/XL fit variants" : ""}`);
    if (newName === "Tempest 26") log("  note: not adopting attrs");
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: arch._id }, { $set: set });
  }
  // archived "Tempest 26" twin had volumeLiters 23 (wrong) — fix it even though archived
  const t26arch = await byName("Tempest 26 - Women's", false);
  if (t26arch && t26arch.attributes?.volumeLiters === 23) {
    log("FIX archived Tempest 26 twin volumeLiters 23 -> 26");
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: t26arch._id }, { $set: { "attributes.volumeLiters": 26 } });
  }

  // B/C/E. renames on active items (bare Talon/Kyte become the smallest volume)
  for (const [oldName, newName] of RENAME) {
    const act = await byName(oldName, true);
    if (!act) { console.error("MISSING active", oldName); continue; }
    const set = { name: newName };
    if (oldName === "Talon") { set.variantAxes = []; set.variants = []; set.defaultVariantKey = null; }
    if (oldName === "Kyte LT") { set.variantAxes = []; set.variants = []; set.defaultVariantKey = null; }
    log(`RENAME "${oldName}" -> "${newName}"${set.variants ? " (drop volume-as-Size axis)" : ""}`);
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: act._id }, { $set: set });
  }

  await mongoose.disconnect();
})();
