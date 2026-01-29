// server/src/routes/catalog.js
const express = require("express");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const auth = require("../middleware/auth");
const User = require("../models/user");

const router = express.Router();

// Small normalization helper (server-side)
function normalizeRegion(region) {
  if (!region) return "global";
  const r = String(region).trim().toLowerCase();
  if (r === "netherlands") return "nl";
  if (r === "united states" || r === "usa") return "us";
  if (r.length === 2) return r;
  return r; // fallback (still works if your DB stores "nl", "us", etc.)
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
      const qNorm = q.trim().replace(/\s+/g, " ");
      const regex = new RegExp(qNorm, "i");
      query.$or = [
        { name: regex },
        { brand: regex },
        { tags: regex },
        { category: regex },
        { subcategory: regex },
        { itemType: regex },
      ];
    }

    const items = await CatalogItem.find(query)
      .collation({ locale: "en", strength: 2 })
      .sort({ brand: 1, name: 1 })
      .lean()
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .select(
        "name brand category subcategory itemType description weightGrams tags updatedAt",
      );

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

    res.json(safeItems);
  } catch (err) {
    console.error("GET /api/catalog/items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

module.exports = router;
