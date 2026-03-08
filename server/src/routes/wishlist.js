// server/src/routes/wishlist.js
const express = require("express");
const auth = require("../middleware/auth");
const GlobalItem = require("../models/globalItem");

const router = express.Router();
router.use(auth);

// GET /api/wishlist/items — fetch all wishlisted items for the current user
router.get("/items", async (req, res) => {
  try {
    const items = await GlobalItem.find({
      owner: req.userId,
      status: "wishlisted",
    })
      .sort({ createdAt: -1 })
      .populate("productId", "imageUrls")
      .lean();

    // Same image enrichment as my-gear route: prefer catalog images for productId-backed items
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
    console.error("Error GET wishlist items:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
