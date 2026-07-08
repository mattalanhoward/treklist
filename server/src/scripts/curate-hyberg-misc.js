/**
 * curate-hyberg-misc.js — the three one-off Hyberg edits, made reproducible:
 *  (1) RINCO/ZEFYR (18 L) retyped Backpack -> Daypack (Backpack schema needs >=20 L)
 *      + Daypack attributes + derived category.
 *  (2) Archive dated duplicate versions: Warm Booties (2024), AGUILA LITE (2025),
 *      ATTILA ULTRA (2024 version).
 *  (3) Bandit Lite: set the curated 8-photo set (Aluula first, then Dyneema).
 *
 *   node src/scripts/curate-hyberg-misc.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const DAYPACK_ATTRS = { volumeLiters: 18, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant" };
const ARCHIVE = ["Warm Booties (2024)", "AGUILA LITE (2025)", "ATTILA ULTRA Ultralight backpack (2024 version)"];
const B = "https://cdn.shopify.com/s/files/1/0573/5609/1556/files/";
const BANDIT_IMGS = [
  "backpack_bandit_aluula_white_fdf609b7-25d8-47ee-af03-13d50b35f3fb.webp", "backpack_bandit_aluula_white3.webp",
  "backpack_bandit_aluula_black_d4b13418-b29b-40fb-bd7e-a852c3891f24.webp", "backpack_bandit_aluula_black6.webp",
  "backpack_bandit_dyneema_white_0035bf91-1fbc-4689-be9b-bb39712cc2eb.webp", "backpack_bandit_dyneema_white5.webp",
  "backpack_bandit_dyneema_black_bb6ec1d8-aeb9-4a99-b814-bb10efce40b9.webp", "backpack_bandit_dyneema_gray_61c48bbe-a58b-49b5-9977-0809a313951a.webp",
].map((f) => B + f);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  for (const name of ["RINCO", "ZEFYR"]) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.itemType = "Daypack";
    const { category, subcategory } = categoryForItemType("Daypack", name);
    if (category) doc.category = category;
    if (subcategory) doc.subcategory = subcategory;
    doc.attributes = { ...DAYPACK_ATTRS };
    doc.$locals.lenientAttributes = true;
    console.log(`${name} -> Daypack (${category})`);
    if (COMMIT) await doc.save();
  }

  const r = await C.updateMany({ name: { $in: ARCHIVE }, itemGroupId: /^hyberg-/, isActive: true }, COMMIT ? { $set: { isActive: false } } : {});
  console.log(`archive dated versions: matched ${r.matchedCount}`);

  const bandit = await C.findOne({ name: "Bandit Lite" });
  if (bandit) {
    console.log(`Bandit Lite images: ${bandit.imageUrls?.length || 0} -> ${BANDIT_IMGS.length}`);
    if (COMMIT) { bandit.imageUrls = BANDIT_IMGS; bandit.$locals.lenientAttributes = true; await bandit.save(); }
  } else console.log("!! Bandit Lite not found");

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
