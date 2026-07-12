// server/src/routes/catalog.js
const express = require("express");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");
const CatalogReport = require("../models/catalogReport");
const SearchLog = require("../models/searchLog");

const auth = require("../middleware/auth");
const User = require("../models/user");
const AffiliateProduct = require("../models/affiliateProduct");

const { tokenRegex } = require("../utils/tokenRegex");

const router = express.Router();

// Small normalization helper (server-side)
function normalizeRegion(region) {
  if (!region) return "global";
  const r = String(region).trim().toLowerCase();
  if (r === "netherlands") return "nl";
  if (r === "united states" || r === "usa") return "us";
  if (r === "gb") return "uk";
  if (r.length === 2) return r;
  return r;
}

// GET /api/catalog/items/:id
// Fetch one catalog item (includes imageUrls) — auth required
router.get("/items/:id", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("region").lean();
  const userRegion = normalizeRegion(user?.region);

  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid id." });
  }

  try {
    const item = await CatalogItem.findOne({ _id: id, isActive: true })
      .lean()
      .select(
        [
          "name",
          "brand",
          "brandLC",
          "modelNumber",
          "category",
          "subcategory",
          "itemType",
          "description",
          "imageUrls",
          "weightGrams",
          "variantAxes",
          "variants",
          "defaultVariantKey",
          "externalIds",
          "dimensions",
          "tags",
          "attributes",
          "itemGroupId",
          "canonicalAsin",
          "canonicalSku",
          "createdAt",
          "updatedAt",
        ].join(" "),
      );

    if (!item) {
      return res.status(404).json({ message: "Catalog item not found." });
    }

    // Fetch offers for this user's region (may be empty array)
    const offers = await MerchantOffer.find({
      productId: item._id,
      region: { $in: ["global", userRegion] },
    })
      .select(
        "network region merchantId merchantName deepLink priority externalProductId updatedAt productId",
      )
      .lean();

    // Remove the 404 check - allow returning items with no offers

    return res.json({
      ...item,
      offers: offers.sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    });
  } catch (err) {
    console.error("GET /api/catalog/items/:id error", err);
    return res.status(500).json({ message: "Failed to load catalog item." });
  }
});

// GET /api/catalog/brands
// Returns distinct brand names, optionally filtered by category/subcategory
router.get("/brands", auth, async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    const match = { isActive: true };
    if (category) match.category = category;
    if (subcategory) match.subcategory = subcategory;
    const brands = await CatalogItem.distinct("brand", match);
    brands.sort((a, b) => a.localeCompare(b));
    res.json(brands.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

// GET /api/catalog/category-counts
// Active-item counts per top-level category, for the add-gear browse zero state.
// Returns a { [category]: count } map.
router.get("/category-counts", auth, async (req, res) => {
  try {
    const rows = await CatalogItem.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const counts = {};
    rows.forEach((r) => {
      if (r._id) counts[r._id] = r.count;
    });
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch category counts" });
  }
});

// POST /api/catalog/report
// File a crowd-sourced "report an issue" against a catalog item. Deduped by
// (catalogItem, field) with a counter (decision 12). One request can dispute
// several fields at once; each becomes/updates its own queue row.
router.post("/report", auth, async (req, res) => {
  try {
    const { catalogItemId, note, variantKey, shownValues } = req.body || {};
    if (!isValidObjectId(catalogItemId)) {
      return res.status(400).json({ error: "Invalid catalog item id" });
    }
    const requested = Array.isArray(req.body?.fields)
      ? req.body.fields
      : req.body?.field
        ? [req.body.field]
        : [];
    const fields = [...new Set(requested)].filter((f) =>
      CatalogReport.FIELDS.includes(f),
    );
    if (!fields.length) {
      return res.status(400).json({ error: "No valid report field selected" });
    }

    const exists = await CatalogItem.exists({ _id: catalogItemId });
    if (!exists) return res.status(404).json({ error: "Catalog item not found" });

    const trimmedNote = typeof note === "string" ? note.trim().slice(0, 1000) : "";
    const now = new Date();

    await Promise.all(
      fields.map((field) =>
        CatalogReport.updateOne(
          { catalogItem: catalogItemId, field },
          {
            $inc: { count: 1 },
            $set: {
              status: "open",
              variantKey: variantKey || null,
              lastNote: trimmedNote,
              shownValues: shownValues || null,
              lastReporter: req.userId,
              lastReportedAt: now,
            },
          },
          { upsert: true },
        ),
      ),
    );

    res.json({ ok: true, fields });
  } catch (err) {
    console.error("POST /catalog/report error:", err);
    res.status(500).json({ error: "Failed to file report" });
  }
});

// POST /api/catalog/search-log
// Fire-and-forget log of a settled zero-result catalog search. Upserts the
// normalized query with a counter (handoff CUT section → demand signal).
router.post("/search-log", auth, async (req, res) => {
  try {
    const raw = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    const query = raw.toLowerCase();
    // Ignore empties and absurdly long strings (pasted URLs, junk).
    if (!query || query.length > 120) return res.json({ ok: true });

    await SearchLog.updateOne(
      { query },
      { $inc: { count: 1 }, $set: { lastSeenAt: new Date() } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    // Non-fatal: this is fire-and-forget telemetry.
    res.json({ ok: true });
  }
});

// GET /api/catalog/items
// Public read-only list of active catalog items
router.get("/items", auth, async (req, res) => {
  // Pull region from the authenticated user (secure; client cannot spoof)
  const user = await User.findById(req.userId).select("region").lean();
  const userRegion = normalizeRegion(user?.region);

  try {
    const {
      q,
      category,
      subcategory,
      brand,
      limit = 100,
      skip = 0,
    } = req.query;

    const query = { isActive: true };

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = brand;

    if (q && q.trim()) {
      const raw = q.trim();
      // Decathlon item numbers are pure digits (e.g. 8608666 or R-p-8608666)
      const decathlonMatch = raw.match(/(?:^|R-p-)(\d{6,})$/);
      if (decathlonMatch) {
        const code = decathlonMatch[1];
        const affiliates = await AffiliateProduct.find({ merchantProductId: code })
          .select("externalProductId")
          .lean();
        const skus = affiliates.map((p) => p.externalProductId);
        if (skus.length === 0) {
          return res.json({ items: [], total: 0 });
        }
        query["externalIds.sku"] = { $in: skus };
      } else {
        const tokens = raw.replace(/\s+/g, " ").split(" ").filter(Boolean);
        const fields = (regex) => [
          { name: regex },
          { brand: regex },
          { tags: regex },
          { subcategory: regex },
        ];
        if (tokens.length === 1) {
          query.$or = fields(tokenRegex(tokens[0]));
        } else {
          // Each token must match at least one field (handles "Osprey Exos" → brand + name)
          query.$and = tokens.map((token) => ({ $or: fields(tokenRegex(token)) }));
        }
        query._searchTokens = tokens; // consumed below, not a Mongo field
      }
    }

    const PROJECTION =
      "name brand category subcategory itemType description weightGrams imageUrls tags updatedAt variantAxes defaultVariantKey";

    let items;
    const searchTokens = query._searchTokens;
    delete query._searchTokens;

    const total = await CatalogItem.countDocuments(query).collation({ locale: "en", strength: 2 });

    if (searchTokens) {
      // Rank by WHERE the tokens matched: name > brand > subcategory > tags, so a
      // name hit ("…Pillow") always outranks a tag/cross-sell hit. Ties stay A→Z.
      const tokenScore = (token) => {
        const rx = tokenRegex(token);
        const match = (input) => ({
          $cond: [{ $regexMatch: { input: { $ifNull: [input, ""] }, regex: rx } }, 1, 0],
        });
        const tagsMatch = {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$tags", []] },
                      cond: { $regexMatch: { input: "$$this", regex: rx } },
                    },
                  },
                },
                0,
              ],
            },
            1,
            0,
          ],
        };
        return {
          $add: [
            { $multiply: [match("$name"), 8] },
            { $multiply: [match("$brand"), 4] },
            { $multiply: [match("$subcategory"), 2] },
            tagsMatch,
          ],
        };
      };
      items = await CatalogItem.aggregate([
        { $match: query },
        { $addFields: { _score: { $add: searchTokens.map(tokenScore) } } },
        { $sort: { _score: -1, brand: 1, name: 1 } },
        { $skip: Number(skip) },
        { $limit: Math.min(Number(limit), 200) },
        {
          $project: Object.fromEntries(
            PROJECTION.split(" ").map((f) => [f, 1]),
          ),
        },
      ]).collation({ locale: "en", strength: 2 });
    } else {
      items = await CatalogItem.find(query)
        .collation({ locale: "en", strength: 2 })
        .sort({ brand: 1, name: 1 })
        .lean()
        .skip(Number(skip))
        .limit(Math.min(Number(limit), 200))
        .select(PROJECTION);
    }

    const offers = await MerchantOffer.find({
      productId: { $in: items.map((i) => i._id) },
      region: { $in: ["global", userRegion] },
    }).lean();

    const offersByProduct = new Map();
    for (const o of offers) {
      const key = String(o.productId);
      if (!offersByProduct.has(key)) offersByProduct.set(key, []);
      offersByProduct.get(key).push({
        _id: o._id,
        network: o.network,
        region: o.region,
        merchantId: o.merchantId,
        merchantName: o.merchantName,
        deepLink: o.deepLink,
        priority: o.priority,
        externalProductId: o.externalProductId,
        updatedAt: o.updatedAt,
      });
    }

    const safeItems = items.map((it) => ({
      ...it,
      offers: (offersByProduct.get(String(it._id)) || [])
        .slice()
        .sort((a, b) => {
          const ar = String(a.region || "global").toLowerCase();
          const br = String(b.region || "global").toLowerCase();
          const aRegionScore = ar === userRegion ? 2 : ar === "global" ? 1 : 0;
          const bRegionScore = br === userRegion ? 2 : br === "global" ? 1 : 0;
          if (aRegionScore !== bRegionScore) return bRegionScore - aRegionScore;
          return (Number(b.priority) || 0) - (Number(a.priority) || 0);
        }),
    }));

    res.json({ items: safeItems, total });
  } catch (err) {
    console.error("GET /api/catalog/items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

module.exports = router;
