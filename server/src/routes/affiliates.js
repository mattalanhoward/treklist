// server/src/routes/affiliates.js
const express = require("express");
const { query, validationResult } = require("express-validator");
const AffiliateProduct = require("../models/affiliateProduct");
const GlobalItem = require("../models/globalItem");
const MerchantOffer = require("../models/merchantOffer");
const { searchLimiter, resolveLimiter } = require("../middleware/rateLimiters");

// Note: auth is enforced at mount-level in app.js (/api/affiliates)

const router = express.Router();

// --- Simple in-memory TTL cache for resolve-link (no extra deps)
// Key: `${key}|${region}` where key is productId or legacy group id
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

// MerchantOffer.region uses internal lowercase (uk/us/nl/...)
// Incoming APIs often use ISO-ish (GB/US/NL/...)
function normalizeOfferRegion(r) {
  const x = String(r || "")
    .trim()
    .toLowerCase();
  if (x === "gb") return "uk";
  return x; // us/nl/de/fr/it/ca/uk...
}

/**
 * GET /api/affiliates/awin/facets
 * Query params:
 *  - region: "GB" | "DE" | "US" ... (required)
 *  - merchantId?: number-like
 *  - q?: string (simple regex search on name/description)
 *  - brand?: string (filters results before faceting)
 *  - itemType?: string (filters results before faceting)
 *  - limit?: number (how many facet buckets to return, default 50)
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

      // AffiliateProduct.region is stored as "GB"/"US"/...
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
 * Query params:
 *  - region: "GB" | "DE" | "US" ... (required)
 *  - merchantId?: number-like
 *  - brand?: string (exact, case-insensitive via brandLC)
 *  - itemType?: string (exact on denormalized itemType)
 *  - category?: string (substring match against categoryPath for legacy UIs)
 *  - q?: string (regex search in name/description; safe w/o text index)
 *  - page?: number (default 1)
 *  - limit?: number (default 24, max 50)
 *  - sort?: string ("relevance" | "-updated")
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

      // denormalized brand/itemType
      if (brand) filter.brandLC = normalizeBrandKey(brand);
      if (itemType) filter.itemType = String(itemType).trim();

      // legacy category-path contains (kept for compatibility)
      if (category) {
        and.push({ categoryPath: new RegExp(escapeRegex(category), "i") });
      }

      // safe regex search; avoids requiring a text index
      if (q && q.trim()) {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        and.push({ $or: [{ name: rx }, { description: rx }] });
      }

      if (and.length) filter.$and = and;

      // simple sorts
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
 * GET /api/affiliates/awin/resolve-link
 * ?globalItemId=<id>&region=GB   (preferred)
 * or ?itemGroupId=<group>&region=GB
 *
 * Returns: { link, region, network, merchantId, merchantName, source }
 *
 * New model:
 * - catalog-backed GlobalItem: resolve via GlobalItem.productId -> MerchantOffer.productId
 * - legacy affiliate-backed: resolve via itemGroupId/externalProductId if present
 * - custom items: optional fallback to GlobalItem.link (custom-only)
 */
router.get(
  "/awin/resolve-link",
  resolveLimiter,
  [
    query("region").isString().isLength({ min: 2, max: 2 }).trim(),
    query("globalItemId").optional().isString().trim(),
    query("itemGroupId").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: { code: "BAD_QUERY", details: errors.array() } });
    }

    try {
      let { region, globalItemId, itemGroupId } = req.query;
      const offerRegion = normalizeOfferRegion(region);

      let group = itemGroupId || null; // legacy: itemGroupId / externalProductId
      let originalLink = null; // custom items only
      let productId = null; // catalog-backed path

      if (globalItemId) {
        const gi = await GlobalItem.findOne({
          _id: globalItemId,
          owner: req.userId,
        }).lean();

        if (!gi) {
          return res.status(404).json({ message: "Global item not found." });
        }

        // Custom items may still have link (custom-only now)
        originalLink = gi.link || null;

        // Catalog-backed items resolve via CatalogItem id
        productId = gi.productId ? String(gi.productId) : null;

        // Legacy affiliate-backed items resolve via stored affiliate ids
        group =
          group ||
          gi?.affiliate?.itemGroupId ||
          gi?.affiliate?.externalProductId ||
          null;
      }

      // If caller gave us a globalItemId, a custom item is valid input.
      // Custom items don’t resolve via MerchantOffer — they use their own link.
      if (globalItemId && !productId && !group) {
        if (originalLink) {
          return res.json({
            link: originalLink,
            region: offerRegion,
            network: "custom",
            source: "custom-link",
          });
        }
        return res.status(404).json({ message: "No link available." });
      }

      // If they did NOT pass a globalItemId, we need an itemGroupId (legacy path)
      if (!globalItemId && !group) {
        return res
          .status(400)
          .json({ message: "Missing itemGroupId or globalItemId." });
      }

      const cacheKey = `${productId || group}|${offerRegion}`;
      const cached = cacheGet(cacheKey);
      if (cached) {
        if (process.env.NODE_ENV !== "production")
          console.log("resolve-link cache HIT", cacheKey);
        return res.json(cached);
      }
      if (process.env.NODE_ENV !== "production")
        console.log("resolve-link cache MISS", cacheKey);

      // 1) Preferred: MerchantOffer by CatalogItem productId (region first, then global)
      let mo = null;

      if (productId) {
        mo = await MerchantOffer.findOne({
          productId,
          region: offerRegion,
        })
          .sort({ priority: -1, updatedAt: -1 })
          .lean();

        if (!mo) {
          mo = await MerchantOffer.findOne({
            productId,
            region: "global",
          })
            .sort({ priority: -1, updatedAt: -1 })
            .lean();
        }
      }

      // 2) Fallback: legacy MerchantOffer by itemGroupId/externalProductId (region first, then global)
      if (!mo && group) {
        mo = await MerchantOffer.findOne({
          region: offerRegion,
          $or: [
            { itemGroupId: String(group) },
            { externalProductId: String(group) },
          ],
        })
          .sort({ priority: -1, updatedAt: -1 })
          .lean();

        if (!mo) {
          mo = await MerchantOffer.findOne({
            region: "global",
            $or: [
              { itemGroupId: String(group) },
              { externalProductId: String(group) },
            ],
          })
            .sort({ priority: -1, updatedAt: -1 })
            .lean();
        }
      }

      // MerchantOffer deeplink field is deepLink
      if (mo?.deepLink) {
        const payload = {
          link: mo.deepLink,
          region: mo.region,
          network: mo.network || "awin",
          merchantId: mo.merchantId || null,
          merchantName: mo.merchantName || null,
          source: "offer",
        };
        cacheSet(cacheKey, payload, TTL_EXACT_MS);
        return res.json(payload);
      }

      // 3) Custom-item fallback: stored GlobalItem.link (if you still keep it for custom items)
      if (originalLink) {
        const payload = {
          link: originalLink,
          region: offerRegion,
          network: "custom",
          source: "custom-link",
        };
        cacheSet(cacheKey, payload, TTL_FALLBACK_MS);
        return res.json(payload);
      }

      return res.status(404).json({ message: "No link available." });
    } catch (err) {
      console.error("affiliates/resolve-link error:", err);
      res.status(500).json({ message: "Server error." });
    }
  }
);

/**
 * GET /api/affiliates/resolve
 * Query: itemId=<globalItemId>&region=<nl|us|gb|fr|it|ca|de>
 * Returns: { merchant, deeplink, source: "offer" | "product" } | null
 *
 * New behavior:
 * - catalog-backed GlobalItem: resolve via MerchantOffer by productId + region/global
 * - legacy affiliate-backed GlobalItem (awin): resolve via MerchantOffer or AffiliateProduct by itemGroupId/externalProductId
 */
router.get(
  "/resolve",
  [
    query("itemId").isString().isLength({ min: 8 }).trim(),
    query("region").isString().isLength({ min: 2, max: 2 }).trim(),
  ],
  async (req, res) => {
    try {
      const { itemId, region } = req.query;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: { code: "BAD_QUERY", details: errors.array() } });
      }

      const offerRegion = normalizeOfferRegion(region); // uk/us/nl...
      const productRegion = String(region).toUpperCase(); // GB/US/NL... for AffiliateProduct

      // Owner-scoped to avoid leaking resolution for other users’ ids
      const item = await GlobalItem.findOne({
        _id: itemId,
        owner: req.userId,
      }).lean();
      if (!item) return res.json(null);

      // 1) Catalog-backed path: GlobalItem.productId -> MerchantOffer.productId
      if (item.productId) {
        let offer = await MerchantOffer.findOne({
          productId: String(item.productId),
          region: offerRegion,
        })
          .sort({ priority: -1, updatedAt: -1 })
          .lean();

        if (!offer) {
          offer = await MerchantOffer.findOne({
            productId: String(item.productId),
            region: "global",
          })
            .sort({ priority: -1, updatedAt: -1 })
            .lean();
        }

        if (offer?.deepLink) {
          return res.json({
            merchant: offer.merchantName || offer.merchantId || null,
            deeplink: offer.deepLink,
            source: "offer",
          });
        }
      }

      // 2) Legacy affiliate-backed path (if any remain)
      if (item?.affiliate?.network === "awin") {
        const groupId =
          item.affiliate.itemGroupId ||
          item.affiliate.externalProductId ||
          null;

        if (!groupId) return res.json(null);

        let offer = await MerchantOffer.findOne({
          network: "awin",
          region: offerRegion,
          $or: [
            { itemGroupId: String(groupId) },
            { externalProductId: String(groupId) },
          ],
        })
          .sort({ priority: -1, updatedAt: -1 })
          .lean();

        if (!offer) {
          offer = await MerchantOffer.findOne({
            network: "awin",
            region: "global",
            $or: [
              { itemGroupId: String(groupId) },
              { externalProductId: String(groupId) },
            ],
          })
            .sort({ priority: -1, updatedAt: -1 })
            .lean();
        }

        if (offer?.deepLink) {
          return res.json({
            merchant: offer.merchantName || offer.merchantId || null,
            deeplink: offer.deepLink,
            source: "offer",
          });
        }

        // Fallback to AffiliateProduct (still uses uppercase region + awDeepLink)
        const prod = await AffiliateProduct.findOne({
          network: "awin",
          region: productRegion,
          $or: [
            { itemGroupId: String(groupId) },
            { externalProductId: String(groupId) },
          ],
        }).lean();

        if (prod?.awDeepLink) {
          return res.json({
            merchant: prod.merchantName || prod.brand || null,
            deeplink: prod.awDeepLink,
            source: "product",
          });
        }
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
