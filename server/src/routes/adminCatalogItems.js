// server/src/routes/adminCatalogItems.js
const express = require("express");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const router = express.Router();

const ALLOWED_DIM_UNITS = new Set(["cm", "in"]);

function marketplaceFromAmazonUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();

    // normalize
    const h = host.replace(/^smile\./, "").replace(/^www\./, "");

    // match common Amazon domains
    if (h === "amazon.com") return "us";
    if (h === "amazon.co.uk") return "uk";
    if (h === "amazon.de") return "de";
    if (h === "amazon.fr") return "fr";
    if (h === "amazon.it") return "it";
    if (h === "amazon.es") return "es";
    if (h === "amazon.nl") return "nl";
    if (h === "amazon.ca") return "ca";
    if (h === "amazon.se") return "se";
    if (h === "amazon.pl") return "pl";

    return null;
  } catch {
    return null;
  }
}

function normalizeDimensions(raw) {
  // raw can be: undefined (ignore), null (clear), or an object
  if (raw === undefined) return { dimensions: undefined, clear: false };
  if (raw === null) return { dimensions: null, clear: true };

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid dimensions format." };
  }

  const lengthRaw = raw.length;
  const widthRaw = raw.width;
  const heightRaw = raw.height;
  const unitRaw = raw.unit;

  const hasAny =
    (lengthRaw !== undefined && lengthRaw !== "" && lengthRaw !== null) ||
    (widthRaw !== undefined && widthRaw !== "" && widthRaw !== null) ||
    (heightRaw !== undefined && heightRaw !== "" && heightRaw !== null);

  if (!hasAny) {
    // treat “all blank” as “clear”
    return { dimensions: null, clear: true };
  }

  const toNum = (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return "__INVALID__";
    return n;
  };

  const length = toNum(lengthRaw);
  const width = toNum(widthRaw);
  const height = toNum(heightRaw);
  if (
    length === "__INVALID__" ||
    width === "__INVALID__" ||
    height === "__INVALID__"
  ) {
    return {
      error: "Dimensions length/width/height must be non-negative numbers.",
    };
  }

  const unit = String(unitRaw || "cm")
    .trim()
    .toLowerCase();
  if (!ALLOWED_DIM_UNITS.has(unit)) {
    return { error: 'Dimensions unit must be "cm" or "in".' };
  }

  return {
    dimensions: { length, width, height, unit },
    clear: false,
  };
}

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
      subcategory,
      itemType,
      modelNumber,
      description,
      imageUrls,
      weightGrams,
      dimensions,
      tags,
      links,
      canonicalAsin,
      itemGroupId,
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

    const normalizedImageUrls = Array.isArray(imageUrls)
      ? imageUrls.map((u) => String(u || "").trim()).filter(Boolean)
      : typeof imageUrls === "string"
      ? imageUrls
          .split(/\r?\n|,/)
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const normalizedCanonicalAsin =
      typeof canonicalAsin === "string" && canonicalAsin.trim()
        ? canonicalAsin.trim().toUpperCase()
        : undefined;

    const normalizedItemGroupId =
      typeof itemGroupId === "string" && itemGroupId.trim()
        ? itemGroupId.trim()
        : undefined;

    const dimNorm = normalizeDimensions(dimensions);
    if (dimNorm?.error) {
      return res.status(400).json({ message: dimNorm.error });
    }

    const item = await CatalogItem.create({
      name: name.trim(),
      brand: brand && brand.trim(),
      category: category && category.trim(),
      subcategory: subcategory && subcategory.trim(),
      itemType: itemType && itemType.trim(),
      modelNumber: modelNumber && modelNumber.trim(),
      description: description && description.trim(),
      imageUrls: normalizedImageUrls,
      weightGrams: normalizedWeight,
      dimensions: dimNorm.clear ? undefined : dimNorm.dimensions,
      tags: Array.isArray(tags)
        ? tags.filter(Boolean).map((t) => String(t).trim())
        : [],
      links: sanitizedLinks,
      canonicalAsin: normalizedCanonicalAsin,
      itemGroupId: normalizedItemGroupId,
      createdBy: req.userId,
    });

    // Also upsert MerchantOffer rows from legacy links[]
    // This keeps your system "Offers-first" while still storing links for backwards compat.
    const offerOps = sanitizedLinks.map((l) => {
      const network = String(l.network || "")
        .trim()
        .toLowerCase();
      const region = String(l.region || "global")
        .trim()
        .toLowerCase();
      const deepLink = String(l.url || "").trim();
      const merchantName = l.merchantName
        ? String(l.merchantName).trim()
        : undefined;
      const externalProductId = l.externalId
        ? String(l.externalId).trim()
        : normalizedCanonicalAsin || undefined;

      // Prefer stable merchantId when we can
      // - Amazon: if region matches a marketplace code, use `amazon-us`, `amazon-uk`, etc.
      // - Otherwise fall back to `${network}-${merchantName || "unknown"}`
      let merchantId;
      if (network === "amazon") {
        const marketplace = marketplaceFromAmazonUrl(deepLink);
        merchantId = marketplace ? `amazon-${marketplace}` : "amazon-unknown";
      } else {
        merchantId = `${network}-${(merchantName || "unknown")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}`;
      }

      return {
        updateOne: {
          filter: {
            network,
            region,
            merchantId,
            externalProductId: externalProductId || deepLink, // last-resort uniqueness fallback
          },
          update: {
            $set: {
              network,
              region,
              merchantId,
              merchantName:
                merchantName || (network === "amazon" ? "Amazon" : undefined),
              productId: item._id,
              itemGroupId: normalizedItemGroupId,
              externalProductId: externalProductId || undefined,
              deepLink,
              priority: typeof l.priority === "number" ? l.priority : 0,
            },
          },
          upsert: true,
        },
      };
    });

    if (offerOps.length) {
      // unordered so one bad op doesn't block others
      await MerchantOffer.bulkWrite(offerOps, { ordered: false });
    }

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
      "subcategory",
      "itemType",
      "modelNumber",
      "description",
      "imageUrls",
      "weightGrams",
      "dimensions",
      "tags",
      "links",
      "isActive",
      "canonicalAsin",
      "itemGroupId",
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
    if (typeof updates.subcategory === "string") {
      updates.subcategory = updates.subcategory.trim();
    }
    if (typeof updates.itemType === "string") {
      updates.itemType = updates.itemType.trim();
    }
    if (typeof updates.modelNumber === "string") {
      updates.modelNumber = updates.modelNumber.trim();
    }
    if (typeof updates.description === "string") {
      updates.description = updates.description.trim();
    }

    // Normalize dimensions if present (allow clearing)
    if (Object.prototype.hasOwnProperty.call(updates, "dimensions")) {
      const dimNorm = normalizeDimensions(updates.dimensions);
      if (dimNorm?.error) {
        return res.status(400).json({ message: dimNorm.error });
      }
      if (dimNorm.clear) {
        updates.$unset = { ...(updates.$unset || {}), dimensions: 1 };
        delete updates.dimensions;
      } else {
        updates.dimensions = dimNorm.dimensions;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "canonicalAsin")) {
      const v = String(updates.canonicalAsin || "").trim();
      if (!v) {
        updates.$unset = { ...(updates.$unset || {}), canonicalAsin: 1 };
        delete updates.canonicalAsin;
      } else updates.canonicalAsin = v.toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(updates, "itemGroupId")) {
      const v = String(updates.itemGroupId || "").trim();
      if (!v) {
        updates.$unset = { ...(updates.$unset || {}), itemGroupId: 1 };
        delete updates.itemGroupId;
      } else updates.itemGroupId = v;
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

    // Normalize imageUrls if present
    if (Array.isArray(updates.imageUrls)) {
      updates.imageUrls = updates.imageUrls
        .map((u) => String(u || "").trim())
        .filter(Boolean);
    }

    // Split operators: $set + $unset (if present)
    const $set = { ...updates };
    const $unset = $set.$unset;
    delete $set.$unset;

    const updateDoc = $unset ? { $set, $unset } : { $set };

    const item = await CatalogItem.findByIdAndUpdate(req.params.id, updateDoc, {
      new: true,
    });

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
