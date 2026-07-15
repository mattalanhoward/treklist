/**
 * add-chairs-fix-osprey.js — three small hand-curated changes (2026-07-11):
 *  1. Osprey Exos Pro 55: per-Torso-Size weights + volumes (S/M 55L 940g, L/XL 58L 980g)
 *     — the two variants had shared placeholder weight 979g.
 *  2. Add Nemo Moonlite Elite Reclining Backpacking Chair (544g / 1.2 lb; Nemo feed grams=0).
 *  3. Add Helinox Chair Zero (490g / 1.1 lb, 120 kg) — new brand in the catalog.
 *  Weights/specs hand-verified from the brand pages. updateOne / create only.
 *
 *   node src/scripts/add-chairs-fix-osprey.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "6a213efbc50ff0a814869c8d";

const CHAIRS = [
  {
    name: "Moonlite™ Elite Reclining Backpacking Chair", brand: "Nemo", weightGrams: 544,
    attributes: { type: "Chair", maxLoadKg: 136 },
    description: "Ultralight reclining backpacking chair with an adjustable recline and a low, stable seat. Weighs just 1.2 lb (544 g). Aluminium frame with a breathable, recycled fabric seat.",
    imageUrls: ["https://cdn.shopify.com/s/files/1/0582/1136/9133/files/pxvsazsibhqiew8adwvd.jpg", "https://cdn.shopify.com/s/files/1/0582/1136/9133/files/uqh9xx4ybpfrmtoe9wnl.jpg"],
    merchantId: "direct-nemo", merchantName: "Nemo", deepLink: "https://www.nemoequipment.com/products/moonlite-elite-reclining-camp-chair",
  },
  {
    name: "Chair Zero", brand: "Helinox", weightGrams: 490,
    attributes: { type: "Chair", maxLoadKg: 120 },
    description: "Iconic ultralight camp chair weighing just 1.1 lb (490 g) yet supporting up to 120 kg (265 lb). DAC TH72M aluminium alloy frame with a recycled polyester seat; packs down to roughly 35 x 10 x 10 cm.",
    imageUrls: ["https://helinox.com/cdn/shop/files/chairzero_lt_sizedhero_cyan_1024x1024.png"],
    merchantId: "direct-helinox", merchantName: "Helinox", deepLink: "https://helinox.com/products/chair-zero",
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  // 1. Osprey Exos Pro 55 per-size weights + volume note
  const exos = await C.findOne({ brand: /osprey/i, name: /exos pro 55/i, isActive: true }).lean();
  if (exos) {
    const W = { "S/M": 940, "L/XL": 980 }, VOL = { "S/M": 55, "L/XL": 58 };
    const variants = (exos.variants || []).map((v) => ({ ...v, weightGrams: W[v.key] ?? v.weightGrams }));
    const base = W[exos.defaultVariantKey] ?? variants[0].weightGrams;
    let desc = (exos.description || "").replace(/\n\nTorso sizes:.*$/s, "").trim();
    desc += "\n\nTorso sizes: S/M = 55 L (0.94 kg), L/XL = 58 L (0.98 kg).";
    console.log(`Osprey Exos Pro 55: base ${exos.weightGrams}->${base}g; variants ${variants.map((v) => v.key + ":" + v.weightGrams).join(", ")}`);
    if (COMMIT) await C.collection.updateOne({ _id: exos._id }, { $set: { weightGrams: base, variants, description: desc } });
  } else console.log("!! Exos Pro 55 not found");

  // 2+3. add chairs
  for (const c of CHAIRS) {
    const exists = await C.findOne({ name: c.name, brand: c.brand, isActive: true }).select("_id").lean();
    if (exists) { console.log(`~~ ${c.brand} ${c.name}: exists — skip`); continue; }
    const { category, subcategory } = categoryForItemType("Camp Chair", "");
    console.log(`+ ${c.brand} ${c.name} — ${c.weightGrams}g [${category}/${subcategory}] imgs:${c.imageUrls.length}`);
    if (COMMIT) {
      const doc = new C({
        name: c.name, brand: c.brand, itemType: "Camp Chair",
        category, subcategory, description: c.description, imageUrls: c.imageUrls,
        createdBy: ADMIN_ID, isActive: true, weightGrams: c.weightGrams, attributes: c.attributes,
      });
      doc.$locals.lenientAttributes = true;
      await doc.save();
      await O.create({ network: "direct", region: "global", merchantId: c.merchantId, merchantName: c.merchantName, productId: doc._id, deepLink: c.deepLink, priority: 0 });
    }
  }

  console.log(COMMIT ? "\nAPPLIED" : "\nDRY-RUN");
  await mongoose.disconnect();
})();
