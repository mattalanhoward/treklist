// server/src/routes/catalog.js
const express = require("express");
const CatalogItem = require("../models/catalogItem");

const router = express.Router();

// GET /api/catalog/items
// Public read-only list of active catalog items
router.get("/items", async (req, res) => {
  try {
    const { q, category, limit = 100, skip = 0 } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      query.$or = [{ name: regex }, { brand: regex }, { tags: regex }];
    }

    const items = await CatalogItem.find(query)
      .sort({ updatedAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .select(
        "name brand category description weightGrams tags links updatedAt"
      );

    res.json(items);
  } catch (err) {
    console.error("GET /api/catalog/items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

module.exports = router;
