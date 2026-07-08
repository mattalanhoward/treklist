/**
 * create-kula.js — add one Kula Cloth (reusable antimicrobial pee cloth) as a
 * Toiletry, with a brand-direct buy-link (network "direct"). One-off.
 *
 *   node src/scripts/create-kula.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";

const ITEM = {
  name: "Kula Cloth",
  brand: "Kula Cloth",
  itemType: "Toiletry",
  category: "Health & Hygiene",
  subcategory: "Personal Care",
  weightGrams: 14, // 0.5 oz
  description:
    "A reusable antimicrobial pee cloth: one soft, absorbent side to pat dry and a waterproof backing to keep your hand protected. Snaps onto your pack to air-dry, with a reflective edge for finding it at night — a lower-waste alternative to packing out toilet paper.",
  imageUrls: [
    "https://kulacloth.com/cdn/shop/files/magical_moth_website_1_new.jpg?v=1780506266",
  ],
  attributes: {
    Size: "~6 x 6 in",
    "Fabric content": "29% bamboo / 71% polyester",
    Antimicrobial: "Silver ion technology",
    Reusable: "Yes — thousands of uses",
    Features: "Waterproof backing, reflective edge, snap attachment",
    "Made in": "USA",
  },
};

const OFFER = {
  network: "direct",
  region: "global",
  merchantId: "direct-kula",
  merchantName: "Kula Cloth",
  deepLink: "https://kulacloth.com/collections/kulacollection",
  priority: 0,
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const existing = await C.findOne({ name: ITEM.name, brand: /kula/i }).lean();
  if (existing) {
    console.log(`"${ITEM.name}" already exists (_id ${existing._id}) — skip`);
    return mongoose.disconnect();
  }
  console.log(`${ITEM.name}  ${ITEM.itemType} / ${ITEM.category} / ${ITEM.subcategory}  ${ITEM.weightGrams}g  imgs:${ITEM.imageUrls.length}`);
  console.log(`  attrs: ${JSON.stringify(ITEM.attributes)}`);
  console.log(`  offer: ${OFFER.network}/${OFFER.merchantName} → ${OFFER.deepLink}`);
  if (COMMIT) {
    const doc = new C({ ...ITEM, createdBy: ADMIN_ID, isActive: true });
    doc.$locals.lenientAttributes = true;
    await doc.save();
    // ⚠ Toiletry has empty schema fields → the pre-save hook wipes freeform attributes.
    // Set them via updateOne WITHOUT itemType in the $set (update middleware only
    // validates/strips when both attributes + itemType are present) → passes through.
    await C.updateOne({ _id: doc._id }, { $set: { attributes: ITEM.attributes } });
    await O.create({ ...OFFER, productId: doc._id });
    console.log(`  ✓ created (_id ${doc._id}) + direct offer + freeform attrs`);
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
