/**
 * ingest-decathlon-awin.js
 *
 * Downloads the full Decathlon UK product feed from Awin and upserts every
 * row into the AffiliateProduct collection. No CatalogItems or MerchantOffers
 * are created here — use the admin "Import from Decathlon" UI for that.
 *
 * Usage:
 *   node src/scripts/ingest-decathlon-awin.js [--limit N] [--dry-run]
 *
 * Env vars required:
 *   MONGO_URI                    MongoDB connection string
 *   AWIN_DECATHLON_FEED_URL      Download URL from Awin "Create-a-Feed"
 *   AWIN_DECATHLON_MERCHANT_ID   Awin advertiser ID for Decathlon UK
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { parse } = require("csv-parse");
const { Readable } = require("stream");
const zlib = require("zlib");

const AffiliateProduct = require("../models/affiliateProduct");

const FEED_URL   = process.env.AWIN_DECATHLON_FEED_URL || "";
const MERCHANT_ID  = process.env.AWIN_DECATHLON_MERCHANT_ID || "";
const MERCHANT_NAME = "Decathlon UK";
const NETWORK = "awin";
const REGION  = "GB";

const args = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT    = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------
async function downloadFeed(url) {
  console.log("Downloading feed...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed download failed: ${res.status} ${res.statusText}`);

  const isGzip = url.includes("/compression/gzip") ||
    (res.headers.get("content-encoding") || "") === "gzip";

  if (isGzip) {
    const buf = Buffer.from(await res.arrayBuffer());
    const text = zlib.gunzipSync(buf).toString("utf-8");
    console.log(`Downloaded and decompressed ${(text.length / 1024).toFixed(1)} KB`);
    return text;
  }

  const text = await res.text();
  console.log(`Downloaded ${(text.length / 1024).toFixed(1)} KB`);
  return text;
}

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------
async function parseCsv(text) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from([text])
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Row normalisation
// ---------------------------------------------------------------------------
function parseRow(raw) {
  const merchantProductIdFull = String(raw["merchant_product_id"] || raw["merchant_product_id_u1"] || "").trim();
  // Base product code is the part before the first dash: "8852999-5075752" → "8852999"
  const merchantProductId = merchantProductIdFull.split("-")[0] || merchantProductIdFull;

  const weightKg = parseFloat(raw["delivery_weight"] || "");

  return {
    externalProductId: String(raw["aw_product_id"] || "").trim(),
    merchantProductId,
    name:        String(raw["product_name"]       || "").trim(),
    brand:       String(raw["brand_name"]          || raw["brand"] || "Decathlon").trim(),
    description: String(raw["description"]         || "").trim(),
    awDeepLink:  String(raw["aw_deep_link"]        || "").trim(),
    imageUrl:    String(raw["merchant_image_url"]  || raw["aw_image_url"] || "").trim(),
    imageUrls:   [
      raw["merchant_image_url"],
      raw["aw_image_url"],
      raw["alternate_image"],
      raw["alternate_image_two"],
      raw["alternate_image_three"],
      raw["alternate_image_four"],
    ].map(u => String(u || "").trim()).filter(Boolean).filter((u, i, a) => a.indexOf(u) === i),
    merchantCategory: String(raw["merchant_category"] || raw["category_name"] || "").trim(),
    modelNumber: String(raw["model_number"]        || "").trim(),
    colour:      String(raw["colour"]              || "").trim(),
    ean:         String(raw["ean"]                 || "").trim(),
    sku:         merchantProductIdFull,
    itemGroupId: String(raw["parent_product_id"]   || raw["item_group_id"] || "").trim(),
    price:       parseFloat(raw["search_price"]    || raw["store_price"] || "0") || undefined,
    deliveryWeightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : undefined,
    inStock:     String(raw["in_stock"]            || "1"),
  };
}

function isValid(row) {
  return Boolean(row.externalProductId && row.awDeepLink && row.name);
}

function isInStock(row) {
  return row.inStock !== "no" && row.inStock !== "0" && row.inStock !== "false";
}

// ---------------------------------------------------------------------------
// Upsert into AffiliateProduct
// ---------------------------------------------------------------------------
async function upsertProduct(row) {
  const setData = {
    merchantName:     MERCHANT_NAME,
    merchantProductId: row.merchantProductId || undefined,
    name:             row.name,
    brand:            row.brand,
    description:      row.description || undefined,
    awDeepLink:       row.awDeepLink,
    imageUrl:         row.imageUrl || undefined,
    imageUrls:        row.imageUrls.length ? row.imageUrls : undefined,
    merchantCategory: row.merchantCategory || undefined,
    modelNumber:      row.modelNumber || undefined,
    colour:           row.colour || undefined,
    ean:              row.ean || undefined,
    sku:              row.sku || undefined,
    itemGroupId:      row.itemGroupId || undefined,
    price:            row.price,
    deliveryWeightKg: row.deliveryWeightKg,
    updatedAt:        new Date(),
  };

  // Remove undefined fields
  for (const [k, v] of Object.entries(setData)) {
    if (v === undefined) delete setData[k];
  }

  await AffiliateProduct.findOneAndUpdate(
    { network: NETWORK, region: REGION, merchantId: MERCHANT_ID, externalProductId: row.externalProductId },
    {
      $set: setData,
      $setOnInsert: { network: NETWORK, region: REGION, merchantId: MERCHANT_ID, externalProductId: row.externalProductId },
    },
    { upsert: true, new: true }
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!FEED_URL)    { console.error("Error: AWIN_DECATHLON_FEED_URL is not set");   process.exit(1); }
  if (!MERCHANT_ID) { console.error("Error: AWIN_DECATHLON_MERCHANT_ID is not set"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  console.log("Connected to MongoDB");

  const csv     = await downloadFeed(FEED_URL);
  const rawRows = await parseCsv(csv);
  console.log(`Parsed ${rawRows.length} rows`);

  const rows = rawRows.map(parseRow).filter(isValid).filter(isInStock).slice(0, LIMIT);
  console.log(`Processing ${rows.length} valid in-stock rows${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);

  if (DRY_RUN) {
    console.log("\nSample row:");
    console.log(JSON.stringify(rows[0], null, 2));
    await mongoose.disconnect();
    return;
  }

  let upserted = 0;
  let errors   = 0;

  for (const row of rows) {
    try {
      await upsertProduct(row);
      upserted++;
      if (upserted % 1000 === 0) console.log(`  ${upserted} / ${rows.length}...`);
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`  Error [${row.externalProductId}]: ${err.message}`);
    }
  }

  console.log(`\nDone. Upserted: ${upserted}, errors: ${errors}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
