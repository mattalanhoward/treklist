// server/src/routes/adminCatalogItems.js
const express = require("express");
const CatalogItem = require("../models/catalogItem");
const requireAdmin = require("../middleware/requireAdmin");
// Adjust this path if your auth middleware lives somewhere else:
const auth = require("../middleware/auth");

const router = express.Router();

// All routes below require auth + admin
router.use(auth, requireAdmin);

// GET /api/admin/catalog-items
// Basic list endpoint with optional filters
router.get("/", async (req, res) => {
  try {
    const { q, category, isActive = "true", limit = 100, skip = 0 } = req.query;

    const query = {};

    if (isActive === "true") query.isActive = true;
    if (isActive === "false") query.isActive = false;

    if (category) {
      query.category = category;
    }

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      query.$or = [{ name: regex }, { brand: regex }, { tags: regex }];
    }

    const items = await CatalogItem.find(query)
      .sort({ updatedAt: -1 })
      .skip(Number(skip) || 0)
      .limit(Math.min(Number(limit) || 100, 200)); // guard against silly limits

    const total = await CatalogItem.countDocuments(query);

    res.json({
      items,
      total,
    });
  } catch (err) {
    console.error("GET /api/admin/catalog-items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

// POST /api/admin/catalog-items
// Create a new catalog item (Amazon-only for now)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      brand,
      category,
      description,
      weightGrams,
      tags,
      links,
      priceHint,
    } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required." });
    }

    if (!Array.isArray(links) || links.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one affiliate link is required." });
    }

    const sanitizedLinks = links.map((link) => ({
      network: link.network,
      region: link.region || "global",
      url: (link.url || "").trim(),
      merchantName: link.merchantName || undefined,
      externalId: link.externalId || undefined,
      priority: typeof link.priority === "number" ? link.priority : 0,
    }));

    if (sanitizedLinks.some((l) => !l.network || !l.url)) {
      return res.status(400).json({
        message: "Each link must have a network and url.",
      });
    }

    // ---- Normalize numeric fields from strings/numbers ----
    let normalizedWeight = undefined;
    if (
      weightGrams !== undefined &&
      weightGrams !== null &&
      weightGrams !== ""
    ) {
      const n = Number(weightGrams);
      if (Number.isNaN(n) || n < 0) {
        return res.status(400).json({ message: "Invalid weightGrams." });
      }
      normalizedWeight = n;
    }

    let normalizedPriceHint = null;
    if (priceHint !== undefined && priceHint !== null && priceHint !== "") {
      const n = Number(priceHint);
      if (Number.isNaN(n) || n < 0) {
        return res.status(400).json({ message: "Invalid priceHint." });
      }
      normalizedPriceHint = n;
    }

    const item = await CatalogItem.create({
      name: name.trim(),
      brand: brand && brand.trim(),
      category: category && category.trim(),
      description: description && description.trim(),
      weightGrams: normalizedWeight,
      tags: Array.isArray(tags)
        ? tags.filter(Boolean).map((t) => String(t).trim())
        : [],
      links: sanitizedLinks,
      priceHint: normalizedPriceHint,
      createdBy: req.userId,
    });

    res.status(201).json(item);
  } catch (err) {
    console.error("POST /api/admin/catalog-items error", err);
    res.status(500).json({ message: "Failed to create catalog item." });
  }
});

// PATCH /api/admin/catalog-items/:id
// Update an existing catalog item
router.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    const allowedFields = [
      "name",
      "brand",
      "category",
      "description",
      "weightGrams",
      "tags",
      "links",
      "isActive",
      "priceHint",
    ];

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    // Normalize simple strings
    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
    }
    if (typeof updates.brand === "string") {
      updates.brand = updates.brand.trim();
    }
    if (typeof updates.category === "string") {
      updates.category = updates.category.trim();
    }
    if (typeof updates.description === "string") {
      updates.description = updates.description.trim();
    }

    // Normalize weightGrams if present
    if (Object.prototype.hasOwnProperty.call(updates, "weightGrams")) {
      const raw = updates.weightGrams;
      if (raw === null || raw === "" || typeof raw === "undefined") {
        updates.weightGrams = undefined;
      } else {
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0) {
          return res.status(400).json({ message: "Invalid weightGrams." });
        }
        updates.weightGrams = n;
      }
    }

    // Normalize priceHint if present
    if (Object.prototype.hasOwnProperty.call(updates, "priceHint")) {
      const raw = updates.priceHint;
      if (raw === null || raw === "" || typeof raw === "undefined") {
        updates.priceHint = null;
      } else {
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0) {
          return res.status(400).json({ message: "Invalid priceHint." });
        }
        updates.priceHint = n;
      }
    }

    if (Array.isArray(updates.tags)) {
      updates.tags = updates.tags.filter(Boolean).map((t) => String(t).trim());
    }
    if (Array.isArray(updates.links)) {
      updates.links = updates.links.map((link) => ({
        network: link.network,
        region: link.region || "global",
        url: (link.url || "").trim(),
        merchantName: link.merchantName || undefined,
        externalId: link.externalId || undefined,
        priority: typeof link.priority === "number" ? link.priority : 0,
      }));
    }

    const item = await CatalogItem.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Catalog item not found." });
    }

    res.json(item);
  } catch (err) {
    console.error(`PATCH /api/admin/catalog-items/${req.params.id} error`, err);
    res.status(500).json({ message: "Failed to update catalog item." });
  }
});

// PATCH /api/admin/catalog-items/:id/archive
// Soft-delete / toggle visibility
router.patch("/:id/archive", async (req, res) => {
  try {
    const { isActive } = req.body || {};
    const nextIsActive = typeof isActive === "boolean" ? isActive : false;

    const item = await CatalogItem.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: nextIsActive } },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Catalog item not found." });
    }

    res.json(item);
  } catch (err) {
    console.error(
      `PATCH /api/admin/catalog-items/${req.params.id}/archive error`,
      err
    );
    res.status(500).json({ message: "Failed to update catalog item." });
  }
});

module.exports = router;
