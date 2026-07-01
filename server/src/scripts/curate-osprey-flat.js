/**
 * curate-osprey-flat.js — single-axis Osprey packs that don't fit the full
 * Volume×Torso matrix: one-size multi-volume lines (all O/S) and RAGGED lines where
 * only some volumes split by torso (e.g. Talon: 22/26/33 = O/S, 44 = S/M + L/XL).
 *
 * The variant UI (VariantSelector.jsx) renders every axis value as an independent
 * pill with NO disabling of invalid combos, so a ragged 2-axis Volume×Torso would
 * allow nonsense selections. Instead these use ONE axis with an explicit variant
 * list — one pill per real, purchasable configuration.
 *
 * Optionally sets canonicalAsin (per-volume default) and re-fetches its images live
 * from the Amazon Creators API when the ASIN changes.
 *
 *   node src/scripts/curate-osprey-flat.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const {
  creatorsGetItems,
  extractAllImageUrls,
  getPartnerTagForMarketplace,
} = require("./../services/amazonCreatorsApi");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const MODELS = [
  {
    name: "Talon",
    itemType: "Backpack",
    axisName: "Size", // combined volume+torso axis (ragged: only 44 splits by torso)
    canonicalAsin: "B0DSCN3TZC", // 22L (default volume) — replaces the old non-per-volume ASIN → refetch images
    defaultKey: "22L",
    base: {
      gender: "Mens",
      frameType: "Internal Frame",
      backPanelType: "Foam", // AirScape molded foam backpanel
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "100D recycled high-tenacity nylon ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: false,
    },
    variants: [
      { key: "22L", volL: 22, g: 1080, loadKg: 13.6 },
      { key: "26L", volL: 26, g: 1070, loadKg: 13.6 },
      { key: "33L", volL: 33, g: 1260, loadKg: 13.6 },
      { key: "44L (S/M)", volL: 44, g: 1570, loadKg: 15.9, torso: "S/M" },
      { key: "44L (L/XL)", volL: 48, g: 1620, loadKg: 15.9, torso: "L/XL" },
    ],
  },
  {
    name: "Tempest",
    itemType: "Backpack",
    axisName: "Volume", // all O/S (one size) → pure volume axis, no torso. No 44 (discontinued).
    // canonicalAsin already B0DSCQF6QH (22L) — leave as-is, keep existing images
    defaultKey: "22L",
    base: {
      gender: "Womens",
      frameType: "Internal Frame",
      backPanelType: "Foam",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "100D recycled high-tenacity nylon ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: false,
    },
    variants: [
      { key: "22L", volL: 22, g: 1030, loadKg: 13.6 },
      { key: "26L", volL: 26, g: 1020, loadKg: 13.6 },
      { key: "33L", volL: 33, g: 1200, loadKg: 13.6 },
    ],
  },
  {
    // Was Daypack, but 44L > Daypack max (40) → Backpack. All O/S → Volume axis.
    name: "Stratos",
    itemType: "Backpack",
    category: "Backpacks & Bags",
    subcategory: "Backpacking Packs",
    axisName: "Volume",
    canonicalAsin: "B0G6GD7JLS", // 24L → refetch images
    defaultKey: "24L",
    base: {
      gender: "Mens",
      frameType: "Internal Frame", // AirSpeed tensioned-mesh suspension
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "100D x 210D recycled nylon honeycomb ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: true, // included raincover
    },
    variants: [
      { key: "24L", volL: 24, g: 1340, loadKg: 13.6 },
      { key: "34L", volL: 34, g: 1520, loadKg: 13.6 },
      { key: "36L", volL: 36, g: 1550, loadKg: 13.6 },
      { key: "44L", volL: 44, g: 1660, loadKg: 16 },
    ],
  },
  {
    name: "Sirrus",
    itemType: "Backpack",
    category: "Backpacks & Bags",
    subcategory: "Backpacking Packs",
    axisName: "Volume",
    canonicalAsin: "B0G6GKWX8D", // 24L → refetch images
    defaultKey: "24L",
    base: {
      gender: "Womens",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "100D x 210D recycled nylon honeycomb ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: true,
    },
    variants: [
      { key: "24L", volL: 24, g: 1300, loadKg: 13.6 },
      { key: "34L", volL: 34, g: 1470, loadKg: 13.6 },
      { key: "36L", volL: 36, g: 1490, loadKg: 13.6 },
      { key: "44L", volL: 44, g: 1600, loadKg: 16 },
    ],
  },
  {
    // DAYPACK (all volumes ≤ 40). ⚠ Daypack schema has NO backPanelType/mainFabric/
    // torsoFitRange (validateAttributes strips them) → set only Daypack-valid fields.
    // hipBeltType varies per volume → per-variant attrs.
    name: "Hikelite",
    itemType: "Daypack",
    axisName: "Volume",
    canonicalAsin: "B0FGY23CXN", // 18L → refetch images
    defaultKey: "18L",
    base: {
      gender: "Unisex",
      frameType: "Internal Frame", // AirSpeed tensioned mesh (valid Daypack enum)
      waterResistance: "DWR Coated",
      hydrationCompatible: true,
      rainCoverIncluded: true,
    },
    variants: [
      { key: "18L", volL: 18, g: 730, loadKg: 9, attrs: { hipBeltType: "Webbing Only" } },
      { key: "26L", volL: 26, g: 820, loadKg: 9, attrs: { hipBeltType: "Webbing Only" } },
      { key: "28L", volL: 28, g: 990, loadKg: 11, attrs: { hipBeltType: "Padded" } },
      { key: "32L", volL: 32, g: 1030, loadKg: 11, attrs: { hipBeltType: "Padded" } },
    ],
  },
];

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
  let updated = 0;
  for (const m of MODELS) {
    const doc = await C.findOne({ name: m.from || m.name, brand: /osprey/i, isActive: true });
    if (!doc) {
      console.log(`  ! "${m.from || m.name}" not found`);
      continue;
    }
    const axes = [{ name: m.axisName, values: m.variants.map((v) => v.key) }];
    const variants = m.variants.map((v) => {
      const attributes = { volumeLiters: v.volL };
      if (v.loadKg != null) attributes.loadCapacityKg = v.loadKg;
      if (v.torso) attributes.torsoFitRange = v.torso;
      if (v.attrs) Object.assign(attributes, v.attrs); // arbitrary per-variant attrs (e.g. hipBeltType)
      return { key: v.key, options: { [m.axisName]: v.key }, weightGrams: v.g, attributes };
    });
    const def = variants.find((v) => v.key === m.defaultKey) || variants[0];
    const changeAsin = m.canonicalAsin && m.canonicalAsin !== doc.canonicalAsin;

    console.log(`${m.name.padEnd(10)} ${m.axisName}[${axes[0].values.join(", ")}]  default:${def.key}${changeAsin ? `  asin→${m.canonicalAsin} (refetch imgs)` : ""}`);
    for (const v of variants)
      console.log(`   ${v.key.padEnd(12)} ${v.attributes.volumeLiters}L  ${v.weightGrams}g  ${v.attributes.loadCapacityKg ?? "-"}kg${v.attributes.torsoFitRange ? " " + v.attributes.torsoFitRange : ""}`);

    if (COMMIT) {
      if (changeAsin) {
        const imgs = await fetchImages(m.canonicalAsin);
        if (imgs.length) {
          doc.imageUrls = imgs;
          doc.canonicalAsin = m.canonicalAsin;
          console.log(`   ↻ ${imgs.length} images from ${m.canonicalAsin}`);
        } else {
          console.log(`   !! ${m.name}: image refetch empty — keeping old ASIN/images`);
        }
      }
      doc.name = m.name;
      doc.itemType = m.itemType;
      if (m.category) doc.category = m.category;
      if (m.subcategory) doc.subcategory = m.subcategory;
      doc.variantAxes = axes;
      doc.variants = variants;
      doc.defaultVariantKey = def.key;
      doc.weightGrams = def.weightGrams;
      doc.attributes = { ...m.base, ...def.attributes };
      doc.$locals.lenientAttributes = true;
      try {
        await doc.save();
        updated++;
      } catch (e) {
        console.log(`   !! ${m.name}: ${e.message}`);
      }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${updated} model(s) updated`);
  await mongoose.disconnect();
})();
