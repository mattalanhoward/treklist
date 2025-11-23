// server/src/routes/globalItems.js
const express = require("express");
const auth = require("../middleware/auth");
const GlobalItem = require("../models/globalItem");
const GearItem = require("../models/gearItem");
const AffiliateProduct = require("../models/affiliateProduct");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;

const router = express.Router();

// Protect all routes
router.use(auth);

// GET /api/global/items
router.get("/", async (req, res) => {
  try {
    const items = await GlobalItem.find({ owner: req.userId });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/global/items/:id — fetch one (owner-scoped)
router.get("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    const doc = await GlobalItem.findOne({
      _id: req.params.id,
      owner: req.userId,
    }).lean();

    if (!doc) return res.status(404).json({ message: "Not found." });
    res.json(doc);
  } catch (err) {
    console.error("GET /global/items/:id error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// POST /api/global/items/from-affiliate — create a template from an affiliate product
router.post(
  "/from-affiliate",
  [
    body("affiliateProductId").isString().isLength({ min: 8 }),
    body("name").optional().isString().isLength({ min: 1, max: 200 }).trim(),
    body("brand").optional().isString().isLength({ min: 1, max: 120 }).trim(),
    body("description").optional().isString().isLength({ max: 5000 }).trim(),
    body("weight").optional().isFloat({ min: 0 }),
    body("worn").optional().isBoolean(),
    body("consumable").optional().isBoolean(),
    body("itemType")
      .optional()
      .isString()
      .isLength({ min: 1, max: 120 })
      .trim(),
    body("quantity").optional().isInt({ min: 1, max: 999 }),
    body("weightSource")
      .optional()
      .isIn(["user", "heuristic", "scraped", "catalog", "verified"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Invalid payload", errors: errors.array() });
    }
    try {
      const { affiliateProductId } = req.body;
      let p = null;
      // Try Mongo ObjectId first
      if (isValidObjectId(affiliateProductId)) {
        p = await AffiliateProduct.findById(affiliateProductId).lean();
      }
      // Fallback to business identifiers
      if (!p) {
        p = await AffiliateProduct.findOne({
          $or: [
            { externalProductId: String(affiliateProductId) },
            { itemGroupId: String(affiliateProductId) },
            { sku: String(affiliateProductId) },
          ],
        }).lean();
      }
      if (!p) {
        return res
          .status(404)
          .json({ message: "Affiliate product not found." });
      }

      // Build the new GlobalItem — price/link always from affiliate product
      const data = {
        owner: req.userId,
        name: req.body.name ?? p.name,
        brand: req.body.brand ?? p.brand,
        description: req.body.description ?? p.description,
        itemType: req.body.itemType ?? null,
        weight: req.body.weight ?? null,
        ...(req.body.weightSource && { weightSource: req.body.weightSource }),
        worn: Boolean(req.body.worn),
        consumable: Boolean(req.body.consumable),
        quantity: Number.isFinite(req.body.quantity)
          ? Number(req.body.quantity)
          : 1,
        price: p.price ?? null,
        link: p.awDeepLink,
        // keep whatever category model you use today; skip if not applicable
        category: req.body.category ?? null,
        // store affiliate metadata (we added this in Step 2)
        affiliate: {
          network: "awin",
          merchantId: p.merchantId,
          merchantName: p.merchantName,
          region: p.region,
          externalProductId: p.externalProductId,
          deepLink: p.awDeepLink,
          itemGroupId: p.itemGroupId || null,
        },
      };

      const created = await GlobalItem.create(data);
      return res.status(201).json(created);
    } catch (err) {
      console.error("Error creating from affiliate product:", err);
      return res
        .status(500)
        .json({ message: "Could not create from affiliate product." });
    }
  }
);

// POST /api/global/items
router.post("/", async (req, res) => {
  try {
    const { category, name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }
    const allowedSources = [
      "user",
      "heuristic",
      "scraped",
      "catalog",
      "verified",
    ];
    const body = { ...req.body };
    if (
      typeof body.weightSource === "string" &&
      !allowedSources.includes(body.weightSource)
    ) {
      delete body.weightSource;
    }
    const newItem = await GlobalItem.create({ owner: req.userId, ...body });
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/global/items/:id — update template & cascade to GearItem instances
router.patch("/:id", async (req, res) => {
  try {
    // Load first to enforce immutability for affiliate-backed items
    const current = await GlobalItem.findOne({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!current) {
      return res.status(404).json({ message: "Global item not found." });
    }

    const isAffiliate = current.affiliate && current.affiliate.network;
    if (
      isAffiliate &&
      (Object.prototype.hasOwnProperty.call(req.body, "price") ||
        Object.prototype.hasOwnProperty.call(req.body, "link"))
    ) {
      return res.status(400).json({
        message: "price and link are immutable for affiliate-backed items.",
      });
    }

    // Only allow these fields to be updated
    const allowed = [
      "itemType",
      "name",
      "brand",
      "description",
      "weight",
      "price",
      "link",
    ];

    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    // Update master template
    const updated = await GlobalItem.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { $set: updates },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Global item not found." });
    }

    // Cascade update to all GearItem instances referencing this template
    const cascade = {
      itemType: updated.itemType,
      name: updated.name,
      brand: updated.brand,
      description: updated.description,
      weight: updated.weight,
      price: updated.price,
      link: updated.link,
    };

    await GearItem.updateMany({ globalItem: req.params.id }, { $set: cascade });

    res.json(updated);
  } catch (err) {
    console.error("Error propagating global item update:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/global/items/:id — remove template & all its GearItem instances
router.delete("/:id", async (req, res) => {
  try {
    // Delete the master template
    const deleted = await GlobalItem.findOneAndDelete({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Global item not found." });
    }
    // Cascade delete all GearItem instances referencing this template
    await GearItem.deleteMany({ globalItem: req.params.id });
    res.json({ message: "Global item and its instances deleted." });
  } catch (err) {
    console.error("Error deleting global item:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
