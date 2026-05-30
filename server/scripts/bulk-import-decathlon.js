#!/usr/bin/env node
/**
 * bulk-import-decathlon.js
 *
 * Two-phase import for Decathlon items extracted from in-store photos.
 *
 * Phase 1 — ref lookup:   match AffiliateProduct.merchantProductId = store ref
 * Phase 2 — name fallback: when phase 1 fails, search by keyword terms + brand
 *
 * Usage:
 *   node scripts/bulk-import-decathlon.js --dry-run   # preview only
 *   node scripts/bulk-import-decathlon.js             # live import
 */

require("dotenv").config();
const mongoose = require("mongoose");

const AffiliateProduct = require("../src/models/affiliateProduct");
const CatalogItem      = require("../src/models/catalogItem");
const MerchantOffer    = require("../src/models/merchantOffer");

const DRY_RUN     = process.argv.includes("--dry-run");
const MERCHANT_ID = process.env.AWIN_DECATHLON_MERCHANT_ID || "26895";
const CREATED_BY  = new mongoose.Types.ObjectId("6986dbd0fb2ab55690c5fbe9");

// Only accept matches from these Decathlon own-brands.
// Prevents NL store ref numbers colliding with unrelated UK products.
const ALLOWED_BRANDS = new Set(["simond", "forclaz", "quechua", "decathlon"]);

// ---------------------------------------------------------------------------
// Product list extracted from in-store photos.
//
// ref         — Decathlon store reference number (from signage)
// keywords    — fallback: ALL terms must appear in awin product name (case-insensitive)
//               leave [] to skip the name-fallback for this item
// notKeywords — terms that must NOT appear in the name (disambiguation)
// ---------------------------------------------------------------------------
const PRODUCTS = [
  // ---- SLEEPING BAGS ----
  { ref: "8799895", keywords: [] },
  { ref: "8799893", keywords: ["MT500", "sleeping", "10°c"],  notKeywords: ["down", "15°c"] },
  { ref: "8799889", keywords: ["MT500", "sleeping", "5°c"],   notKeywords: ["down", "15°c", "10°c", "-5°c"] },
  { ref: "8799901", keywords: [] },
  { ref: "8799902", keywords: [] },
  { ref: "8407105", keywords: ["MT500", "down", "sleeping", "10°c"] },
  { ref: "8407113", keywords: ["MT500", "down", "sleeping", "5°c"],  notKeywords: ["15°c", "10°c", "-5°c"] },
  { ref: "8480702", keywords: ["MT900", "down", "sleeping", "0°c"] },
  { ref: "8489109", keywords: ["makalu", "sleeping", "-5°c"] },
  { ref: "8489191", keywords: ["makalu", "sleeping", "-9°c"] },
  { ref: "8480193", keywords: ["makalu", "sleeping", "-12°c"] },

  // ---- COOKING STOVES ----
  { ref: "8582112", keywords: [] },
  { ref: "8559534", keywords: [] },
  { ref: "8559535", keywords: [] },
  { ref: "8975262", keywords: [] },

  // ---- TARPS ----
  { ref: "8968612", keywords: [] },
  { ref: "8968614", keywords: [] },  // already in DB

  // ---- TUNNEL TENTS ----
  { ref: "8586318", keywords: [] },
  { ref: "8882677", keywords: [] },
  { ref: "8882697", keywords: [] },

  // ---- TENTS MT900 ----
  { ref: "8882673", keywords: [] },
  { ref: "8882674", keywords: [] },  // already in DB
  { ref: "8882675", keywords: [] },

  // ---- TENTS MT500 ----
  { ref: "8786418", keywords: [] },
  { ref: "8858233", keywords: [] },
  { ref: "8858234", keywords: [] },

  // ---- SLEEPING MATS ----
  { ref: "5591040", keywords: ["MT100", "foam", "mattress"],      notKeywords: ["insulating"] },
  { ref: "6492712", keywords: ["MT500", "foam", "mattress"],      notKeywords: ["insulating"] },
  // MT100 insulating foam — no UK equivalent found; will fall through to NOT FOUND
  { ref: "8801325", keywords: [] },
  { ref: "8612278", keywords: [] },
  { ref: "8612279", keywords: [] },  // already in DB
  { ref: "8799965", keywords: [] },
  { ref: "8799966", keywords: [] },
  { ref: "8853280", keywords: [] },
  { ref: "8853281", keywords: [] },
  { ref: "8975036", keywords: [] },
  { ref: "8799038", keywords: ["MT900", "air", "mattress", "XL"],  notKeywords: ["insulating"] },
  { ref: "8975202", keywords: [] },
  { ref: "8975212", keywords: [] },
  { ref: "8817232", keywords: [] },

  // ---- WOMEN'S HIKING BOOTS ----
  { ref: "8553549", keywords: [] },
  { ref: "8930406", keywords: [] },
  { ref: "8871776", keywords: [] },
  { ref: "8870065", keywords: ["NH100", "mid", "waterproof", "women", "boot"] },
  { ref: "8934985", keywords: ["NH500", "low", "women",  "boot"],    notKeywords: ["tank", "jacket", "trouser", "nh500 mid"] },
  { ref: "8969434", keywords: ["NH500", "low", "waterproof", "women", "boot"] },
  { ref: "8871375", keywords: [] },
  { ref: "8884466", keywords: ["NH500", "mid", "leather", "women",   "boot"] },

  // ---- MEN'S HIKING BOOTS ----
  // notKeywords: ["nh500"] prevents "NH50" regex matching "NH500" items
  { ref: "8844096", keywords: ["nh50", "men",  "boot"],              notKeywords: ["nh500", "women"] },
  { ref: "8780701", keywords: ["NH100", "mid",  "men",  "boot"],     notKeywords: ["women"] },
  // 8877180 was brand-mismatch by ref; try by name
  { ref: "8877180", keywords: ["NH100", "low",  "men",  "boot"],     notKeywords: ["women"] },
  { ref: "8894871", keywords: ["NH100", "mid",  "waterproof", "men", "boot"], notKeywords: ["women"] },
  { ref: "8931885", keywords: ["NH500", "low",  "men",  "boot"],     notKeywords: ["women", "tank", "jacket", "trouser", "waterproof"] },
  { ref: "8940976", keywords: ["arpenaz", "revival"] },
  { ref: "8930684", keywords: ["NH500", "low",  "waterproof", "men", "boot"], notKeywords: ["women"] },
  { ref: "8988718", keywords: ["NH500", "mid",  "leather", "waterproof", "men", "boot"], notKeywords: ["women"] },
  { ref: "8883913", keywords: ["NH500", "mid",  "leather", "men",  "boot"],   notKeywords: ["women", "waterproof"] },

  // ---- TREKKING BOOTS ----
  { ref: "8883388", keywords: ["MT100", "trekking", "boot", "men"], notKeywords: ["women", "spare", "lower"] },
  { ref: "8550247", keywords: [] },
  { ref: "8788855", keywords: ["MT500", "leather", "trekking", "boot"], notKeywords: ["women", "spare"] },

  // ---- MOUNTAIN BOOTS ----
  { ref: "8755055", keywords: ["MH100", "boot",  "men"],   notKeywords: ["women", "jacket"] },
  { ref: "8710204", keywords: ["MH100", "waterproof", "boot", "men"], notKeywords: ["women", "jacket"] },
  { ref: "8799992", keywords: ["MH100", "mid", "waterproof", "boot", "men"], notKeywords: ["women", "jacket"] },
  { ref: "8723811", keywords: ["MH500", "waterproof", "boot", "men"], notKeywords: ["women", "jacket"] },
  { ref: "8723616", keywords: ["MH500", "mid", "waterproof", "boot"], notKeywords: ["women", "jacket"] },

  // ---- HIKING BACKPACKS ----
  { ref: "8740470", keywords: ["MH100", "20",  "backpack"] },
  { ref: "8790270", keywords: ["MH100", "35",  "backpack"] },
  { ref: "8910354", keywords: ["MH500", "25",  "backpack"],  notKeywords: ["light"] },
  { ref: "8920390", keywords: ["MH500", "38",  "backpack"],  notKeywords: ["light"] },
  { ref: "8870393", keywords: ["MH500", "15",  "light",  "backpack"] },
  { ref: "8813394", keywords: ["MH500", "22",  "light",  "backpack"] },
  { ref: "8884020", keywords: ["FH500", "17"] },
  { ref: "8881199", keywords: ["MH900", "25",  "backpack"] },
  { ref: "8946339", keywords: ["MH900", "38",  "backpack"] },

  // ---- TREKKING BACKPACKS ----
  { ref: "8559800", keywords: ["MT100", "trekking", "50",  "men"],        notKeywords: ["women", "spare"] },
  { ref: "8731082", keywords: ["MT100", "trekking", "women"],             notKeywords: ["spare"] },
  { ref: "8978310", keywords: [] },
  { ref: "8898272", keywords: ["MT500", "trekking", "women",  "backpack"] },
  { ref: "8842899", keywords: ["MT900", "light",    "backpack", "men"],   notKeywords: ["women", "spare"] },
  { ref: "8842604", keywords: ["MT900", "light",    "backpack", "women"] },
  { ref: "8781983", keywords: ["MT800", "trekking", "men"],               notKeywords: ["women", "spare"] },
  { ref: "8732034", keywords: ["MT800", "trekking", "women"] },
  { ref: "8879319", keywords: ["MT800", "ultra",    "50",  "backpack"] },

  // ---- HIKING POLES ----
  { ref: "8807204", keywords: [] },
  { ref: "8905507", keywords: ["MT100", "comfort", "pole"],    notKeywords: ["spare", "segment", "part", "lower"] },
  { ref: "8807205", keywords: [] },
  { ref: "8870985", keywords: ["MT500", "ergonomic", "pole"],  notKeywords: ["spare", "segment", "part"] },
  { ref: "8840581", keywords: ["MT500", "pole"],               notKeywords: ["spare", "segment", "ring", "part", "tent", "antishock", "cork", "ergonomic"] },
  { ref: "8910014", keywords: ["MT500", "all season", "pole"], notKeywords: ["spare", "segment", "part"] },
  { ref: "8810080", keywords: ["MT500", "antishock", "pole"],  notKeywords: ["spare", "segment", "part"] },
  { ref: "8869228", keywords: ["MT500", "cork", "pole"],       notKeywords: ["spare", "segment", "part"] },
  { ref: "8810058", keywords: ["MT900", "trekking", "pole"],   notKeywords: ["spare", "segment", "section", "tent", "part"] },
  { ref: "8793383", keywords: ["sprint", "pole"],              notKeywords: ["spare", "segment", "repair", "lower", "part"] },

  // ---- TRAVEL BACKPACKS ----
  { ref: "8990286", keywords: ["travel", "500", "30",  "backpack"] },
  { ref: "8787845", keywords: [] },
  { ref: "8880000", keywords: ["travel", "900", "50",  "men's"],   notKeywords: ["women", "removable", "accessory"] },
  { ref: "8816394", keywords: ["travel", "900", "50",  "women"],   notKeywords: ["removable", "accessory"] },
  { ref: "8880014", keywords: ["travel", "900", "70",  "men"],     notKeywords: ["women", "removable", "accessory", "top"] },
  { ref: "8880010", keywords: ["travel", "900", "60",  "women"],   notKeywords: ["removable", "accessory"] },

  // ---- CAMP LIGHTS ----
  { ref: "8615283", keywords: [] },
  { ref: "8492468", keywords: [] },
  { ref: "8755548", keywords: [] },
  { ref: "8670110", keywords: [] },
  { ref: "8881742", keywords: [] },
  { ref: "8852787", keywords: [] },
  { ref: "8492469", keywords: [] },
  { ref: "8492095", keywords: ["BL400", "lamp"],    notKeywords: ["spare", "battery replacement"] },
  { ref: "8649378", keywords: [] },
  { ref: "8948415", keywords: [] },
  { ref: "8665145", keywords: [] },
  { ref: "8665147", keywords: [] },
  { ref: "8665150", keywords: [] },

  // ---- HEADLAMPS ----
  { ref: "8786370", keywords: ["HL50",  "headlamp"],           notKeywords: ["HL500", "spare", "battery"] },
  { ref: "8384891", keywords: ["onnight", "headlamp"],         notKeywords: ["spare", "battery"] },
  { ref: "8979230", keywords: ["HL900"],                       notKeywords: ["spare", "battery", "replacement"] },
  { ref: "8978237", keywords: [] },
  { ref: "8858783", keywords: ["sprint", "400", "headlamp"],   notKeywords: ["spare", "battery", "900"] },
  { ref: "8813317", keywords: ["sprint", "900", "headlamp"],   notKeywords: ["spare", "battery", "400"] },
  // Removed: 8787287 (lanyard collision), 8505882 (tennis cap), 8919550 (bike part),
  //          8501304/8501305 (Solognac hunting brand), 8877180 phase-1 brand-mismatch handled above
];

// ---------------------------------------------------------------------------
// Build a regex that requires ALL keywords to appear AND none of notKeywords.
// Escape everything except ° (not a regex metachar, safe to leave as-is).
// ---------------------------------------------------------------------------
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function buildKeywordRegex(keywords, notKeywords = []) {
  const pos = keywords.map((k)    => `(?=.*${esc(k)})`).join("");
  const neg = notKeywords.map((k) => `(?!.*${esc(k)})`).join("");
  // ^ anchors the lookaheads to the start of the string so negative terms
  // cannot be dodged by matching from a later character position.
  return new RegExp("^" + neg + pos, "i");
}

// ---------------------------------------------------------------------------
// Deduplicate a list of AffiliateProducts by merchantProductId.
// Prefer rows that have an image; return one per base product code.
// ---------------------------------------------------------------------------
function dedupByMerchantProductId(products) {
  const seen = new Map();
  for (const p of products) {
    const key = p.merchantProductId || p.externalProductId;
    if (!seen.has(key) || (!seen.get(key).imageUrl && p.imageUrl)) {
      seen.set(key, p);
    }
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("Missing MONGO_URI"); process.exit(1); }

  await mongoose.connect(uri, { dbName: "TrekList" });
  console.log(`Connected to DB: ${mongoose.connection.name}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Processing ${PRODUCTS.length} items...\n`);

  const results = {
    importedByRef:   [],
    importedByName:  [],
    alreadyExists:   [],
    notFound:        [],
    errors:          [],
  };

  for (const { ref, keywords, notKeywords = [] } of PRODUCTS) {
    try {
      // 0. Check already imported
      const existing = await CatalogItem.findOne({
        $or: [
          { "externalIds.sku": ref },
          { canonicalSku: ref },
          { modelNumber: ref },
        ],
      }).lean();

      if (existing) {
        results.alreadyExists.push({ ref, name: existing.name });
        console.log(`  [EXISTS]         ${ref}  →  "${existing.name}"`);
        continue;
      }

      // ------------------------------------------------------------------
      // PHASE 1: exact ref lookup
      // ------------------------------------------------------------------
      let product = null;
      let matchedBy = null;

      if (ref) {
        const byRef = await AffiliateProduct.find({
          network:           "awin",
          merchantId:        MERCHANT_ID,
          merchantProductId: ref,
          brand:             { $regex: /simond|forclaz|quechua|decathlon/i },
        }).sort({ updatedAt: -1 }).limit(50).lean();

        if (byRef.length) {
          const deduped = dedupByMerchantProductId(byRef);
          product   = deduped[0];
          matchedBy = "ref";
        }
      }

      // ------------------------------------------------------------------
      // PHASE 2: name/keyword fallback
      // ------------------------------------------------------------------
      if (!product && keywords.length > 0) {
        const regex = buildKeywordRegex(keywords, notKeywords);
        const byName = await AffiliateProduct.find({
          network:   "awin",
          merchantId: MERCHANT_ID,
          brand:     { $regex: /simond|forclaz|quechua|decathlon/i },
          name:      { $regex: regex },
        }).sort({ updatedAt: -1 }).limit(50).lean();

        if (byName.length) {
          const deduped = dedupByMerchantProductId(byName);
          product   = deduped[0];
          matchedBy = "name";
        }
      }

      if (!product) {
        results.notFound.push({ ref });
        console.log(`  [NOT FOUND]      ${ref}`);
        continue;
      }

      // Guard against two NL refs mapping to the same awin product (colour/size
      // variants collapsed to one representative above). If we already imported
      // this awin externalProductId under a previous ref, skip rather than error.
      const existingByAwin = await CatalogItem.findOne({
        "externalIds.sku": product.externalProductId,
      }).lean();
      if (existingByAwin) {
        results.alreadyExists.push({ ref, name: existingByAwin.name });
        console.log(`  [EXISTS-AWIN]    ${ref}  →  "${existingByAwin.name}" (same awin product)`);
        continue;
      }

      // ------------------------------------------------------------------
      // Log / import
      // ------------------------------------------------------------------
      const weightGrams = product.deliveryWeightKg
        ? Math.round(product.deliveryWeightKg * 1000)
        : undefined;

      const imageUrls = product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl ? [product.imageUrl] : [];

      const tag = matchedBy === "name" ? "[DRY-NAME]  " : "[DRY-REF]   ";
      const liveTag = matchedBy === "name" ? "[IMPORT-NAME]" : "[IMPORT-REF] ";

      if (DRY_RUN) {
        console.log(`  ${tag}    ${ref}  →  "${product.name}"  (${product.brand})  ${weightGrams ? weightGrams + "g" : "no weight"}  images:${imageUrls.length}`);
        (matchedBy === "name" ? results.importedByName : results.importedByRef)
          .push({ ref, name: product.name, brand: product.brand, weightGrams, matchedBy });
        continue;
      }

      // Create CatalogItem
      const catalogItem = await new CatalogItem({
        name:        product.name,
        brand:       product.brand || "Decathlon",
        description: product.description || undefined,
        imageUrls,
        weightGrams,
        modelNumber: product.modelNumber || undefined,
        itemGroupId: product.itemGroupId || undefined,
        externalIds: {
          ean: product.ean || undefined,
          sku: product.externalProductId,
        },
        canonicalSku: ref || undefined,
        createdBy:    CREATED_BY,
        isActive:     true,
      }).save();

      // Create MerchantOffer
      await MerchantOffer.findOneAndUpdate(
        {
          network:           "awin",
          region:            "uk",
          merchantId:        MERCHANT_ID,
          externalProductId: product.externalProductId,
        },
        {
          $set: {
            productId:    catalogItem._id,
            merchantName: product.merchantName || "Decathlon UK",
            deepLink:     product.awDeepLink,
            updatedAt:    new Date(),
          },
          $setOnInsert: {
            network:           "awin",
            region:            "uk",
            merchantId:        MERCHANT_ID,
            externalProductId: product.externalProductId,
            priority:          0,
          },
        },
        { upsert: true, new: true }
      );

      console.log(`  ${liveTag}  ${ref}  →  "${product.name}"  (${product.brand})`);
      (matchedBy === "name" ? results.importedByName : results.importedByRef)
        .push({ ref, name: product.name, brand: product.brand, weightGrams, matchedBy });

    } catch (err) {
      console.error(`  [ERROR]          ${ref}  →  ${err.message}`);
      results.errors.push({ ref, error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const totalImported = results.importedByRef.length + results.importedByName.length;
  console.log("\n" + "=".repeat(64));
  console.log(`SUMMARY (${DRY_RUN ? "DRY RUN" : "LIVE"})`);
  console.log("=".repeat(64));
  console.log(`  Matched by ref  (or would): ${results.importedByRef.length}`);
  console.log(`  Matched by name (or would): ${results.importedByName.length}`);
  console.log(`  Total to import:            ${totalImported}`);
  console.log(`  Already in DB (skipped):    ${results.alreadyExists.length}`);
  console.log(`  Not found in either phase:  ${results.notFound.length}`);
  console.log(`  Errors:                     ${results.errors.length}`);

  if (results.notFound.length) {
    console.log("\nNot found (not in UK awin feed):");
    results.notFound.forEach(({ ref }) => console.log(`    ${ref}`));
  }

  if (results.errors.length) {
    console.log("\nErrors:");
    results.errors.forEach(({ ref, error }) => console.log(`    ${ref}: ${error}`));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
