/**
 * create-diorite-poles.js — import Diorite Gear trekking poles ONLY (user, 2026-07-02).
 * minimalgear.com (Shopify) carries Diorite Gear; their whole pole line = ONE product:
 * the **Telescopic Carbon Fiber Trekking Poles** in Cork / EVA Foam grip. Everything
 * else (Blemished/Refurbished seconds, individual Left/Right singles, the EVA Ultralight
 * Staff, parts/components, tent stakes/poles, merch) is intentionally excluded.
 *
 * ⚠ WEIGHT: feed lists the New pair at 680 g for BOTH grips, but the per-pole singles
 * give Cork 340 g (→680 g pair ✓) and EVA 283 g (→566 g pair). The feed's EVA pair
 * weight is a copy-paste error → use the corroborated 566 g for EVA.
 *
 *   node src/scripts/create-diorite-poles.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const HANDLE = "dioritegear-diorite-telescopic-carbon-fiber-trekking-poles-cork";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

(async () => {
  const r = await fetch("https://minimalgear.com/products.json?limit=250", { headers: { "User-Agent": UA } });
  const p = ((await r.json()).products || []).find((x) => x.handle === HANDLE);
  if (!p) { console.error("main pole product not found in feed"); process.exit(1); }
  const imgs = (p.images || []).map((i) => i.src).slice(0, 10);
  const desc =
    "Hand-built in Portland, OR, Diorite Gear's Telescopic Carbon Fiber Trekking Poles are a lightweight, robust four-season pole sold as a pair. " +
    "Lever-lock telescoping adjustment, padded adjustable straps, and carbide tips, with a choice of ergonomic compressed-cork or ultralight EVA foam grips. All parts are replaceable.";

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const { category, subcategory } = categoryForItemType("Trekking Poles");
  const name = "Telescopic Carbon Fiber Trekking Poles";

  const baseAttrs = {
    material: "Carbon Fiber", soldAs: "Pair", adjustmentType: "Telescoping",
    lockingMechanism: "Lever Lock", strapType: "Padded", tipType: "Carbide",
    gripMaterial: "EVA Foam",
  };
  const variantAxes = [{ name: "Grip", values: ["Cork", "EVA Foam"] }];
  const variants = [
    { key: "Cork", options: { Grip: "Cork" }, weightGrams: 680, sku: "DG-Tel-CF-C", attributes: { gripMaterial: "Cork" } },
    { key: "EVA Foam", options: { Grip: "EVA Foam" }, weightGrams: 566, sku: "DG-Tel-CF-E", attributes: { gripMaterial: "EVA Foam" } },
  ];

  let doc = await C.findOne({ brand: /^diorite/i, name });
  console.log(`${doc ? "update" : "create"}  ${name}  imgs:${imgs.length}  variants: Cork 680g / EVA 566g`);
  if (COMMIT) {
    if (!doc) doc = new C({ brand: "Diorite Gear", name, createdBy: ADMIN_ID });
    doc.itemType = "Trekking Poles";
    doc.category = category; doc.subcategory = subcategory;
    doc.isActive = true;
    doc.description = desc;
    doc.weightGrams = 566; // default = EVA Foam
    doc.imageUrls = imgs;
    doc.tags = ["Carbon Fiber", "Made in USA", "Telescoping"];
    doc.attributes = baseAttrs;
    doc.variantAxes = variantAxes;
    doc.variants = variants;
    doc.defaultVariantKey = "EVA Foam";
    doc.$locals.lenientAttributes = true;
    await doc.save();

    const has = await O.countDocuments({ productId: doc._id });
    if (!has) {
      await O.create({ network: "direct", region: "global", merchantId: "direct-minimalgear", merchantName: "Minimal Gear", productId: doc._id, deepLink: `https://minimalgear.com/products/${HANDLE}`, priority: 0 });
      console.log("  + created direct Minimal Gear offer");
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
