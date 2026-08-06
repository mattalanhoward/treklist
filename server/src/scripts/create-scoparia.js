/**
 * create-scoparia.js — Scoparia Designs (scopariadesigns.com), a Tasmanian cottage
 * ultralight-pack maker on Wix (Pepyaka server; no Shopify/Woo feed, and the Wix Store
 * holds only unconfigured template placeholders). Everything is CUSTOM made-to-order via
 * an email/contact form — no cart, no affiliate, and each model's weight is published as
 * a RANGE (varies by chosen capacity/materials/features), not a fixed per-SKU figure.
 *
 * User chose (2026-08-06) to add the 3 base models anyway as representative Backpack
 * items — volume range in the name, weightGrams left NULL (range disclosed in copy),
 * unmonetized direct offer deep-linking to each model's info page. Data hand-read from
 * the pages (no structured feed exists).
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
  { name: "Turbo Chook 20–40L", handle: "turbo-chook-20l-40l", vol: "20–40L", wt: "450–650 g",
    img: "1c1f5b_ed33aafdbbca4b22bd4254eb0c5b9f4d~mv2.jpg",
    blurb: "Tough fastpack for trail running, adventure racing and multi-day trips.",
    prices: "20L A$420 / 30L A$435 / 40L A$450" },
  { name: "Scrub Wren 40–60L", handle: "scrub-wren-40l-60l", vol: "40–60L", wt: "850–1100 g",
    img: "1c1f5b_99148043458f47238f172bc621d0b122~mv2.jpg",
    blurb: "Tough, ultralight pack for all multi-day adventures." },
  { name: "The Beast 70–110L", handle: "the-beast-70l-110l", vol: "70–110L", wt: "1.1–1.5 kg",
    img: "1c1f5b_d148606d158b46378b743f58740a8a91~mv2.jpg",
    blurb: "Big-volume, tough, ultralight pack for outdoor professionals and serious adventurers." },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0;
  for (const m of MODELS) {
    if (await C.findOne({ name: m.name, brand: "Scoparia Designs" })) { console.log(`exists — skip ${m.name}`); continue; }
    const { category, subcategory } = categoryForItemType("Backpack", m.name);
    const deepLink = `https://www.scopariadesigns.com/${m.handle}`;
    const desc =
      `${m.blurb} Custom made-to-order in South Hobart, Tasmania, in ${m.vol} capacities. ` +
      `Listed weight ${m.wt} is a range that varies by chosen capacity, fabric and features — Scoparia does not publish a fixed per-configuration weight, so no single weight is recorded here. ` +
      (m.prices ? `Indicative pricing: ${m.prices}. ` : "") +
      `Ordered directly through Scoparia Designs (enquiry/order by contact form — no online checkout).`;
    console.log(`CREATE ${m.name.padEnd(20)} Backpack ${category}/${subcategory}  wt=null`);
    if (COMMIT) {
      const doc = new C({
        name: m.name, brand: "Scoparia Designs", itemType: "Backpack", category, subcategory,
        description: desc, imageUrls: [IMG + m.img], createdBy: ADMIN_ID, isActive: true,
        attributes: { gender: "Unisex" }, // volumeLiters is a range → left unset; range is in the name/desc
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`  !! ${m.name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-scoparia", merchantName: "Scoparia Designs", productId: doc._id, deepLink, priority: 0 });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? created + " created" : "(dry)"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
