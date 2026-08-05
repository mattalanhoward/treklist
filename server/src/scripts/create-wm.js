/**
 * create-wm.js — Western Mountaineering (westernmountaineering.com) catalog import.
 * WooCommerce, open Store API (⚠ response JSON is prefixed with a PHP warning — strip to first
 * `[`). Premium US down house-brand. Direct/unmonetized offers (no affiliate program).
 *
 * DATA: reads sibling wm-data.json — 63 curated records (41 sleeping bags, 3 quilts, 10 down
 * jackets/vests, 3 booties, 2 down pants, 3 liners, 1 pillow). Weights are HAND-SCRAPED from the
 * PDP spec tables (the Woo `weight` field is EMPTY on every product). Per-length weights modeled
 * as a `Length` variant axis (Left/Right zip is weight-neutral → noted, not an axis). Temp rating
 * = product identity, baked into the item name (e.g. "UltraLite 20°F Sleeping Bag"), per the REI
 * variant standard. Regenerate the data file with scratchpad/scrape-wm.js + build-wm-data.js.
 *
 * The 4 flagship bags/quilt that existed pre-import (UltraLite/FlyLite/VersaLite/NanoLite) must be
 * DELETED first so their new per-length-variant versions insert (dedupe is by name+brand). Tioga
 * liner is intentionally kept (dedupe-skips) — it already carries a weight.
 *
 *   node src/scripts/create-wm.js            # dry-run
 *   node src/scripts/create-wm.js --commit   # write to treklist_local only
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("Refusing to --commit against a DB other than treklist_local");
  process.exit(1);
}
const ADMIN_ID = "69565d7c3480c2216f915a36";
const BRAND = "Western Mountaineering";
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "wm-data.json"), "utf8"));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0;
  for (const rec of DATA) {
    if (!rec.imageUrl) { console.log("  !! no image:", rec.name); skipped++; continue; }
    const vtag = rec.variants ? ` [${rec.variants.length}× ${rec.variantAxes[0].name}: ${rec.variants.map((v) => v.weightGrams + "g").join("/")}]` : "";
    console.log(`  ${String(created + 1).padStart(3)}. ${rec.itemType.padEnd(18)} ${String(rec.weightGrams || "-").padStart(5)}g  ${rec.name.slice(0, 40)}${vtag}`);
    if (!COMMIT) { created++; continue; }

    if (await C.findOne({ name: rec.name, brand: BRAND, isActive: true }).select("_id").lean()) { skipped++; continue; }
    const { category, subcategory } = categoryForItemType(rec.itemType, "");
    const doc = new C({
      name: rec.name, brand: BRAND, itemType: rec.itemType,
      ...(category ? { category, subcategory } : {}),
      description: rec.description, imageUrls: [rec.imageUrl],
      createdBy: ADMIN_ID, isActive: true,
      ...(rec.weightGrams ? { weightGrams: rec.weightGrams } : {}),
      ...(rec.variants ? { variantAxes: rec.variantAxes, variants: rec.variants, defaultVariantKey: rec.defaultVariantKey } : {}),
      attributes: rec.attributes || {},
    });
    doc.$locals.lenientAttributes = true;
    try { await doc.save(); } catch (e) { console.log("     !! " + e.message); skipped++; continue; }
    await O.create({
      network: "direct", region: "global", merchantId: "direct-wm", merchantName: "Western Mountaineering",
      productId: doc._id, deepLink: rec.url, priority: 0,
    });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} items, ${skipped} skipped (from ${DATA.length} records)`);
  await mongoose.disconnect();
})();
