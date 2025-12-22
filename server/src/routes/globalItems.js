// server/src/routes/globalItems.js
const express = require("express");
const auth = require("../middleware/auth");
const GlobalItem = require("../models/globalItem");
const GearItem = require("../models/gearItem");
const AffiliateProduct = require("../models/affiliateProduct");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const CatalogItem = require("../models/catalogItem");

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

      const dedupeQuery = {
        owner: req.userId,
        "affiliate.network": "awin",
        "affiliate.region": String(p.region || ""),
        "affiliate.externalProductId": String(p.externalProductId || ""),
      };

      // If we don't have a stable key, skip dedupe
      const canDedupe =
        dedupeQuery["affiliate.region"] &&
        dedupeQuery["affiliate.externalProductId"];

      // Build the new GlobalItem — link always from affiliate product
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

      if (canDedupe) {
        const existing = await GlobalItem.findOne(dedupeQuery);
        if (existing) {
          return res.status(200).json(existing);
        }
      }

      try {
        const created = await GlobalItem.create(data);
        return res.status(201).json(created);
      } catch (err) {
        if (err?.code === 11000 && canDedupe) {
          const winner = await GlobalItem.findOne(dedupeQuery);
          if (winner) return res.status(200).json(winner);
        }
        throw err;
      }
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
    if (isAffiliate && Object.prototype.hasOwnProperty.call(req.body, "link")) {
      return res.status(400).json({
        message: "Link is immutable for affiliate-backed items.",
      });
    }

    // Only allow these fields to be updated
    const allowed = [
      "category",
      "itemType",
      "name",
      "brand",
      "description",
      "weight",
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

// POST /api/global/items/from-catalog/bulk
// Bulk import catalog items as GlobalItems (idempotent per owner+productId)
router.post("/from-catalog/bulk", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const cleanIds = ids.filter((x) => isValidObjectId(x));

    if (cleanIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid catalog ids provided." });
    }

    // Load catalog items (only active)
    const catalogItems = await CatalogItem.find({
      _id: { $in: cleanIds },
      isActive: true,
    }).lean();

    // Existing imports for this owner
    const existing = await GlobalItem.find({
      owner: req.userId,
      productId: { $in: catalogItems.map((c) => c._id) },
    })
      .select("_id productId")
      .lean();

    const existingSet = new Set(existing.map((g) => String(g.productId)));

    // Prepare upsert operations (idempotent, safe in races due to unique index)
    const ops = catalogItems
      .filter((c) => !existingSet.has(String(c._id)))
      .map((c) => {
        const primaryLink = Array.isArray(c.links) ? c.links[0] : null;

        const payload = {
          owner: req.userId,
          productId: c._id,
          name: c.name,
          brand: c.brand,
          itemType: c.itemType || c.subcategory || c.category || null,
          description: c.description,
          weight: c.weightGrams,
          ...(typeof c.weightGrams === "number" && { weightSource: "catalog" }),
          tags: c.tags,
          category: c.category || null,
          subcategory: c.subcategory || null,
          link: primaryLink ? primaryLink.url : "",
          affiliate: primaryLink
            ? {
                network: primaryLink.network,
                region: primaryLink.region || "global",
                deepLink: primaryLink.url,
                merchantName: primaryLink.merchantName || "",
                externalProductId: primaryLink.externalId || "",
                itemGroupId: c.itemGroupId || undefined,
              }
            : undefined,
        };

        return {
          updateOne: {
            filter: { owner: req.userId, productId: c._id },
            update: { $setOnInsert: payload },
            upsert: true,
          },
        };
      });

    if (ops.length > 0) {
      await GlobalItem.bulkWrite(ops, { ordered: false });
    }

    // Return winners (created + existing) for the requested set
    const winners = await GlobalItem.find({
      owner: req.userId,
      productId: { $in: catalogItems.map((c) => c._id) },
    }).lean();

    return res.status(200).json({
      items: winners,
      catalogIds: catalogItems.map((c) => String(c._id)),
    });
  } catch (err) {
    console.error("POST /global/items/from-catalog/bulk error:", err);
    return res.status(500).json({ message: "Failed to import catalog items." });
  }
});

// POST /api/global/items/from-catalog/:id
// Create a user-owned GlobalItem cloned from a catalog item
router.post("/from-catalog/:id", async (req, res) => {
  try {
    const catalogId = req.params.id;
    const catalogItem = await CatalogItem.findById(catalogId);
    if (!catalogItem || !catalogItem.isActive) {
      return res.status(404).json({ message: "Catalog item not found." });
    }

    const primaryLink = Array.isArray(catalogItem.links)
      ? catalogItem.links[0]
      : null;

    // Prepare new GlobalItem payload
    const payload = {
      owner: req.userId,
      productId: catalogItem._id,
      // core fields
      name: catalogItem.name,
      brand: catalogItem.brand,
      // prefer the most specific label for the UI
      itemType:
        catalogItem.itemType ||
        catalogItem.subcategory ||
        catalogItem.category ||
        null,
      description: catalogItem.description,
      // weight (+ mark it as coming from catalog if present)
      weight: catalogItem.weightGrams,
      ...(typeof catalogItem.weightGrams === "number" && {
        weightSource: "catalog",
      }),
      tags: catalogItem.tags,
      category: catalogItem.category || null,
      subcategory: catalogItem.subcategory || null,
      // old top-level link field used throughout the app
      link: primaryLink ? primaryLink.url : "",

      // affiliate metadata for future routing
      affiliate: primaryLink
        ? {
            network: primaryLink.network,
            region: primaryLink.region || "global",
            deepLink: primaryLink.url,
            merchantName: primaryLink.merchantName || "",
            externalProductId: primaryLink.externalId || "",
            itemGroupId: catalogItem.itemGroupId || undefined,
          }
        : undefined,
    };

    // ✅ Idempotent: if already imported, return existing
    const existing = await GlobalItem.findOne({
      owner: req.userId,
      productId: catalogItem._id,
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    try {
      const newItem = await GlobalItem.create(payload);
      return res.status(201).json(newItem);
    } catch (err) {
      // If two imports race, unique index may throw E11000; return winner
      if (err?.code === 11000) {
        const winner = await GlobalItem.findOne({
          owner: req.userId,
          productId: catalogItem._id,
        });
        if (winner) return res.status(200).json(winner);
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /global/items/from-catalog error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: "Failed to import catalog item." });
  }
});

module.exports = router;
