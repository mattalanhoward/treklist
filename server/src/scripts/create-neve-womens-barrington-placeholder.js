/**
 * create-neve-womens-barrington-placeholder.js — placeholder for the Neve Gear
 * women's Barrington down jacket, which is announced ("coming late July 2026") but
 * NOT yet published on nevegear.com.au (no product page → no price/weight/images).
 * The user asked to seed a visible placeholder now; swap in real data when it lists
 * (re-check nevegear.com.au/collections/down-jackets — see brand-backlog memory).
 *
 * Deliberately minimal + honest: no fabricated weight, no misleading men's photo
 * (imageless until the real one exists), offer deep-links to the Down Jackets
 * collection since there's no product page yet. Mirrors the men's Barrington shape
 * (itemType Insulated Jacket, gender attr, Neve direct offer).
 *
 *   node src/scripts/create-neve-womens-barrington-placeholder.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ADMIN_ID = "69565d7c3480c2216f915a36";
const NAME = "Barrington Down Hoody Women's";
const DEEPLINK = "https://nevegear.com.au/collections/down-jackets";

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const existing = await C.findOne({ name: NAME, brand: /neve/i });
  if (existing) { console.log("already exists — skip:", existing._id); await mongoose.disconnect(); return; }

  console.log(`${COMMIT ? "CREATE" : "DRY-RUN"}: ${NAME} (placeholder, imageless, coming-soon)`);
  if (COMMIT) {
    const doc = new C({
      name: NAME,
      brand: "Neve Gear",
      itemType: "Insulated Jacket",
      category: "Women's Clothing",
      subcategory: "Jackets",
      description:
        "Coming late July 2026. The women's version of Neve Gear's Barrington down hoody is announced but not yet released; " +
        "this is a placeholder — specs, weight, images, and the direct product link will be added once it goes on sale. " +
        "(Placeholder created 2026-08-06.)",
      imageUrls: [],
      createdBy: ADMIN_ID,
      isActive: true,
      attributes: { gender: "Womens" },
    });
    doc.$locals.lenientAttributes = true;
    await doc.save();
    await O.create({ network: "direct", region: "global", merchantId: "direct-nevegear", merchantName: "Neve Gear", productId: doc._id, deepLink: DEEPLINK, priority: 0 });
    console.log("created:", doc._id);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
