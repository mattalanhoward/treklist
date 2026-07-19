/**
 * curate-nalgene.js — Nalgene (nalgene.com), WooCommerce open Store API.
 *
 * nalgene.com is WordPress/WooCommerce with an OPEN Store API
 * (/wp-json/wc/store/v1/products, 100 products). But the store lists mostly the
 * SAME few bottle models across dozens of GRAPHIC PRINTS (Surrealist, Glo Wyld,
 * Pride, Camo, Tie-Dye, …) — graphics/colors are NEVER a product distinction per
 * the locked variant standard, so they all collapse to the core models.
 *
 * SCOPE (user decision 2026-07-17): ONLY the 4 core Tritan bottle models below —
 * no graphics, kids, caps, sleeves, stickers, straw/OTF, or other sizes.
 *
 * WEIGHTS: the Woo `weight` field is unreliable (the plain 32oz Narrow Mouth
 * listing reads a bogus 0.03 lbs). Weights below are the AUTHORITATIVE published
 * spec read from each PDP's specifications ("6.25 oz (177.25 g)" etc.).
 * CAPACITY is exact from the size. Material = Tritan Renew (BPA/BPS-free plastic).
 *
 * OFFERS: direct, unmonetized nalgene.com product-page links
 * (merchantId "direct-nalgene").
 *
 *   node src/scripts/curate-nalgene.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";

const DESC = (mouth) =>
  `The classic BPA/BPS-free Nalgene ${mouth} bottle, made from Tritan Renew (50% recycled). Virtually indestructible, leakproof, and dishwasher-safe — the standard backcountry water bottle. Offered in many graphics/colors (one representative shown).`;

const KEEPERS = [
  {
    name: "32oz Wide Mouth Bottle",
    handle: "32oz-wide-mouth-bottle",
    weightGrams: 177,
    mouth: "Wide Mouth",
    capacityMl: 946, capacityOz: 32,
    image: "https://nalgene.com/wp-content/uploads/2024/01/32oz-WM-Periwinkle-Front-1.jpg",
  },
  {
    name: "32oz Narrow Mouth Bottle",
    handle: "32oz-narrow-mouth-bottle",
    weightGrams: 177,
    mouth: "Narrow Mouth",
    capacityMl: 946, capacityOz: 32,
    image: "https://nalgene.com/wp-content/uploads/2020/12/32oz-NM-Marmalade_Front.png",
  },
  {
    name: "16oz Wide Mouth Bottle",
    handle: "16oz-wide-mouth-bottle",
    weightGrams: 89, // 3.125 oz
    mouth: "Wide Mouth",
    capacityMl: 473, capacityOz: 16,
    image: "https://nalgene.com/wp-content/uploads/2020/12/16oz-WM-Pastel-Green_Front.jpg",
  },
  {
    name: "16oz Narrow Mouth Bottle",
    handle: "16oz-narrow-mouth-bottle",
    weightGrams: 106, // 3.75 oz
    mouth: "Narrow Mouth",
    capacityMl: 473, capacityOz: 16,
    image: "https://nalgene.com/wp-content/uploads/2024/02/16oz-NM-Cornflower-Front.jpg",
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  for (const m of KEEPERS) {
    const existing = await C.findOne({ name: m.name, brand: /nalgene/i }).lean();
    if (existing) { console.log(`${m.name}: exists — skip`); continue; }
    const { category, subcategory } = categoryForItemType("Water Bottle", m.name) || {};
    const deepLink = `https://nalgene.com/product/${m.handle}/`;
    const attributes = {
      capacityMl: m.capacityMl,
      capacityOz: m.capacityOz,
      material: "Plastic (BPA-Free)",
      mouthOpening: m.mouth,
      insulated: false,
      leakProof: true,
    };
    console.log(`${m.name.padEnd(26)} Water Bottle  ${String(m.weightGrams).padStart(4)}g  ${m.capacityMl}ml ${m.mouth}`);

    if (COMMIT) {
      const doc = new C({
        name: m.name,
        brand: "Nalgene",
        itemType: "Water Bottle",
        ...(category ? { category, subcategory } : {}),
        description: DESC(m.mouth),
        imageUrls: [m.image],
        createdBy: ADMIN_ID,
        isActive: true,
        weightGrams: m.weightGrams,
        attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); }
      catch (e) { console.log(`   !! ${m.name}: ${e.message}`); continue; }
      await O.create({
        network: "direct", region: "global",
        merchantId: "direct-nalgene", merchantName: "Nalgene",
        productId: doc._id, deepLink, priority: 0,
      });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created (of ${KEEPERS.length} keepers)`);
  await mongoose.disconnect();
})();
