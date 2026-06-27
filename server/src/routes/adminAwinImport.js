/**
 * Admin routes for browsing and importing Awin affiliate products.
 *
 * GET  /api/admin/awin/search?q=&code=&merchantId=&limit=
 * POST /api/admin/awin/import  { externalProductId | merchantProductId, merchantId }
 */

const express = require("express");
const mongoose = require("mongoose");
const { query, body, validationResult } = require("express-validator");

const AffiliateProduct = require("../models/affiliateProduct");
const CatalogItem      = require("../models/catalogItem");
const MerchantOffer    = require("../models/merchantOffer");
const { inferItemType } = require("../config/inferItemType");

const router = express.Router();

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// GET /api/admin/awin/search
// Search the AffiliateProduct index.
// ?code=8852999   — exact base product code (from Decathlon URL)
// ?q=mh500        — fuzzy name/brand search
// ?merchantId=    — filter by Awin advertiser (defaults to Decathlon UK)
// ---------------------------------------------------------------------------
router.get(
  "/search",
  [
    query("q").optional().isString().trim(),
    query("code").optional().isString().trim(),
    query("merchantId").optional().isString().trim(),
    query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });

    const {
      q = "",
      code = "",
      merchantId = process.env.AWIN_DECATHLON_MERCHANT_ID,
      limit = 20,
    } = req.query;

    if (!q.trim() && !code.trim()) {
      return res.status(400).json({ message: "Provide q or code." });
    }

    try {
      const filter = { network: "awin" };
      if (merchantId) filter.merchantId = String(merchantId);

      if (code.trim()) {
        // Exact match on base product code
        filter.merchantProductId = code.trim();
      } else {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        filter.$or = [{ name: rx }, { brand: rx }];
      }

      // When searching by code, we get all colour/size variants — deduplicate
      // by merchantProductId and return one representative row per base product.
      const raw = await AffiliateProduct.find(filter)
        .sort({ updatedAt: -1 })
        .limit(code.trim() ? 200 : Number(limit))
        .lean();

      let results = raw;

      if (code.trim()) {
        // One representative row per merchantProductId (prefer rows with an image)
        const seen = new Map();
        for (const p of raw) {
          const key = p.merchantProductId || p.externalProductId;
          if (!seen.has(key) || (!seen.get(key).imageUrl && p.imageUrl)) {
            seen.set(key, p);
          }
        }
        results = Array.from(seen.values()).slice(0, Number(limit));
      }

      // Annotate each result: is it already in the catalog?
      const productIds = results.map((r) => r.externalProductId);
      const existing = await CatalogItem.find({
        "externalIds.sku": { $in: productIds },
      }).select("externalIds.sku").lean();
      const importedSet = new Set(existing.map((c) => c.externalIds?.sku));

      res.json(
        results.map((p) => ({
          _id:               p._id,
          externalProductId: p.externalProductId,
          merchantProductId: p.merchantProductId,
          name:              p.name,
          brand:             p.brand,
          merchantCategory:  p.merchantCategory,
          colour:            p.colour,
          imageUrl:          p.imageUrl || p.imageUrls?.[0],
          price:             p.price,
          deliveryWeightKg:  p.deliveryWeightKg,
          awDeepLink:        p.awDeepLink,
          alreadyImported:   importedSet.has(p.externalProductId),
        }))
      );
    } catch (err) {
      console.error("GET /admin/awin/search error:", err);
      res.status(500).json({ message: "Server error." });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/admin/awin/import
// Promote an AffiliateProduct to a CatalogItem + MerchantOffer.
// Body: { externalProductId, merchantId? }
// ---------------------------------------------------------------------------
router.post(
  "/import",
  [
    body("externalProductId").isString().trim().notEmpty(),
    body("merchantId").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });

    const {
      externalProductId,
      merchantId = process.env.AWIN_DECATHLON_MERCHANT_ID,
    } = req.body;

    try {
      const productFilter = { network: "awin", externalProductId };
      if (merchantId) productFilter.merchantId = String(merchantId);
      const product = await AffiliateProduct.findOne(productFilter).lean();

      if (!product) {
        return res.status(404).json({ message: "Product not found in affiliate index." });
      }

      // Check if already imported (match by externalProductId stored as sku)
      const existing = await CatalogItem.findOne({ "externalIds.sku": externalProductId }).lean();
      if (existing) {
        return res.status(409).json({
          message: "Already imported.",
          catalogItemId: existing._id,
        });
      }

      const weightGrams = product.deliveryWeightKg
        ? Math.round(product.deliveryWeightKg * 1000)
        : undefined;

      // Map the feed product onto the schema taxonomy (name-based; Decathlon's
      // merchant_category is marketing buckets, not a taxonomy). Null when not
      // confident — leaves the item uncategorized rather than mis-typed.
      const itemType =
        inferItemType(product.name, product.merchantCategory) || undefined;

      // Create CatalogItem. lenientAttributes lets a correct itemType be set even
      // though feed imports can't supply all required attributes yet.
      const catalogItem = new CatalogItem({
        name:        product.name,
        brand:       product.brand || "Decathlon",
        description: product.description || undefined,
        imageUrls:   product.imageUrls?.length ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        weightGrams,
        itemType,
        modelNumber: product.modelNumber || undefined,
        itemGroupId: product.itemGroupId || undefined,
        externalIds: {
          ean: product.ean || undefined,
          sku: externalProductId,
        },
        createdBy: req.userId,
        isActive:  true,
      });
      catalogItem.$locals.lenientAttributes = true;
      await catalogItem.save();

      // Create MerchantOffer linked to the new CatalogItem
      await MerchantOffer.findOneAndUpdate(
        {
          network:           "awin",
          region:            "uk",
          merchantId:        String(merchantId),
          externalProductId,
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
            merchantId:        String(merchantId),
            externalProductId,
            priority:          0,
          },
        },
        { upsert: true, new: true }
      );

      const offer = await MerchantOffer.findOne({ productId: catalogItem._id }).lean();

      res.status(201).json({
        message:     "Imported successfully.",
        catalogItem: { ...catalogItem.toObject(), offers: offer ? [offer] : [] },
      });
    } catch (err) {
      console.error("POST /admin/awin/import error:", err);
      res.status(500).json({ message: "Server error." });
    }
  }
);

module.exports = router;
