/**
 * create-altra-gaiter.js — adds the one Altra soft-good deferred from the shoe pass:
 * the Trail Gaiter (a strapless low trail gaiter that keeps debris out of GaiterTrap-
 * equipped Altra shoes). Separate from create-altra.js because that script is
 * shoe-spec-scraper-specific.
 *
 * - itemType "Hat/Headwear" / category "Unisex Clothing" / subcategory "Headwear" —
 *   matches the existing catalog convention for trail/leg gaiters (all the Outdoor
 *   Research trail gaiters are typed this way; there's no dedicated Gaiter itemType,
 *   the schema fallback maps bare "gaiter" -> Hat/Headwear). No attributes set
 *   (matches the OR trail-gaiter precedent; Hat/Headwear's required `hatType` enum
 *   has no honest value for a foot gaiter) via lenientAttributes.
 * - Size[S/L] variant axis (color dropped per the locked variant standard). Size is
 *   a Shopify on-page selector on ONE product page -> single item-level offer, no
 *   per-variant deepLink (matches the HMG/Zpacks single-page selector pattern).
 * - weightGrams null: Altra publishes no weight anywhere for the gaiter (feed grams
 *   0, no spec accordion on the page) — left blank per the no-weight policy, same as
 *   several no-weight accessories already in the catalog.
 *
 *   node src/scripts/create-altra-gaiter.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const HANDLE = "trail-gaiter-al016301";
const FEED_BASE = "https://www.altrarunning.com/en-us/products.json?limit=250";

async function fetchProduct(handle) {
  for (let page = 1; page <= 3; page++) {
    let json;
    for (let tries = 0; tries < 3 && !json; tries++) {
      try {
        const res = await fetch(`${FEED_BASE}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) json = await res.json();
      } catch (e) {
        /* retry */
      }
      if (!json) await new Promise((r) => setTimeout(r, 500));
    }
    if (!json || !json.products?.length) break;
    const p = json.products.find((x) => x.handle === handle);
    if (p) return p;
  }
  return null;
}

function getGallery(p) {
  const colorOpt = p.options.find((o) => o.name === "Color");
  if (!colorOpt) return p.images.map((i) => i.src).slice(0, 10);
  for (const color of colorOpt.values) {
    const variantIds = p.variants.filter((v) => v.option1 === color).map((v) => v.id);
    const hero = p.images.find((img) => img.variant_ids.some((id) => variantIds.includes(id)));
    if (!hero) continue;
    const prefix = hero.src.split("/").pop().split("-")[0];
    const gallery = p.images.filter((img) => img.src.includes("/" + prefix + "-") || img.src.includes("/" + prefix + "."));
    if (gallery.length) return gallery.map((g) => g.src).slice(0, 10);
  }
  return [];
}

(async () => {
  const p = await fetchProduct(HANDLE);
  if (!p) {
    console.error("Trail Gaiter not found in feed");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const name = "Trail Gaiter";
  const existing = await C.findOne({ name, brand: /altra/i }).lean();
  if (existing) {
    console.log(`${name}: already exists — skip`);
    await mongoose.disconnect();
    return;
  }

  const sizeOpt = p.options.find((o) => o.name === "Size");
  const sizes = sizeOpt ? sizeOpt.values : [];
  const images = getGallery(p);
  const deepLink = `https://www.altrarunning.com/products/${HANDLE}`;
  const description = p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);

  console.log(`${name}  Size[${sizes.join("/")}]  imgs:${images.length}  weight:none`);

  if (COMMIT) {
    if (!images.length) {
      console.log("   !! no images — abort");
      await mongoose.disconnect();
      return;
    }
    const doc = new C({
      name,
      brand: "Altra",
      itemType: "Hat/Headwear",
      category: "Unisex Clothing",
      subcategory: "Headwear",
      description,
      imageUrls: images,
      createdBy: ADMIN_ID,
      isActive: true,
      ...(sizes.length
        ? {
            variantAxes: [{ name: "Size", values: sizes }],
            variants: sizes.map((s) => ({ key: s, options: { Size: s } })),
            defaultVariantKey: sizes.includes("S") ? "S" : sizes[0],
          }
        : {}),
    });
    doc.$locals.lenientAttributes = true;
    await doc.save();
    await O.create({
      network: "direct",
      region: "global",
      merchantId: "direct-altra",
      merchantName: "Altra",
      productId: doc._id,
      deepLink,
      priority: 0,
    });
    console.log(`   ✓ created (_id ${doc._id}) + direct offer`);
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
