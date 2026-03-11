// server/src/routes/adminAmazon.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const AmazonSnapshot = require("../models/amazonSnapshot");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const {
  creatorsGetItems,
  parseCreatorsItem,
  getPartnerTagForMarketplace,
  buildAmazonAffiliateUrl,
} = require("../services/amazonCreatorsApi");
const { rewriteDescription } = require("../services/anthropicService");
const { detectItemType } = require("../services/itemTypeDetector");

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

    // Check for existing catalog items with this ASIN
    const existingItems = await CatalogItem.find(
      { canonicalAsin: asin },
      { name: 1, canonicalAsin: 1 }
    ).lean();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Partner tag for this marketplace (US/UK/DE/etc)
    const partnerTag = getPartnerTagForMarketplace(marketplace) || null;

    // Helper so your merchantOffer unique index stays consistent
    const merchantId = `amazon-${marketplace}`;

    // --- MOCK MODE ---
    if (process.env.AMAZON_CREATORS_MOCK === "1") {
      const deepLink = buildAmazonAffiliateUrl({
        asin,
        marketplace,
        partnerTag, // may be null in mock; buildAmazonAffiliateUrl should handle
      });

      const mockFeatures = [
        "Ultralight backpacking tent weighing 2 lbs 1 oz",
        "Freestanding design with DAC Featherlite poles",
        "Two doors and two vestibules for easy access",
      ];
      const mockDetection = detectItemType("Mock Amazon Title", mockFeatures);

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
        features: mockFeatures,
        fetchedAt: now,
        expiresAt,
      };

      await AmazonSnapshot.findOneAndUpdate(
        { asin, marketplace },
        { $set: snapshotDoc },
        { upsert: true, new: true }
      );

      // Upsert MerchantOffer (even in mock mode)
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
        existingItems,
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
          description: "A lightweight mock product for development testing.",
          modelNumber: snapshotDoc.modelNumber,
          weightGrams: snapshotDoc.weightGrams,
          dimensions: snapshotDoc.dimensions,
          imageUrls: snapshotDoc.imageUrls,
          canonicalAsin: asin,
          externalIds: { asin },
          suggestedCategory: mockDetection?.category || null,
          suggestedItemType: mockDetection?.itemType || null,
          detectionConfidence: mockDetection?.confidence || null,
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

    // --- LIVE CREATORS API MODE ---
    try {
      // In live mode: partnerTag MUST exist
      if (!partnerTag) {
        return res.status(400).json({
          message: `Missing partner tag for marketplace "${marketplace}". Set AMAZON_PARTNER_TAG_${marketplace.toUpperCase()} in env.`,
        });
      }

      const json = await creatorsGetItems({
        asin,
        marketplace,
        partnerTag,
      });

      const parsed = parseCreatorsItem(json);
      if (!parsed) {
        return res
          .status(404)
          .json({ message: "ASIN not found via Amazon Creators API." });
      }

      // Always return a tagged link we control
      const deepLink = buildAmazonAffiliateUrl({
        asin,
        marketplace,
        partnerTag,
      });

      // AI description rewrite (non-blocking — falls back to bullet-join)
      const rewrittenDescription = await rewriteDescription(
        parsed.title,
        parsed.brand,
        parsed.features
      );

      // Auto-detect category + itemType from title & features
      const detection = detectItemType(parsed.title, parsed.features);

      // Persist snapshot for debugging + cache semantics
      const snapshotDoc = {
        asin,
        marketplace,
        amazonCategoryHint: undefined,
        title: parsed.title,
        brand: parsed.brand,
        description: parsed.description,
        modelNumber: parsed.modelNumber,
        weightGrams: parsed.weightGrams || undefined,
        dimensions: undefined,
        imageUrls: parsed.imageUrls || [],
        features: parsed.features || [],
        fetchedAt: now,
        expiresAt,
      };

      await AmazonSnapshot.findOneAndUpdate(
        { asin, marketplace },
        { $set: snapshotDoc },
        { upsert: true, new: true }
      );

      // Upsert MerchantOffer (live)
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
        existingItems,
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
          name: parsed.cleanTitle || parsed.title,
          brand: parsed.brand,
          description: rewrittenDescription || parsed.description,
          modelNumber: parsed.modelNumber,
          weightGrams: parsed.weightGrams || undefined,
          dimensions: undefined,
          imageUrls: parsed.imageUrls || [],
          canonicalAsin: asin,
          externalIds: { asin },
          suggestedCategory: detection?.category || null,
          suggestedItemType: detection?.itemType || null,
          detectionConfidence: detection?.confidence || null,
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
      console.error("Creators API lookup failed:", err);
      return res.status(500).json({
        message: err?.message || "Amazon lookup failed.",
      });
    }
  }
);

module.exports = router;
