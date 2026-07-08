/**
 * import-farpointe.js — FarPointe Outdoor Gear (farpointeog.com, Squarespace). Direct
 * (user: prefer direct over GGG). Alpha Direct / TecnoWool active-insulation APPAREL.
 *
 * ⚠ WEIGHTS: FarPointe publishes weight for SIZE MEDIUM only, and it varies by fabric
 * GSM (60/90/120gsm). Per user: weightGrams = representative MEDIUM (90gsm where present),
 * and the FULL "Weight (based on Medium)" breakdown is written into the DESCRIPTION.
 * Two items don't publish weights (Camp Socks, Yakona) → left blank + noted.
 * Descriptions + images scraped from each product page. Direct FarPointe offers.
 *
 *   node src/scripts/import-farpointe.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execSync } = require("child_process");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const ALPHA = { fleeceType: "Alpha Direct", gender: "Unisex" };

// weightGrams = representative Medium (90gsm std where multiple); wNote = full medium breakdown.
const ITEMS = [
  { h: "farpointe-alpha-cruiser", name: "Alpha Cruiser", itemType: "Fleece Jacket", g: 125, attributes: ALPHA,
    wNote: "60gsm 3.8oz · 90gsm 4.4oz · Full-Zip 90gsm 5.1oz · 60/90 Combo 4oz · 120/90 Combo 5.3oz", tags: ["Alpha Direct", "Active Insulation"] },
  { h: "alpha-cruiser-crewneck", name: "Alpha Crewneck", itemType: "Fleece Jacket", g: 99, attributes: ALPHA,
    wNote: "60gsm 2.9oz · 90gsm 3.5oz · 120gsm 6.4oz", tags: ["Alpha Direct", "Active Insulation"] },
  { h: "farpointe-alpha-thermal-bottoms", name: "Alpha Direct Camp Pants", itemType: "Base Layer Bottom", g: 119, attributes: { gender: "Unisex" },
    wNote: "60gsm 3.2oz · 90gsm 4.2oz · 120gsm 4.9oz", tags: ["Alpha Direct", "Active Insulation"] },
  { h: "printed-alpha-cruiser", name: "Printed Alpha Cruiser", itemType: "Fleece Jacket", g: 130, attributes: ALPHA,
    wNote: "90gsm 4.6oz", tags: ["Alpha Direct", "Printed"] },
  { h: "tecnowool-cruiser-releasing-572026-3pm-pst", name: "TecnoWool Cruiser", itemType: "Fleece Jacket", g: 162, attributes: { gender: "Unisex" },
    wNote: "60gsm 4.4oz · 90gsm 5.7oz · 120gsm 6.1oz", tags: ["TecnoWool", "Wool Blend", "Active Insulation"] },
  { h: "powerwool-sun-cruiser-available-418", name: "Sun Cruiser", itemType: "Hiking Shirt", g: 164, attributes: { gender: "Unisex" },
    wNote: "Merino Blend 150gsm 7.5oz · PowerWool 100gsm 5.8oz · PowerWool 150gsm 8oz", tags: ["Sun Hoody", "Merino/PowerWool"] },
  { h: "tecnowool-crewneck", name: "TecnoWool Crewneck", itemType: "Fleece Jacket", g: 111, attributes: { gender: "Unisex" },
    wNote: "60gsm 3.9oz · 120gsm 5.1oz", tags: ["TecnoWool", "Wool Blend"] },
  { h: "full-zip-super-cruiser-pre-order", name: "Super Cruiser", itemType: "Fleece Jacket", g: 213, attributes: ALPHA,
    wNote: "W/Zipper 120gsm 7.5oz · Pullover 120gsm 7.2oz · W/Zipper 190gsm 9.4oz", tags: ["Alpha Direct", "Heavyweight"] },
  { h: "alpha-camp-socks", name: "Alpha Direct Camp Socks", itemType: "Hiking Socks", g: null, attributes: { gender: "Unisex" },
    wNote: null, tags: ["Alpha Direct", "Camp Socks"] },
  { h: "alpha-caps", name: "Alpha Drifter Cap", itemType: "Hat/Headwear", g: 16, attributes: {},
    wNote: "60gsm 13g · 90gsm 16g · 120gsm 23g · Alpha/Wool 150gsm 25g", tags: ["Alpha Direct", "Cap"] },
  { h: "wool-gaiter", name: "Wool Gaiter", itemType: "Hat/Headwear", g: 34, attributes: {}, cat: "Unisex Clothing", sub: "Neck Gaiter",
    wNote: "1.2oz (~34g)", tags: ["Wool", "Neck Gaiter"] },
  { h: "alpha-duo", name: "FarPointe Duo", itemType: "Fleece Jacket", g: 207, attributes: ALPHA,
    wNote: "2-Layer 60gsm 7.3oz", tags: ["Alpha Direct", "2-Layer"] },
  { h: "yakona-hoodie-available-314", name: "Yakona Cruiser", itemType: "Fleece Jacket", g: null, attributes: ALPHA,
    wNote: null, tags: ["Alpha Direct"] },
];

function scrape(handle) {
  for (let i = 0; i < 4; i++) {
    try {
      const html = execSync(`curl -s -A "${UA}" "https://www.farpointeog.com/stock/p/${handle}"`, { maxBuffer: 30 * 1024 * 1024 }).toString();
      if (!html || html.length < 500) continue;
      // description from JSON-LD
      let desc = (html.match(/"description":"((?:[^"\\]|\\.){20,600})"/) || [])[1] || "";
      desc = desc.replace(/\\u2122/g, "™").replace(/\\u[0-9a-f]{4}/gi, " ").replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\/g, "").replace(/\s+/g, " ").trim();
      // images: unique squarespace-cdn product images
      const imgs = [...new Set((html.match(/https:\/\/images\.squarespace-cdn\.com\/content\/[^\s"'\\?]+\.(?:jpg|jpeg|png|webp)/gi) || []))].slice(0, 8);
      return { desc, imgs };
    } catch (e) { /* retry */ }
  }
  return { desc: "", imgs: [] };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0;
  for (const spec of ITEMS) {
    const existing = await C.findOne({ brand: /^farpointe/i, name: spec.name });
    if (existing) { console.log(`  SKIP (exists): ${spec.name}`); skipped++; continue; }
    const { desc, imgs } = scrape(spec.h);
    const derived = categoryForItemType(spec.itemType, spec.name);
    const category = spec.cat || derived.category;
    const subcategory = spec.sub || derived.subcategory;
    const wLine = spec.wNote ? `Weight (based on size Medium): ${spec.wNote}.` : `Weight not published by FarPointe.`;
    const description = [desc, wLine].filter(Boolean).join("\n\n").slice(0, 900);
    console.log(`  create: ${spec.name.padEnd(24)} [${spec.itemType}] ${spec.g ?? "-"}g  ${category}/${subcategory}  imgs:${imgs.length}  desc:${desc.length}c`);
    if (!COMMIT) continue;
    const doc = new C({ brand: "FarPointe", name: spec.name, createdBy: ADMIN_ID });
    doc.itemType = spec.itemType; doc.category = category; doc.subcategory = subcategory;
    doc.isActive = true;
    if (spec.g != null) doc.weightGrams = spec.g;
    doc.description = description;
    if (imgs.length) doc.imageUrls = imgs;
    doc.tags = spec.tags;
    doc.attributes = spec.attributes;
    doc.$locals.lenientAttributes = true;
    await doc.save();
    await O.create({ network: "direct", region: "global", merchantId: "direct-farpointe", merchantName: "FarPointe Outdoor Gear", productId: doc._id, deepLink: `https://www.farpointeog.com/stock/p/${spec.h}`, priority: 0 });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — created:${created} skipped:${skipped}`);
  await mongoose.disconnect();
})();
