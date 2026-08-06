/**
 * create-scoparia.js — Scoparia Designs (scopariadesigns.com), a Tasmanian cottage
 * ultralight-pack maker on Wix (no Shopify/Woo feed; custom made-to-order, no cart/
 * affiliate; weights published only as a RANGE per model, not per capacity).
 *
 * User chose (2026-08-06) to add the 3 base models as representative Backpack items,
 * then (revision) to model the capacity options as a **Volume variant axis** (per-variant
 * `volumeLiters`) rather than a range in the name. weightGrams stays NULL — Scoparia
 * publishes only a per-model weight range, and it varies by fabric/features too, so no
 * per-size weight is invented. Prices are per-capacity → kept in the description
 * (offers can't route per-variant). Data + images hand-supplied by the user.
 *
 * Idempotent: matches an existing item by base-name regex and updates in place
 * (renames the earlier "<Model> NN–NNL" items, refreshes image/variants/copy).
 *
 *   node src/scripts/create-scoparia.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const IMG = "https://static.wixstatic.com/media/";

const MODELS = [
  { base: "Turbo Chook", handle: "turbo-chook-20l-40l", img: "1c1f5b_fe6153dab37340efb5ac5d20be9d2b68~mv2.jpg",
    vols: [20, 30, 40], dflt: 30, wt: "450–650 g",
    blurb: "Tough fastpack for trail running, adventure racing and multi-day trips.",
    prices: { 20: 420, 30: 435, 40: 450 } },
  { base: "Scrub Wren", handle: "scrub-wren-40l-60l", img: "1c1f5b_29dd9803073e4b14891d93d00f2b2de1~mv2.jpg",
    vols: [40, 50, 60], dflt: 50, wt: "850–1100 g",
    blurb: "Tough, ultralight pack for all multi-day adventures.", prices: null },
  { base: "The Beast", handle: "the-beast-70l-110l", img: "1c1f5b_30c58f0d2afb4830aeed6a43e402af18~mv2.jpg",
    vols: [60, 70, 80, 90, 100, 110], dflt: 80, wt: "1.1–1.5 kg",
    blurb: "Big-volume, tough, ultralight pack for outdoor professionals and serious adventurers.",
    prices: { 60: 620, 70: 640, 80: 660, 90: 680, 100: 700, 110: 720 } },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let done = 0;
  for (const m of MODELS) {
    const { category, subcategory } = categoryForItemType("Backpack", m.base);
    const deepLink = `https://www.scopariadesigns.com/${m.handle}`;
    const variantAxes = [{ name: "Volume", values: m.vols.map((v) => `${v}L`) }];
    const variants = m.vols.map((v) => ({ key: `${v}L`, options: { Volume: `${v}L` }, attributes: { volumeLiters: v } }));
    const priceStr = m.prices ? ` Indicative pricing: ${m.vols.map((v) => `${v}L A$${m.prices[v]}`).join(", ")}.` : "";
    const desc =
      `${m.blurb} Custom made-to-order in South Hobart, Tasmania, in ${m.vols[0]}–${m.vols[m.vols.length - 1]}L capacities. ` +
      `Listed weight ${m.wt} is a per-model range that varies by capacity, fabric and features — Scoparia does not publish a fixed per-size weight, so none is recorded here.` +
      priceStr +
      ` Ordered directly through Scoparia Designs (enquiry/order by contact form — no online checkout).`;
    const set = {
      name: m.base, brand: "Scoparia Designs", itemType: "Backpack", category, subcategory,
      description: desc, imageUrls: [IMG + m.img], isActive: true,
      attributes: { gender: "Unisex", volumeLiters: m.dflt },
      variantAxes, variants, defaultVariantKey: `${m.dflt}L`,
    };

    const existing = await C.findOne({ brand: "Scoparia Designs", name: new RegExp("^" + m.base, "i") });
    if (existing) {
      console.log(`UPDATE ${existing.name}  ->  ${m.base}  Volume[${m.vols.join("/")}]`);
      if (COMMIT) { await C.collection.updateOne({ _id: existing._id }, { $set: { ...set, weightGrams: null } }); }
      done++;
    } else {
      console.log(`CREATE ${m.base}  Volume[${m.vols.join("/")}]`);
      if (COMMIT) {
        const doc = new C({ ...set, createdBy: ADMIN_ID });
        doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`  !! ${m.base}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-scoparia", merchantName: "Scoparia Designs", productId: doc._id, deepLink, priority: 0 });
        done++;
      }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${done} models`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
