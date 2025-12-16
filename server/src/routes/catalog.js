// server/src/routes/catalog.js
const express = require("express");
const CatalogItem = require("../models/catalogItem");

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

    // ✅ Region enforcement:
    // Only return items that have at least one link for user's region OR global.
    // (CatalogItem has region per link, not per item.)
    query.links = {
      $elemMatch: { region: { $in: ["global", userRegion] } },
    };

    // IMPORTANT: use .lean() so API returns plain JSON (client expects item.name, not _doc.name)
    const items = await CatalogItem.find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .select(
        // Include fields Import UI needs
        "name brand category subcategory itemType description weightGrams tags links updatedAt"
      );

    // ✅ Trim links so UI cannot show irrelevant regions
    const safeItems = (items || []).map((it) => {
      const links = Array.isArray(it.links) ? it.links : [];
      return {
        ...it,
        links: links.filter(
          (l) => l?.region === "global" || l?.region === userRegion
        ),
      };
    });

    res.json(safeItems);
  } catch (err) {
    console.error("GET /api/catalog/items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

module.exports = router;
