/**
 * curate-osprey-torso.js — add a Torso Size axis to the consolidated Osprey packs.
 *
 * Rebuilds each model into a Volume × Torso Size matrix (multi-volume packs) or a
 * Torso Size–only matrix (single-volume packs). Volume, weight and torso fit all
 * vary by torso size, so each variant carries its own weightGrams + per-variant
 * attributes (volumeLiters, torsoFitRange) that merge OVER the base attributes on
 * the client (same pattern as Bandit Lite / PAKKID).
 *
 * ⚠ Sets CLEAN attributes — the manual Osprey items had invalid frameType values
 *   that fail Backpack validation. AntiGravity = "Internal Frame" (tensioned mesh).
 *
 *   node src/scripts/curate-osprey-torso.js [--commit]
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

const LB = 453.59237; // lbs → grams

// Each model: existing consolidated item `name`, base attributes (shared, clean),
// and rows = one per Volume×Torso combination. `vol` = the named/nominal volume
// (the Volume axis label, e.g. "65L"); `volL` = actual volumeLiters for that size.
// Weight: `lbs` (imperial source) OR `g` (metric source, grams direct).
// Load (swaps per-variant with volume, optional): `loadLb` OR `loadKg`.
const MODELS = [
  {
    name: "Atmos AG",
    base: {
      gender: "Mens",
      frameType: "Internal Frame", // AntiGravity tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "210D recycled honeycomb nylon",
      hydrationCompatible: true,
      rainCoverIncluded: true,
    },
    rows: [
      { vol: "50L", torso: "S/M", volL: 50, lbs: 4.32, loadLb: 35 },
      { vol: "50L", torso: "L/XL", volL: 53, lbs: 4.509, loadLb: 35 },
      { vol: "65L", torso: "S/M", volL: 65, lbs: 4.613, loadLb: 40 },
      { vol: "65L", torso: "L/XL", volL: 68, lbs: 4.807, loadLb: 40 },
    ],
  },
  {
    name: "Atmos AG LT",
    base: {
      gender: "Mens",
      frameType: "Internal Frame", // AntiGravity tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "Recycled nylon", // LT spec gives no denier ("recycled main body fabrics")
      hydrationCompatible: true,
      rainCoverIncluded: true,
    },
    rows: [
      // LOAD RANGE blank in source → no loadCapacityKg
      { vol: "50L", torso: "S/M", volL: 50, g: 1815 },
      { vol: "50L", torso: "L/XL", volL: 53, g: 1895 },
      { vol: "65L", torso: "S/M", volL: 65, g: 1845 },
      { vol: "65L", torso: "L/XL", volL: 68, g: 1925 },
    ],
  },
  {
    name: "Exos",
    from: "Exos 48", // drop the liters: existing single "Exos 48" → consolidated "Exos"
    defaultKey: "48L / S/M", // default to the volume whose ASIN/images this item already carries
    base: {
      gender: "Mens",
      frameType: "Internal Frame", // AirSpeed tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "100D high tenacity nylon ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: false, // Exos has no included raincover (FlapJacket instead)
    },
    rows: [
      { vol: "38L", torso: "S/M", volL: 38, g: 1222, loadKg: 11 },
      { vol: "38L", torso: "L/XL", volL: 41, g: 1282, loadKg: 11 },
      { vol: "48L", torso: "S/M", volL: 48, g: 1255, loadKg: 14 },
      { vol: "48L", torso: "L/XL", volL: 51, g: 1294, loadKg: 14 },
      { vol: "58L", torso: "S/M", volL: 58, g: 1288, loadKg: 16 },
      { vol: "58L", torso: "L/XL", volL: 61, g: 1334, loadKg: 16 },
    ],
  },
  {
    name: "Eja",
    from: "Eja 48", // women's Exos: existing single "Eja 48" → consolidated "Eja"
    defaultKey: "48L / WM/L", // nominal 48L (= WM/L for women's) — matches the existing ASIN's volume
    base: {
      gender: "Womens",
      frameType: "Internal Frame", // AirSpeed tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "100D high tenacity nylon ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: false, // FlapJacket, no included raincover
    },
    rows: [
      // women's: WM/L = nominal volume, WXS/S = smaller
      { vol: "38L", torso: "WXS/S", volL: 35, g: 1178, loadKg: 11 },
      { vol: "38L", torso: "WM/L", volL: 38, g: 1218, loadKg: 11 },
      { vol: "48L", torso: "WXS/S", volL: 45, g: 1209, loadKg: 14 },
      { vol: "48L", torso: "WM/L", volL: 48, g: 1251, loadKg: 14 },
      { vol: "58L", torso: "WXS/S", volL: 55, g: 1232, loadKg: 16 },
      { vol: "58L", torso: "WM/L", volL: 58, g: 1280, loadKg: 16 },
    ],
  },
  {
    // Single-volume → Torso-only axis (no Volume axis). ⚠ Osprey publishes NO
    // per-torso weight for the Pro line; spec block had no WEIGHT. Existing curated
    // weight (979 g) applied to BOTH torsos — volume/fit swap, weight does not.
    name: "Exos Pro 55",
    defaultKey: "S/M", // S/M = nominal 55 L
    base: {
      gender: "Mens",
      frameType: "Internal Frame", // AirSpeed tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "NanoFly™ : 100D Nylon x 200D UHMWPE ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: false, // FlapJacket, no included raincover
    },
    rows: [
      { torso: "S/M", volL: 55, g: 979, loadKg: 18 },
      { torso: "L/XL", volL: 58, g: 979, loadKg: 18 }, // weight not published per torso → same as S/M
    ],
  },
  {
    // Women's Exos Pro. Existing item mis-named "Eja Pro 48" but is the 55 L pack
    // (attr volumeLiters=55) → rename to "Eja Pro 55". Same flat-weight caveat.
    name: "Eja Pro 55",
    from: "Eja Pro 48",
    defaultKey: "WM/L", // WM/L = nominal 55 L
    base: {
      gender: "Womens",
      frameType: "Internal Frame", // AirSpeed tensioned mesh
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      waterResistance: "DWR Coated",
      mainFabric: "NanoFly™ : 100D Nylon x 200D UHMWPE ripstop",
      hydrationCompatible: true,
      rainCoverIncluded: false,
    },
    rows: [
      { torso: "WXS/S", volL: 52, g: 934, loadKg: 18 },
      { torso: "WM/L", volL: 55, g: 934, loadKg: 18 }, // weight not published per torso → same as WXS/S
    ],
  },
  {
    // DAYPACK, full Volume×Torso (both volumes split by torso). No load range in spec.
    // Daypack schema strips backPanelType/mainFabric/torsoFitRange from BASE (variants
    // keep torsoFitRange). Running-vest style → Frameless. Swap canonical to 20L ASIN.
    name: "Talon Velocity",
    itemType: "Daypack",
    canonicalAsin: "B0CGQ3P6WB", // 20L → refetch images
    defaultKey: "20L / S/M",
    base: {
      gender: "Mens",
      frameType: "Frameless", // flexible running-vest backpanel (Daypack enum)
      hipBeltType: "Webbing Only",
      waterResistance: "DWR Coated",
      hydrationCompatible: true,
      rainCoverIncluded: false,
    },
    rows: [
      { vol: "20L", torso: "S/M", volL: 20, g: 870 },
      { vol: "20L", torso: "L/XL", volL: 22, g: 920 },
      { vol: "30L", torso: "S/M", volL: 30, g: 960 },
      { vol: "30L", torso: "L/XL", volL: 32, g: 1000 },
    ],
  },
];

const g = (lbs) => Math.round(lbs * LB);
const kg = (lb) => Math.round(lb * 0.45359237 * 10) / 10;
const grams = (r) => (r.g != null ? r.g : g(r.lbs));
const loadKg = (r) => (r.loadKg != null ? r.loadKg : r.loadLb != null ? kg(r.loadLb) : null);

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
    const matchName = m.from || m.name; // `from` = current name when renaming (e.g. "Exos 48" → "Exos")
    const doc = await C.findOne({ name: matchName, brand: /osprey/i, isActive: true });
    if (!doc) {
      console.log(`  ! "${matchName}" not found`);
      continue;
    }
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
      const lk = loadKg(r);
      if (lk != null) attributes.loadCapacityKg = lk;
      return { key, options, weightGrams: grams(r), attributes };
    });

    const def = variants.find((v) => v.key === m.defaultKey) || variants[0];
    const rename = m.from && m.from !== m.name ? `  (rename "${m.from}" → "${m.name}")` : "";
    const changeAsin = m.canonicalAsin && m.canonicalAsin !== doc.canonicalAsin;
    console.log(`${m.name.padEnd(20)} ${axes.map((a) => `${a.name}[${a.values.join("/")}]`).join(" × ")}  default:${def.key}${rename}${changeAsin ? `  asin→${m.canonicalAsin}` : ""}`);
    for (const v of variants)
      console.log(`   ${v.key.padEnd(16)} ${v.attributes.volumeLiters}L  ${v.weightGrams}g  ${v.attributes.loadCapacityKg ?? "-"}kg`);

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
      doc.name = m.name; // applies rename when `from` differs
      if (m.itemType) doc.itemType = m.itemType;
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
