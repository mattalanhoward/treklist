// server/src/routes/adminAmazon.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const AmazonSnapshot = require("../models/amazonSnapshot");
const MerchantOffer = require("../models/merchantOffer");

const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const {
  paapiGetItems,
  parsePaapiItem,
  getPartnerTagForMarketplace,
  buildAmazonAffiliateUrl,
} = require("../services/amazonPaapi");

const router = express.Router();

const ASIN_RE = /^[A-Z0-9]{10}$/;
const ALLOWED_MARKETPLACES = new Set([
  "us",
  "uk",
  "de",
  "fr",
  "it",
  "es",
  "nl",
  "ca",
  "se",
  "pl",
]);
const ALLOWED_REGIONS = new Set(["global", "us", "uk", "de", "eu", "ca"]);

router.use(auth, requireAdmin);

router.post(
  "/lookup",
  [
    body("asin")
      .isString()
      .trim()
      .custom((v) => ASIN_RE.test(String(v).toUpperCase())),
    body("marketplace").optional().isString().trim().toLowerCase(),
    body("region").optional().isString().trim().toLowerCase(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Invalid request", errors: errors.array() });
    }

    const asin = String(req.body.asin).trim().toUpperCase();
    const marketplace = String(req.body.marketplace || "us")
      .trim()
      .toLowerCase();
    const region = String(req.body.region || "global")
      .trim()
      .toLowerCase();

    if (!ALLOWED_MARKETPLACES.has(marketplace)) {
      return res.status(400).json({ message: "Invalid marketplace" });
    }
    if (!ALLOWED_REGIONS.has(region)) {
      return res.status(400).json({ message: "Invalid region" });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Partner tag for this marketplace (US/UK/DE/etc)
    const partnerTag = getPartnerTagForMarketplace(marketplace) || null;

    // Helper so your merchantOffer unique index stays consistent
    const merchantId = `amazon-${marketplace}`;

    // --- MOCK MODE ---
    if (process.env.AMAZON_PAAPI_MOCK === "1") {
      const deepLink = buildAmazonAffiliateUrl({
        asin,
        marketplace,
        partnerTag, // may be null in mock; buildAmazonAffiliateUrl should handle
      });

      const snapshotDoc = {
        asin,
        marketplace,
        amazonCategoryHint: "Mock Amazon Category",
        title: "Mock Amazon Title",
        brand: "Mock Brand",
        description: "Mock Amazon description (rewrite this).",
        modelNumber: "MODEL-123",
        weightGrams: 1400,
        dimensions: { length: 0, width: 0, height: 0, unit: "cm" },
        imageUrls: ["https://example.com/mock-image.jpg"],
        fetchedAt: now,
        expiresAt,
      };

      await AmazonSnapshot.findOneAndUpdate(
        { asin, marketplace },
        { $set: snapshotDoc },
        { upsert: true, new: true }
      );

      // ✅ Upsert MerchantOffer (even in mock mode)
      await MerchantOffer.findOneAndUpdate(
        {
          network: "amazon",
          region,
          merchantId,
          externalProductId: asin,
        },
        {
          $set: {
            merchantName: "Amazon",
            deepLink,
          },
        },
        { upsert: true, new: true }
      );

      return res.json({
        asin,
        marketplace,
        region,
        snapshot: {
          fetchedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          amazonCategoryHint: snapshotDoc.amazonCategoryHint,
          title: snapshotDoc.title,
          brand: snapshotDoc.brand,
          description: snapshotDoc.description,
          modelNumber: snapshotDoc.modelNumber,
          weightGrams: snapshotDoc.weightGrams,
          dimensions: snapshotDoc.dimensions,
          imageUrls: snapshotDoc.imageUrls,
        },
        prefill: {
          name: snapshotDoc.title,
          brand: snapshotDoc.brand,
          description: snapshotDoc.description,
          modelNumber: snapshotDoc.modelNumber,
          weightGrams: snapshotDoc.weightGrams,
          dimensions: snapshotDoc.dimensions,
          imageUrls: snapshotDoc.imageUrls,
          canonicalAsin: asin,
          externalIds: { asin },
        },
        offer: {
          network: "amazon",
          region,
          merchantId,
          merchantName: "Amazon",
          externalProductId: asin,
          deepLink,
        },
      });
    }

    // --- LIVE PA-API MODE ---
    try {
      // In live mode: partnerTag MUST exist
      if (!partnerTag) {
        return res.status(400).json({
          message: `Missing partner tag for marketplace "${marketplace}". Set AMAZON_PARTNER_TAG_${marketplace.toUpperCase()} in env.`,
        });
      }

      const resources = [
        "ItemInfo.Title",
        "ItemInfo.ByLineInfo",
        "ItemInfo.Features",
        "ItemInfo.ManufactureInfo",
        "ItemInfo.ProductInfo",
        "Images.Primary.Large",
        "Images.Primary.Medium",
      ];

      const json = await paapiGetItems({
        asin,
        marketplace,
        partnerTag,
        resources,
      });

      const parsed = parsePaapiItem(json);
      if (!parsed) {
        return res.status(404).json({ message: "ASIN not found in PA-API." });
      }

      // Always return a tagged link we control
      const deepLink = buildAmazonAffiliateUrl({
        asin,
        marketplace,
        partnerTag,
      });

      // Persist snapshot for debugging + cache semantics
      const snapshotDoc = {
        asin,
        marketplace,
        amazonCategoryHint: undefined,
        title: parsed.title,
        brand: parsed.brand,
        description: parsed.description,
        modelNumber: parsed.modelNumber,
        weightGrams: undefined,
        dimensions: undefined,
        imageUrls: parsed.imageUrls || [],
        fetchedAt: now,
        expiresAt,
      };

      await AmazonSnapshot.findOneAndUpdate(
        { asin, marketplace },
        { $set: snapshotDoc },
        { upsert: true, new: true }
      );

      // ✅ Upsert MerchantOffer (live)
      const offerUpdate = {
        merchantName: "Amazon",
        deepLink,
      };

      await MerchantOffer.findOneAndUpdate(
        {
          network: "amazon",
          region,
          merchantId,
          externalProductId: asin,
        },
        { $set: offerUpdate },
        { upsert: true, new: true }
      );

      return res.json({
        asin,
        marketplace,
        region,
        snapshot: {
          fetchedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          amazonCategoryHint: snapshotDoc.amazonCategoryHint,
          title: snapshotDoc.title,
          brand: snapshotDoc.brand,
          description: snapshotDoc.description,
          modelNumber: snapshotDoc.modelNumber,
          weightGrams: snapshotDoc.weightGrams,
          dimensions: snapshotDoc.dimensions,
          imageUrls: snapshotDoc.imageUrls,
        },
        prefill: {
          name: parsed.title,
          brand: parsed.brand,
          description: parsed.description,
          modelNumber: parsed.modelNumber,
          weightGrams: undefined,
          dimensions: undefined,
          imageUrls: parsed.imageUrls || [],
          canonicalAsin: asin,
          externalIds: { asin },
        },
        offer: {
          network: "amazon",
          region,
          merchantId,
          merchantName: "Amazon",
          externalProductId: asin,
          deepLink,
        },
      });
    } catch (err) {
      console.error("PA-API lookup failed:", err);
      return res.status(500).json({
        message: err?.message || "PA-API lookup failed.",
      });
    }
  }
);

module.exports = router;
