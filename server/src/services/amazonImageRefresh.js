// server/src/services/amazonImageRefresh.js
//
// Daily cron job to refresh Amazon image URLs on CatalogItems.
// Amazon ToS requires image links to be refreshed within 24 hours.

const cron = require("node-cron");
const CatalogItem = require("../models/catalogItem");
const {
  creatorsGetItems,
  extractAllImageUrls,
  getPartnerTagForMarketplace,
} = require("./amazonCreatorsApi");

const BATCH_SIZE = 10; // Max ASINs per Creators API call
const RATE_LIMIT_MS = 1100; // ~1 req/sec with buffer
const DEFAULT_MARKETPLACE = "us";

// Pattern matching Amazon-hosted image domains
const AMAZON_IMAGE_RE = /amazon\.com|ssl-images-amazon|m\.media-amazon/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAmazonImages() {
  console.log("[AmazonImageRefresh] Starting daily image refresh...");

  // Find active CatalogItems with a canonicalAsin that have Amazon-hosted images
  const items = await CatalogItem.find({
    canonicalAsin: { $exists: true, $ne: null, $ne: "" },
    imageUrls: { $elemMatch: { $regex: AMAZON_IMAGE_RE } },
    isActive: true,
  }).select("_id canonicalAsin imageUrls");

  if (!items.length) {
    console.log("[AmazonImageRefresh] No items with Amazon images found.");
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(
    `[AmazonImageRefresh] Found ${items.length} items to refresh.`
  );

  // Group items by ASIN (multiple CatalogItems could share an ASIN)
  const asinToItems = new Map();
  for (const item of items) {
    const asin = String(item.canonicalAsin).trim().toUpperCase();
    if (!asin) continue;
    if (!asinToItems.has(asin)) asinToItems.set(asin, []);
    asinToItems.get(asin).push(item);
  }

  const allAsins = [...asinToItems.keys()];
  let successCount = 0;
  let failCount = 0;

  const partnerTag = getPartnerTagForMarketplace(DEFAULT_MARKETPLACE);
  if (!partnerTag) {
    console.error(
      "[AmazonImageRefresh] Missing partner tag for US marketplace. Aborting."
    );
    return { success: 0, failed: allAsins.length, total: allAsins.length };
  }

  // Process in batches of 10
  for (let i = 0; i < allAsins.length; i += BATCH_SIZE) {
    const batch = allAsins.slice(i, i + BATCH_SIZE);

    try {
      const json = await creatorsGetItems({
        asins: batch,
        marketplace: DEFAULT_MARKETPLACE,
        partnerTag,
        resources: [
          "images.primary.large",
          "images.primary.medium",
          "images.variants.large",
          "images.variants.medium",
        ],
      });

      // Parse each item in the batch response
      const apiItems =
        json?.itemsResult?.items || json?.ItemsResult?.Items || [];

      for (const apiItem of apiItems) {
        const asin =
          apiItem?.asin?.toUpperCase() || apiItem?.ASIN?.toUpperCase();
        if (!asin || !asinToItems.has(asin)) continue;

        const freshImageUrls = extractAllImageUrls(apiItem);
        if (!freshImageUrls.length) continue;

        // Update each CatalogItem that uses this ASIN
        for (const catalogItem of asinToItems.get(asin)) {
          // Keep non-Amazon URLs (Cloudinary, etc), replace Amazon ones
          const nonAmazonUrls = (catalogItem.imageUrls || []).filter(
            (url) => !AMAZON_IMAGE_RE.test(url)
          );
          const newImageUrls = [...freshImageUrls, ...nonAmazonUrls];

          await CatalogItem.updateOne(
            { _id: catalogItem._id },
            { $set: { imageUrls: newImageUrls } }
          );
          successCount++;
        }
      }
    } catch (err) {
      console.error(
        `[AmazonImageRefresh] Batch failed for ASINs ${batch.join(",")}: ${err.message}`
      );
      failCount += batch.length;
      // Keep existing URLs on failure — retry next day
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < allAsins.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(
    `[AmazonImageRefresh] Complete. Items updated: ${successCount}, ASINs failed: ${failCount}`
  );
  return { success: successCount, failed: failCount, total: items.length };
}

function startImageRefreshCron() {
  // Run daily at 3:00 AM UTC
  cron.schedule("0 3 * * *", () => {
    refreshAmazonImages().catch((err) => {
      console.error("[AmazonImageRefresh] Cron job failed:", err);
    });
  });
  console.log("[AmazonImageRefresh] Cron scheduled: daily at 03:00 UTC");
}

module.exports = { startImageRefreshCron, refreshAmazonImages };
