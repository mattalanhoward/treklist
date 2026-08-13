// server/src/routes/myGear.js
const express = require("express");
const auth = require("../middleware/auth");
const GlobalItem = require("../models/globalItem");

const router = express.Router();

// Protect all routes
router.use(auth);

// GET /api/my-gear/items - Get user's owned gear items
// ?includeWishlisted=true also returns wishlisted items. Lists can hold gear the
// user doesn't own yet (the list row carries its own wishlist star), so the
// add-gear search needs them — otherwise wishlisting an item makes it
// unfindable when building a list.
router.get("/items", async (req, res) => {
  try {
    const includeImported = req.query.includeImported === "true";
    const includeWishlisted = req.query.includeWishlisted === "true";

    const query = { owner: req.userId };
    if (!includeWishlisted) {
      query.status = { $ne: "wishlisted" };
    }
    if (!includeImported) {
      query.importedFromShare = { $ne: true };
    }

    // Match owned items OR legacy items without status field
    const items = await GlobalItem.find(query)
      .sort({ createdAt: -1 })
      .populate("productId", "imageUrls")
      .lean();

    // Merge imageUrls: imported items use CatalogItem images, custom items use their own
    const enriched = items.map((item) => {
      const { productId, ...rest } = item;
      const imageUrls = productId
        ? productId.imageUrls || []
        : rest.imageUrls || [];
      return {
        ...rest,
        productId: productId?._id || null,
        imageUrls,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("GET /api/my-gear/items error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
