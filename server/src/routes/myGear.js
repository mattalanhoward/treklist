// server/src/routes/myGear.js
const express = require("express");
const auth = require("../middleware/auth");
const GlobalItem = require("../models/globalItem");

const router = express.Router();

// Protect all routes
router.use(auth);

// GET /api/my-gear/items - Get user's owned gear items
router.get("/items", async (req, res) => {
  try {
    // Match owned items OR legacy items without status field
    const items = await GlobalItem.find({
      owner: req.userId,
      status: { $ne: "wishlisted" },
    })
      .sort({ createdAt: -1 })
      .populate("productId", "imageUrls")
      .lean();

    // Merge imageUrls from populated productId into each item
    const enriched = items.map((item) => {
      const imageUrls = item.productId?.imageUrls || [];
      const { productId, ...rest } = item;
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
