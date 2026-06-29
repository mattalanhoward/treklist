/**
 * consolidate-atom-packs.js
 *
 * Folds Atom's per-config pack items into 5 variant parents (Atom, Prospector,
 * Pulse, Notch, Nanu). Variant axis "Version" = config codes + Custom. Each variant
 * keeps its published (medium-torso) weight — users override for their torso/build —
 * and carries per-variant attributes (volume + fabric) that swap on selection.
 * Parent offer -> the model's custom builder page; merged members + offers deleted.
 * Also un-archives "The Hipbelt Pocket" (a kept accessory).
 *
 *   node src/scripts/consolidate-atom-packs.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const FAB = { RE: "Challenge ECOPAK (recycled)", EP: "Challenge ECOPAK EPX", UL: "Challenge UltraWeave", X: "X-Pac VX", Custom: "Custom build" };

const MODELS = [
  {
    base: "The Atom", parent: "The Atom", itemType: "Backpack", offer: "https://atompacks.co.uk/products/the-atom-custom",
    baseAttrs: { gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant", loadCapacityKg: 9 },
    def: "RE40", fabric: true,
    configs: { RE30: { w: 408, vol: 30, fab: "RE" }, RE40: { w: 438, vol: 40, fab: "RE" }, UL35: { w: 392, vol: 35, fab: "UL" }, Custom: { w: 438, vol: 40, fab: "Custom" } },
    members: ["The Atom RE30", "The Atom RE40", "The Atom UL35"],
  },
  {
    base: "The Prospector", parent: "The Prospector EP50", itemType: "Backpack", offer: "https://atompacks.co.uk/products/the-prospector-custom",
    baseAttrs: { gender: "Unisex", frameType: "Internal Frame", hipBeltType: "Padded", waterResistance: "Water Resistant" },
    def: "EP50", fabric: true,
    configs: { EP50: { w: 910, vol: 50, fab: "EP" }, EP60: { w: 965, vol: 60, fab: "EP" }, Custom: { w: 910, vol: 50, fab: "Custom" } },
    members: ["The Prospector EP60"],
  },
  {
    base: "The Pulse", parent: "The Pulse EP40", itemType: "Backpack", offer: "https://atompacks.co.uk/products/the-pulse-custom",
    baseAttrs: { gender: "Unisex", frameType: "Internal Frame", hipBeltType: "Padded", waterResistance: "Water Resistant" },
    def: "EP40", fabric: true,
    configs: { EP40: { w: 650, vol: 40, fab: "EP" }, EP50: { w: 675, vol: 50, fab: "EP" }, Custom: { w: 650, vol: 40, fab: "Custom" } },
    members: ["The Pulse EP50"],
  },
  {
    base: "The Notch", parent: "The Notch EP40", itemType: "Backpack", offer: "https://atompacks.co.uk/products/the-notch-custom",
    baseAttrs: { gender: "Unisex", frameType: "Internal Frame", hipBeltType: "Padded", waterResistance: "Water Resistant" },
    def: "EP40", fabric: true,
    configs: { EP40: { w: 840, vol: 40, fab: "EP" }, EP50: { w: 874, vol: 50, fab: "EP" }, Custom: { w: 840, vol: 40, fab: "Custom" } },
    members: ["The Notch EP50"],
  },
  {
    base: "The Nanu", parent: "The Nanu RE25", itemType: "Daypack", offer: "https://atompacks.co.uk/products/the-nanu-re25",
    baseAttrs: { gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant" },
    def: "RE25", fabric: false, // Daypack schema has no mainFabric
    configs: { RE25: { w: 510, vol: 25, fab: "RE" }, X25: { w: 570, vol: 25, fab: "X" }, Custom: { w: 510, vol: 25, fab: "Custom" } },
    members: ["The Nanu X25"],
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem"), O = require("../models/merchantOffer");
  const GI = require("../models/globalItem"), GE = require("../models/gearItem");

  for (const m of MODELS) {
    const p = await C.findOne({ name: m.parent, isActive: true, brand: /atom/i });
    if (!p) { console.log(`!! parent not found: ${m.parent}`); continue; }
    const codes = Object.keys(m.configs);
    const variants = codes.map((code) => {
      const c = m.configs[code];
      const attrs = { volumeLiters: c.vol };
      if (m.fabric) attrs.mainFabric = FAB[c.fab];
      return { key: code, options: { Version: code }, weightGrams: c.w, attributes: attrs };
    });
    const dc = m.configs[m.def];
    console.log(`${m.base.padEnd(15)} Version[${codes.join(",")}] def=${m.def}=${dc.w}g  (delete ${m.members.length})`);
    if (COMMIT) {
      p.name = m.base;
      p.itemType = m.itemType;
      p.variantAxes = [{ name: "Version", values: codes }];
      p.variants = variants;
      p.defaultVariantKey = m.def;
      p.weightGrams = dc.w;
      p.attributes = { ...m.baseAttrs, volumeLiters: dc.vol, ...(m.fabric ? { mainFabric: FAB[dc.fab] } : {}) };
      p.$locals.lenientAttributes = true;
      await p.save();
      await O.updateMany({ productId: p._id }, { $set: { deepLink: m.offer } });
      for (const name of m.members) {
        const mem = await C.findOne({ name, brand: /atom/i });
        if (!mem) { console.log(`   ? member not found: ${name}`); continue; }
        const refs = (await GI.countDocuments({ productId: mem._id })) + (await GE.countDocuments({ productId: mem._id }));
        if (refs) { console.log(`   ⚠ keep "${name}" (${refs} refs)`); continue; }
        await O.deleteMany({ productId: mem._id });
        await C.deleteOne({ _id: mem._id });
      }
    }
  }

  // keep accessory: un-archive The Hipbelt Pocket
  const r = await C.updateOne({ name: "The Hipbelt Pocket", brand: /atom/i }, COMMIT ? { $set: { isActive: true } } : {});
  console.log(`\nThe Hipbelt Pocket un-archive: matched ${r.matchedCount}`);

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
