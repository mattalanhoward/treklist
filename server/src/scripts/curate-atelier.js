/**
 * curate-atelier.js — finish Atelier Longue Distance (French artisan, WooCommerce).
 * Consolidate Classique + Hybride into config-variant items (Personnalisé / All
 * Around); dedupe Sac Banane vs BANANA HIP PACK; archive the belt-pocket accessory;
 * clear the bogus Sakabouf/Sakasek weights (feed value is fabric weight); basic
 * attributes; brief honest descriptions (feed descriptions are empty placeholders).
 *
 *   node src/scripts/curate-atelier.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const GRP = /^atelierlonguedistance-/;
const get = (C, name) => C.findOne({ name, isActive: true, itemGroupId: GRP });

const CONSOLIDATE = [
  { base: "Classique", parent: "Classique personnalisé", archive: "Classique All Around Personnalisé" },
  { base: "Hybride", parent: "Hybride personnalisé", archive: "Hybride All Around Personnalisé" },
];
const ARCHIVE = ["BANANA HIP PACK", "Poches Ceinture Amovibles"]; // EN dup + belt-pocket accessory
const CLEAR_WEIGHT = ["Sakabouf", "Sakasek"];

const ATTRS = {
  "Classique": { gender: "Unisex", frameType: "Frameless", waterResistance: "Water Resistant" },
  "Hybride": { gender: "Unisex", frameType: "Frameless", waterResistance: "Water Resistant" },
  "Daybride 15": { volumeLiters: 15, gender: "Unisex", frameType: "Frameless", waterResistance: "Water Resistant" },
  "Sakabouf": { gender: "Unisex", frameType: "Frameless", waterResistance: "Water Resistant" },
  "Sakasek": { gender: "Unisex", frameType: "Frameless", waterResistance: "Water Resistant" },
  "Sac Banane": { waterResistant: true },
  "CNOC": { capacity: 2, material: "Plastic (BPA-Free)" },
  "PODS": { material: "Ultra / EPX", closureType: "Roll-Top" },
};
const DESC = {
  "Classique": "The Classique — a handmade, fully-customizable ultralight backpack from Atelier Longue Distance (France).",
  "Hybride": "The Hybride — a handmade, fully-customizable ultralight backpack from Atelier Longue Distance (France).",
  "Daybride 15": "The Daybride 15 — a handmade 15 L ultralight daypack from Atelier Longue Distance.",
  "Sakabouf": "The Sakabouf — a handmade ultralight frameless pack from Atelier Longue Distance.",
  "Sakasek": "The Sakasek — a handmade ultralight frameless pack from Atelier Longue Distance.",
  "Sac Banane": "A handmade ultralight hip pack (sac banane) from Atelier Longue Distance.",
  "CNOC": "CNOC collapsible water container, configured by Atelier Longue Distance.",
  "PODS": "Handmade ultralight stuff-sack pods, sized to fit Atelier packs.",
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  for (const c of CONSOLIDATE) {
    const p = await get(C, c.parent);
    if (!p) { console.log(`!! parent ${c.parent}`); continue; }
    p.name = c.base;
    p.variantAxes = [{ name: "Configuration", values: ["Personnalisé", "All Around"] }];
    p.variants = [
      { key: "Personnalisé", options: { Configuration: "Personnalisé" }, weightGrams: 600 },
      { key: "All Around", options: { Configuration: "All Around" }, weightGrams: 1000 },
    ];
    p.defaultVariantKey = "Personnalisé";
    p.weightGrams = 600;
    p.$locals.lenientAttributes = true;
    if (COMMIT) {
      await p.save();
      await C.updateOne({ name: c.archive, isActive: true, itemGroupId: GRP }, { $set: { isActive: false } });
    }
    console.log(`${c.base} <- ${c.parent} (config Personnalisé 600 / All Around 1000), archive ${c.archive}`);
  }

  for (const name of ARCHIVE) {
    const r = await C.updateOne({ name, isActive: true, itemGroupId: GRP }, COMMIT ? { $set: { isActive: false } } : {});
    console.log(`archive ${name}: ${r.matchedCount ? "ok" : "!! not found"}`);
  }

  for (const name of CLEAR_WEIGHT) {
    const d = await get(C, name);
    if (d) { d.weightGrams = undefined; d.$locals.lenientAttributes = true; if (COMMIT) await d.save(); console.log(`clear weight: ${name}`); }
  }

  for (const [name, attrs] of Object.entries(ATTRS)) {
    const d = await get(C, name);
    if (!d) { console.log(`!! attrs ${name}`); continue; }
    d.attributes = { ...attrs };
    if (DESC[name]) d.description = DESC[name];
    d.$locals.lenientAttributes = true;
    try { if (COMMIT) await d.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); }
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
