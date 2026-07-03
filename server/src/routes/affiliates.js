// server/src/routes/affiliates.js
const express = require("express");
const { query, validationResult } = require("express-validator");
const AffiliateProduct = require("../models/affiliateProduct");
const GlobalItem = require("../models/globalItem");
const MerchantOffer = require("../models/merchantOffer");
const CatalogItem = require("../models/catalogItem");
const { searchLimiter, resolveLimiter } = require("../middleware/rateLimiters");
const { buildRegionPreferenceChain } = require("../utils/regionPrefs");

// Note: auth is enforced at mount-level in app.js (/api/affiliates)

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";

// --- Simple in-memory TTL cache for resolve-link (no extra deps)
// Key: `${key}|${region}` where key is productId or group id
const RESOLVE_CACHE = new Map();
const MAX_CACHE_ENTRIES = 1000;
const TTL_EXACT_MS = 6 * 60 * 60 * 1000; // 6h
const TTL_FALLBACK_MS = 15 * 60 * 1000; // 15m

function cacheGet(key) {
  const e = RESOLVE_CACHE.get(key);
  if (!e) return null;
  if (e.exp <= Date.now()) {
    RESOLVE_CACHE.delete(key);
    return null;
  }
  return e.val;
}
function cacheSet(key, val, ttlMs) {
  if (RESOLVE_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = RESOLVE_CACHE.keys().next().value;
    if (firstKey) RESOLVE_CACHE.delete(firstKey);
  }
  RESOLVE_CACHE.set(key, { val, exp: Date.now() + ttlMs });
}

// Small helpers
function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBrandKey(brand) {
  return String(brand || "")
    .toLowerCase()
    .trim();
}


/**
 * GET /api/affiliates/awin/facets
 */
router.get(
  "/awin/facets",
  [
    query("region").isString().isLength({ min: 2, max: 2 }).trim(),
    query("merchantId").optional().isString().trim(),
    query("q").optional().isString().trim(),
    query("brand").optional().isString().trim(),
    query("itemType").optional().isString().trim(),
    query("limit").optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: { code: "BAD_QUERY", details: errors.array() } });
    }

    try {
      let {
        region,
        merchantId,
        q = "",
        brand = "",
        itemType = "",
        limit = 50,
      } = req.query;

      region = String(region).toUpperCase();

      const match = { network: "awin", region };
      if (merchantId) match.merchantId = Number(merchantId);
      if (brand) match.brandLC = normalizeBrandKey(brand);
      if (itemType) match.itemType = String(itemType).trim();

      if (q && q.trim()) {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        match.$or = [{ name: rx }, { description: rx }];
      }

      const [agg] = await AffiliateProduct.aggregate([
        { $match: match },
        {
          $facet: {
            brands: [
              { $match: { brandLC: { $type: "string", $ne: "" } } },
              {
                $group: {
                  _id: "$brandLC",
                  proper: { $first: "$brand" },
                  count: { $sum: 1 },
                },
              },
              { $project: { _id: 0, key: "$_id", value: "$proper", count: 1 } },
              { $sort: { count: -1, value: 1 } },
              { $limit: Number(limit) },
            ],
            itemTypes: [
              { $match: { itemType: { $type: "string", $ne: "" } } },
              { $group: { _id: "$itemType", count: { $sum: 1 } } },
              { $project: { _id: 0, value: "$_id", count: 1 } },
              { $sort: { count: -1, value: 1 } },
              { $limit: Number(limit) },
            ],
          },
        },
      ]).option({ allowDiskUse: true });

      res.json({
        brands: agg?.brands || [],
        itemTypes: agg?.itemTypes || [],
      });
    } catch (err) {
      console.error("affiliates/facets error:", err);
      res.status(500).json({ message: "Server error." });
    }
  }
);

/**
 * GET /api/affiliates/awin/products
 */
router.get(
  "/awin/products",
  searchLimiter,
  [
    query("region").isString().isLength({ min: 2, max: 2 }).trim(),
    query("merchantId").optional().isString().trim(),
    query("brand").optional().isString().trim(),
    query("itemType").optional().isString().trim(),
    query("category").optional().isString().trim(),
    query("q").optional().isString().trim(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
    query("sort").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: { code: "BAD_QUERY", details: errors.array() } });
    }

    try {
      let {
        region,
        merchantId,
        brand = "",
        itemType = "",
        category = "",
        q = "",
        page = 1,
        limit = 24,
        sort = q ? "relevance" : "-updated",
      } = req.query;

      region = String(region).toUpperCase();

      const pageNum = Math.max(1, parseInt(page, 10));
      const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * pageSize;

      const filter = { network: "awin", region };
      const and = [];

      if (merchantId) filter.merchantId = Number(merchantId);

      if (brand) filter.brandLC = normalizeBrandKey(brand);
      if (itemType) filter.itemType = String(itemType).trim();

      if (category) {
        and.push({ categoryPath: new RegExp(escapeRegex(category), "i") });
      }

      if (q && q.trim()) {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        and.push({ $or: [{ name: rx }, { description: rx }] });
      }

      if (and.length) filter.$and = and;

      const sortSpec = {};
      if (sort === "-updated" || sort === "relevance") sortSpec.updatedAt = -1;
      else sortSpec.updatedAt = -1;

      const total = await AffiliateProduct.countDocuments(filter);
      const items = await AffiliateProduct.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(pageSize)
        .lean();

      return res.json({
        items,
        page: pageNum,
        total,
        hasMore: skip + items.length < total,
      });
    } catch (err) {
      console.error("affiliates/products error:", err);
      res.status(500).json({ message: "Server error." });
    }
  }
);

/**
 * Shared handler: resolve "best offer" across ALL MerchantOffer networks.
 *
 * Query:
 *  - globalItemId=<id>&region=US (preferred)
 *  - OR itemGroupId=<group>&region=US (legacy fallback)
 *
 * Returns:
 *  { link, region, network, merchantId, merchantName, priority, source }
 */
async function resolveBestOfferLink(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ error: { code: "BAD_QUERY", details: errors.array() } });
  }

  try {
    let { region, globalItemId, itemGroupId } = req.query;

    const offerChain = buildRegionPreferenceChain(region);
    let group = itemGroupId ? String(itemGroupId) : null;
    let productId = null;
    let originalLink = null; // custom items only
    let variantKey = null; // which catalog variant the user owns (routes the buy-link)

    if (globalItemId) {
      const gi = await GlobalItem.findOne({
        _id: globalItemId,
        owner: req.userId,
      }).lean();

      if (!gi) {
        return res.status(404).json({ message: "Global item not found." });
      }

      productId = gi.productId ? String(gi.productId) : null;
      variantKey = gi.variantKey || null;

      // Only custom items should rely on link as a fallback
      originalLink = gi.link ? String(gi.link) : null;

      // Legacy affiliate fallback identifiers (older globalitems)
      group =
        group ||
        (gi?.affiliate?.itemGroupId
          ? String(gi.affiliate.itemGroupId)
          : null) ||
        (gi?.affiliate?.externalProductId
          ? String(gi.affiliate.externalProductId)
          : null);
    }

    // If it's a custom item, it may only have originalLink (no productId/group)
    if (!productId && !group && !originalLink) {
      return res.status(404).json({ message: "No link available." });
    }

    // Cache key must never be null; for custom-only items use the globalItemId
    const key = productId || group || `gi:${globalItemId}`;
    const cacheKey = `${key}|${offerChain[0]}|${variantKey || ""}`;

    // DEV: do NOT cache, or priority updates will look "broken"
    if (isProd) {
      const cached = cacheGet(cacheKey);
      if (cached) return res.json(cached);
    }

    let best = null;

    // 1) Catalog-backed: resolve offers by productId (preferred)
    if (productId) {
      best = await MerchantOffer.findOne({
        productId,
        region: { $in: offerChain },
      })
        .sort({ priority: -1, updatedAt: -1 })
        .lean();
    }

    // 2) Legacy fallback: resolve by itemGroupId/externalProductId
    if (!best && group) {
      best = await MerchantOffer.findOne({
        region: { $in: offerChain },
        $or: [{ itemGroupId: group }, { externalProductId: group }],
      })
        .sort({ priority: -1, updatedAt: -1 })
        .lean();
    }

    // The offer supplies network/merchant metadata; if the owned item is a specific
    // variant that carries its own buy-link, route to THAT (not the placeholder).
    let variantLink = null;
    if (productId && variantKey) {
      const cat = await CatalogItem.findById(productId).select("variants").lean();
      const v = (cat?.variants || []).find((x) => x.key === variantKey);
      if (v?.deepLink) variantLink = v.deepLink;
    }

    // Winner offer
    if (best?.deepLink || variantLink) {
      const payload = {
        link: variantLink || best.deepLink,
        region: best?.region ?? offerChain[0],
        network: best?.network ?? "direct",
        merchantId: best?.merchantId,
        merchantName: best?.merchantName,
        priority: typeof best?.priority === "number" ? best.priority : 0,
        source: variantLink ? "offer-variant" : "offer",
      };
      if (isProd) cacheSet(cacheKey, payload, TTL_EXACT_MS);
      return res.json(payload);
    }

    // Custom fallback only
    if (originalLink) {
      const payload = {
        link: originalLink,
        region: offerChain[0],
        network: "custom",
        source: "fallback-original",
      };
      if (isProd) cacheSet(cacheKey, payload, TTL_FALLBACK_MS);
      return res.json(payload);
    }

    return res.status(404).json({ message: "No link available." });
  } catch (err) {
    console.error("affiliates/resolve-link error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

const resolveLinkValidators = [
  query("region").isString().isLength({ min: 2, max: 2 }).trim(),
  query("globalItemId").optional().isString().trim(),
  query("itemGroupId").optional().isString().trim(),
];

/**
 * Legacy path (kept): GET /api/affiliates/awin/resolve-link
 * New path:         GET /api/affiliates/offers/resolve-link
 */
router.get(
  "/awin/resolve-link",
  resolveLimiter,
  resolveLinkValidators,
  (req, res, next) => {
    // Optional: helps you find old callers during dev
    res.set("X-Deprecated-Route", "/api/affiliates/awin/resolve-link");
    return resolveBestOfferLink(req, res, next);
  }
);

router.get(
  "/offers/resolve-link",
  resolveLimiter,
  resolveLinkValidators,
  resolveBestOfferLink
);

/**
 * GET /api/affiliates/resolve
 * Query: itemId=<globalItemId>&region=<us|gb|nl|de|fr|it|ca>
 * Returns: { merchant, deeplink, source } | null
 *
 * This is kept for compatibility; it now resolves using MerchantOffer as well.
 */
router.get(
  "/resolve",
  [
    query("itemId").isString().isLength({ min: 8 }).trim(),
    query("region").isString().isLength({ min: 2, max: 2 }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: { code: "BAD_QUERY", details: errors.array() } });
    }

    try {
      const { itemId, region } = req.query;
      const offerChain = buildRegionPreferenceChain(region);

      const gi = await GlobalItem.findOne({ _id: itemId, owner: req.userId })
        .select("productId affiliate link variantKey")
        .lean();

      if (!gi) return res.json(null);

      const productId = gi.productId ? String(gi.productId) : null;
      const variantKey = gi.variantKey || null;
      const group =
        gi?.affiliate?.itemGroupId || gi?.affiliate?.externalProductId || null;

      let best = null;

      if (productId) {
        best = await MerchantOffer.findOne({ productId, region: { $in: offerChain } })
          .sort({ priority: -1, updatedAt: -1 })
          .lean();
      }

      if (!best && group) {
        best = await MerchantOffer.findOne({
          region: { $in: offerChain },
          $or: [
            { itemGroupId: String(group) },
            { externalProductId: String(group) },
          ],
        })
          .sort({ priority: -1, updatedAt: -1 })
          .lean();
      }

      // route to the owned variant's own buy-link if it has one
      let variantLink = null;
      if (productId && variantKey) {
        const cat = await CatalogItem.findById(productId).select("variants").lean();
        const v = (cat?.variants || []).find((x) => x.key === variantKey);
        if (v?.deepLink) variantLink = v.deepLink;
      }

      if (best?.deepLink || variantLink) {
        return res.json({
          merchant: best?.merchantName || best?.merchantId || null,
          deeplink: variantLink || best.deepLink,
          source: variantLink ? "offer-variant" : "offer",
          network: best?.network ?? "direct",
          priority: typeof best?.priority === "number" ? best.priority : 0,
        });
      }

      // custom fallback only
      if (gi.link) {
        return res.json({
          merchant: null,
          deeplink: gi.link,
          source: "custom",
        });
      }

      return res.json(null);
    } catch (err) {
      console.error("GET /affiliates/resolve error:", err);
      return res
        .status(500)
        .json({ message: "Failed to resolve affiliate deeplink." });
    }
  }
);

module.exports = router;
