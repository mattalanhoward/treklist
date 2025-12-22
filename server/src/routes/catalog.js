// server/src/routes/catalog.js
const express = require("express");
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
      const regex = new RegExp(q.trim(), "i");
      query.$or = [
        { name: regex },
        { brand: regex },
        { tags: regex },
        { category: regex },
        { subcategory: regex },
        { itemType: regex },
      ];
    }

    const offerProductIds = await MerchantOffer.distinct("productId", {
      region: { $in: ["global", userRegion] },
      productId: { $ne: null },
    });

    query._id = { $in: offerProductIds };

    const items = await CatalogItem.find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .select(
        "name brand category subcategory itemType description weightGrams tags updatedAt"
      );

    const offers = await MerchantOffer.find({
      productId: { $in: items.map((i) => i._id) },
      region: { $in: ["global", userRegion] },
    }).lean();

    const offersByProduct = new Map();
    for (const o of offers) {
      const key = String(o.productId);
      if (!offersByProduct.has(key)) offersByProduct.set(key, []);
      offersByProduct.get(key).push(o);
    }

    const safeItems = items.map((it) => ({
      ...it,
      offers: (offersByProduct.get(String(it._id)) || []).sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      ),
    }));

    res.json(safeItems);
  } catch (err) {
    console.error("GET /api/catalog/items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

module.exports = router;
