/**
 * create-osprey-aura.js — create the NEW Osprey women's AntiGravity pack "Aura AG"
 * (women's counterpart of the consolidated men's Atmos AG). Built CONSOLIDATED:
 * one catalog item, Volume × Torso Size variant matrix (weight/volume/load/fit swap
 * per torso size via per-variant attributes — same model as curate-osprey-torso.js).
 *
 * ⚠ ONE ASIN per item (data-model limit: canonicalAsin + offers can't route per
 *   variant — see memory project-per-variant-offer-routing, revisit ~2026-07-07).
 *   Canonical = the 50L ASIN so the default-shown 50L variant's images are coherent.
 *   65L ASIN = B09JXJVDRT — attach once per-variant offer routing exists.
 *
 * Images are FETCHED LIVE from the Amazon Creators API (the daily amazonImageRefresh
 * job then maintains them; it only refreshes items that already have an Amazon image,
 * so seeding is required). One Amazon MerchantOffer via the ASIN.
 *
 * Clean Backpack attributes (AntiGravity = "Internal Frame"). Metric source specs →
 * weights stored as grams directly.
 *
 *   node src/scripts/create-osprey-aura.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const {
  creatorsGetItems,
  extractAllImageUrls,
  getPartnerTagForMarketplace,
} = require("../services/amazonCreatorsApi");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36"; // createdBy (matches existing manual Osprey items)
const AFFIL_TAG = "treklistapp-20";

const MODELS = [
  {
    name: "Aura AG",
    asin: "B09JXJ9CM4", // 50L listing (canonical — matches default volume). 65L = B09JXJVDRT (future)
    description:
      "The women's Osprey Aura AG brings gravity-defying AntiGravity comfort and premium ventilation to multiday backpacking, with a women's-specific fit and 3D-suspended mesh suspension.",
    dimensions: { length: 80, width: 38, height: 31, unit: "cm" }, // 50L WM/L: 31H x 38W x 80D cm
    defaultKey: "50L / WM/L", // nominal 50L (= WM/L for women's) — matches the 50L canonical ASIN
    base: {
      gender: "Womens",
      frameType: "Internal Frame", // AntiGravity tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "210D recycled honeycomb nylon",
      hydrationCompatible: true,
      rainCoverIncluded: true,
    },
    rows: [
      { vol: "50L", torso: "WXS/S", volL: 47, g: 1888, loadKg: 16 },
      { vol: "50L", torso: "WM/L", volL: 50, g: 1946, loadKg: 16 },
      { vol: "65L", torso: "WXS/S", volL: 62, g: 2026, loadKg: 18 },
      { vol: "65L", torso: "WM/L", volL: 65, g: 2085, loadKg: 18 },
    ],
  },
  {
    name: "Aura AG LT",
    asin: "B0BKQJH4Q2", // 65L listing (canonical — user-provided). 50L ASIN = TBD (future per-variant offers).
    description:
      "The women's Osprey Aura AG LT pairs the ventilated, comfortable AntiGravity suspension with a lighter, streamlined silhouette for technical backpackers, in a women's-specific fit.",
    dimensions: undefined, // LT spec gives no dimensions
    defaultKey: "65L / WM/L", // nominal 65L (= WM/L) — matches the 65L canonical ASIN
    base: {
      gender: "Womens",
      frameType: "Internal Frame", // AntiGravity tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "210D recycled honeycomb nylon",
      hydrationCompatible: true,
      rainCoverIncluded: true,
    },
    rows: [
      // LOAD RANGE blank in source → no loadCapacityKg
      { vol: "50L", torso: "WXS/S", volL: 48, g: 1720 },
      { vol: "50L", torso: "WM/L", volL: 50, g: 1800 },
      { vol: "65L", torso: "WXS/S", volL: 63, g: 1740 },
      { vol: "65L", torso: "WM/L", volL: 65, g: 1820 },
    ],
  },
  {
    // NEW women's running-vest daypack. DAYPACK → no backPanelType/mainFabric (stripped).
    // Full Volume×Torso (both volumes split). No load range in spec.
    name: "Tempest Velocity",
    itemType: "Daypack",
    subcategory: "Day Packs & Accessories",
    asin: "B0CGQ3PDB1", // 20L canonical. 30L = B0CGQ5NGL1 (ledger)
    description:
      "The women's Osprey Tempest Velocity is a light-and-fast, multi-sport daypack with a running-vest-inspired harness and flexible backpanel for speed-focused pursuits.",
    dimensions: undefined,
    defaultKey: "20L / WM/L", // nominal 20L (= WM/L for women's)
    base: {
      gender: "Womens",
      frameType: "Frameless", // flexible running-vest backpanel (Daypack enum)
      hipBeltType: "Webbing Only",
      waterResistance: "DWR Coated",
      hydrationCompatible: true,
      rainCoverIncluded: false,
    },
    rows: [
      // women's: WM/L = nominal volume, WXS/S = smaller. No load range in spec.
      { vol: "20L", torso: "WXS/S", volL: 18, g: 820 },
      { vol: "20L", torso: "WM/L", volL: 20, g: 860 },
      { vol: "30L", torso: "WXS/S", volL: 28, g: 920 },
      { vol: "30L", torso: "WM/L", volL: 29, g: 960 },
    ],
  },
];

function buildVariants(m) {
  const volumes = [...new Set(m.rows.map((r) => r.vol))];
  const torsos = [...new Set(m.rows.map((r) => r.torso))];
  const multiVol = volumes.length > 1;
  const axes = [];
  if (multiVol) axes.push({ name: "Volume", values: volumes });
  axes.push({ name: "Torso Size", values: torsos });
  const variants = m.rows.map((r) => {
    const options = {};
    if (multiVol) options.Volume = r.vol;
    options["Torso Size"] = r.torso;
    const key = Object.values(options).join(" / ");
    const attributes = { volumeLiters: r.volL, torsoFitRange: r.torso };
    if (r.loadKg != null) attributes.loadCapacityKg = r.loadKg;
    return { key, options, weightGrams: r.g, attributes };
  });
  const def = variants.find((v) => v.key === m.defaultKey) || variants[0];
  return { axes, variants, def };
}

async function fetchImages(asin) {
  const partnerTag = getPartnerTagForMarketplace("us");
  const json = await creatorsGetItems({
    asins: [asin],
    marketplace: "us",
    partnerTag,
    resources: ["images.primary.large", "images.variants.large"],
  });
  const items = json?.itemsResult?.items || json?.ItemsResult?.Items || [];
  const it = items.find((x) => (x?.asin || x?.ASIN || "").toUpperCase() === asin.toUpperCase());
  return it ? extractAllImageUrls(it) : [];
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0;
  for (const m of MODELS) {
    const exists = await C.findOne({ name: m.name, brand: /osprey/i }).lean();
    if (exists) {
      console.log(`${m.name}: already exists (_id ${exists._id}) — skip`);
      continue;
    }
    const { axes, variants, def } = buildVariants(m);
    let images = [];
    if (m.asin) {
      try {
        images = await fetchImages(m.asin);
      } catch (e) {
        console.log(`   !! ${m.name}: image fetch failed: ${e.message}`);
      }
    }
    console.log(`${m.name}  ${axes.map((a) => `${a.name}[${a.values.join("/")}]`).join(" × ")}  asin ${m.asin || "(none — need ASIN)"}  images:${images.length}  default:${def.key}`);
    for (const v of variants)
      console.log(`   ${v.key.padEnd(16)} ${v.attributes.volumeLiters}L  ${v.weightGrams}g  ${v.attributes.loadCapacityKg ?? "-"}kg`);

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${m.name}: no images fetched — refusing to create (clean bar needs images)`);
        continue;
      }
      const doc = new C({
        name: m.name,
        brand: "Osprey",
        itemType: m.itemType || "Backpack",
        category: m.category || "Backpacks & Bags",
        subcategory: m.subcategory || "Backpacking Packs",
        description: m.description,
        imageUrls: images,
        dimensions: m.dimensions,
        canonicalAsin: m.asin,
        createdBy: ADMIN_ID,
        isActive: true,
        variantAxes: axes,
        variants,
        defaultVariantKey: def.key,
        weightGrams: def.weightGrams,
        attributes: { ...m.base, ...def.attributes },
      });
      doc.$locals.lenientAttributes = true;
      try {
        await doc.save();
      } catch (e) {
        console.log(`   !! ${m.name}: ${e.message}`);
        continue;
      }
      await O.create({
        network: "amazon",
        region: "global",
        merchantId: "amazon-us",
        merchantName: "Amazon",
        productId: doc._id,
        externalProductId: m.asin,
        deepLink: `https://www.amazon.com/dp/${m.asin}?tag=${AFFIL_TAG}`,
        priority: 0,
      });
      created++;
      console.log(`   ✓ created ${m.name} (_id ${doc._id}) + Amazon offer + ${images.length} images`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created`);
  await mongoose.disconnect();
})();
