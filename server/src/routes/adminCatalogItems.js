// server/src/routes/adminCatalogItems.js
const express = require("express");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");
const GlobalItem = require("../models/globalItem");
const GearItem = require("../models/gearItem");
// const SortableItem = require("../models/sortableItem"); // <- if you have this model

const router = express.Router();

const ALLOWED_DIM_UNITS = new Set(["cm"]);

function marketplaceFromAmazonUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const h = host.replace(/^smile\./, "").replace(/^www\./, "");
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

function slugifyMerchantId(network, merchantName) {
  const base = (merchantName || "unknown")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${network}-${base || "unknown"}`;
}

function deriveAmazonMerchantIdFromDeepLink(deepLink) {
  const marketplace = marketplaceFromAmazonUrl(deepLink);
  return marketplace ? `amazon-${marketplace}` : "amazon-unknown";
}

function extractAmazonAsinFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname || "";
    const m =
      path.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
      path.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

function sanitizeOffers(rawOffers, { fallbackAsin, fallbackItemGroupId } = {}) {
  const offers = Array.isArray(rawOffers) ? rawOffers : [];

  return offers
    .map((o) => {
      const network = String(o.network || "")
        .trim()
        .toLowerCase();
      const region = String(o.region || "global")
        .trim()
        .toLowerCase();
      const deepLink = String(o.deepLink || o.url || "").trim();
      const merchantName = o.merchantName
        ? String(o.merchantName).trim()
        : undefined;

      let externalProductIdRaw =
        o.externalProductId ?? o.externalId ?? undefined;

      if (!externalProductIdRaw && network === "amazon" && deepLink) {
        externalProductIdRaw = extractAmazonAsinFromUrl(deepLink);
      }
      if (!externalProductIdRaw)
        externalProductIdRaw = fallbackAsin ?? undefined;

      const externalProductId =
        externalProductIdRaw != null && String(externalProductIdRaw).trim()
          ? String(externalProductIdRaw).trim()
          : undefined;

      let merchantId =
        o.merchantId != null && String(o.merchantId).trim()
          ? String(o.merchantId).trim()
          : undefined;

      if (!merchantId) {
        if (network === "amazon")
          merchantId = deriveAmazonMerchantIdFromDeepLink(deepLink);
        else merchantId = slugifyMerchantId(network, merchantName);
      }

      const priority = Number.isFinite(o.priority)
        ? o.priority
        : Number(o.priority) || 0;

      return {
        network,
        region,
        merchantId,
        merchantName,
        externalProductId,
        deepLink,
        priority,
        itemGroupId:
          o.itemGroupId != null && String(o.itemGroupId).trim()
            ? String(o.itemGroupId).trim()
            : fallbackItemGroupId,
      };
    })
    .filter((o) => o.network && o.deepLink);
}

function normalizeDimensions(raw) {
  if (raw === undefined) return { dimensions: undefined, clear: false };
  if (raw === null) return { dimensions: null, clear: true };

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Invalid dimensions format." };
  }

  const lengthRaw = raw.length;
  const widthRaw = raw.width;
  const heightRaw = raw.height;
  const unitRaw = raw.unit;
  const noteRaw = raw.note;

  const note =
    typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : undefined;

  const hasAnyNum =
    (lengthRaw !== undefined && lengthRaw !== "" && lengthRaw !== null) ||
    (widthRaw !== undefined && widthRaw !== "" && widthRaw !== null) ||
    (heightRaw !== undefined && heightRaw !== "" && heightRaw !== null);

  // ✅ If no numbers AND no note => clear
  if (!hasAnyNum && !note) return { dimensions: null, clear: true };

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

  // ✅ cm only (default to cm if missing)
  const unit = String(unitRaw || "cm")
    .trim()
    .toLowerCase();
  if (!ALLOWED_DIM_UNITS.has(unit)) {
    return { error: 'Dimensions unit must be "cm".' };
  }

  // ✅ If numbers are partial, require note
  const hasAllNums =
    length !== undefined && width !== undefined && height !== undefined;
  if (hasAnyNum && !hasAllNums && !note) {
    return {
      error:
        'Partial dimensions require a note (e.g. "varies by size", "packed", "approximate").',
    };
  }

  return {
    dimensions: {
      length,
      width,
      height,
      unit: "cm",
      ...(note ? { note } : {}),
    },
    clear: false,
  };
}

// GET /api/admin/catalog-items
router.get("/", async (req, res) => {
  try {
    const { q, category, isActive = "true", limit = 100, skip = 0 } = req.query;

    const query = {};
    if (isActive === "true") query.isActive = true;
    if (isActive === "false") query.isActive = false;
    if (category) query.category = category;

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      query.$or = [{ name: regex }, { brand: regex }, { tags: regex }];
    }

    const items = await CatalogItem.find(query)
      .sort({ updatedAt: -1 })
      .skip(Number(skip) || 0)
      .limit(Math.min(Number(limit) || 100, 200))
      .lean();

    const ids = items.map((i) => i._id);

    const offers = await MerchantOffer.find({ productId: { $in: ids } }).lean();
    const offersByProduct = new Map();
    for (const o of offers) {
      const key = String(o.productId);
      if (!offersByProduct.has(key)) offersByProduct.set(key, []);
      offersByProduct.get(key).push(o);
    }

    const total = await CatalogItem.countDocuments(query);

    res.json({
      items: items.map((it) => ({
        ...it,
        offers: (offersByProduct.get(String(it._id)) || []).sort(
          (a, b) => (b.priority || 0) - (a.priority || 0),
        ),
      })),
      total,
    });
  } catch (err) {
    console.error("GET /api/admin/catalog-items error", err);
    res.status(500).json({ message: "Failed to load catalog items." });
  }
});

// POST /api/admin/catalog-items
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
      offers,
      canonicalAsin,
      itemGroupId,
      attributes,
    } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required." });
    }

    const rawOffers = Array.isArray(offers)
      ? offers
      : Array.isArray(req.body?.links)
        ? req.body.links
        : [];

    // ✅ Offers are OPTIONAL now
    let sanitizedOffers = [];
    if (Array.isArray(rawOffers) && rawOffers.length > 0) {
      sanitizedOffers = sanitizeOffers(rawOffers, {
        fallbackAsin:
          typeof canonicalAsin === "string" && canonicalAsin.trim()
            ? canonicalAsin.trim().toUpperCase()
            : undefined,
        fallbackItemGroupId:
          typeof itemGroupId === "string" && itemGroupId.trim()
            ? itemGroupId.trim()
            : undefined,
      });

      // ✅ If they attempted to add offers but none are valid, error
      if (sanitizedOffers.length === 0) {
        return res
          .status(400)
          .json({
            message: "Each offer must have a network and deepLink/url.",
          });
      }
    }

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
    if (dimNorm?.error) return res.status(400).json({ message: dimNorm.error });

    const item = await CatalogItem.create({
      name: name.trim(),
      brand: brand && String(brand).trim(),
      category: category && String(category).trim(),
      subcategory: subcategory && String(subcategory).trim(),
      itemType: itemType && String(itemType).trim(),
      modelNumber: modelNumber && String(modelNumber).trim(),
      description: description && String(description).trim(),
      attributes:
        attributes &&
        typeof attributes === "object" &&
        !Array.isArray(attributes)
          ? attributes
          : undefined,
      imageUrls: normalizedImageUrls,
      weightGrams: normalizedWeight,
      dimensions: dimNorm.clear ? undefined : dimNorm.dimensions,
      tags: Array.isArray(tags)
        ? tags.filter(Boolean).map((t) => String(t).trim())
        : [],
      canonicalAsin: normalizedCanonicalAsin,
      itemGroupId: normalizedItemGroupId,
      createdBy: req.userId,
    });

    const offerOps = sanitizedOffers.map((o) => ({
      updateOne: {
        filter: {
          productId: item._id,
          network: o.network,
          region: o.region,
          merchantId: o.merchantId,
        },
        update: {
          $set: {
            network: o.network,
            region: o.region,
            merchantId: o.merchantId,
            merchantName:
              o.merchantName || (o.network === "amazon" ? "Amazon" : undefined),
            productId: item._id,
            itemGroupId: o.itemGroupId || normalizedItemGroupId,
            externalProductId: o.externalProductId,
            deepLink: o.deepLink,
            priority: o.priority,
          },
        },
        upsert: true,
      },
    }));

    if (offerOps.length)
      await MerchantOffer.bulkWrite(offerOps, { ordered: false });

    res.status(201).json(item);
  } catch (err) {
    console.error("POST /api/admin/catalog-items error", err);
    res.status(500).json({ message: "Failed to create catalog item." });
  }
});

// PATCH /api/admin/catalog-items/:id
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
      "attributes",
      "imageUrls",
      "weightGrams",
      "dimensions",
      "tags",
      "offers", // handled separately
      "isActive",
      "canonicalAsin",
      "itemGroupId",
    ];

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (typeof updates.name === "string") updates.name = updates.name.trim();
    if (typeof updates.brand === "string") updates.brand = updates.brand.trim();
    if (typeof updates.category === "string")
      updates.category = updates.category.trim();
    if (typeof updates.subcategory === "string")
      updates.subcategory = updates.subcategory.trim();
    if (typeof updates.itemType === "string")
      updates.itemType = updates.itemType.trim();
    if (typeof updates.modelNumber === "string")
      updates.modelNumber = updates.modelNumber.trim();
    if (typeof updates.description === "string")
      updates.description = updates.description.trim();

    // Dimensions (allow clear)
    if (Object.prototype.hasOwnProperty.call(updates, "dimensions")) {
      const dimNorm = normalizeDimensions(updates.dimensions);
      if (dimNorm?.error)
        return res.status(400).json({ message: dimNorm.error });
      if (dimNorm.clear) {
        updates.$unset = { ...(updates.$unset || {}), dimensions: 1 };
        delete updates.dimensions;
      } else {
        updates.dimensions = dimNorm.dimensions;
      }
    }

    // canonicalAsin (allow clear)
    if (Object.prototype.hasOwnProperty.call(updates, "canonicalAsin")) {
      const v = String(updates.canonicalAsin || "").trim();
      if (!v) {
        updates.$unset = { ...(updates.$unset || {}), canonicalAsin: 1 };
        delete updates.canonicalAsin;
      } else {
        updates.canonicalAsin = v.toUpperCase();
      }
    }

    // itemGroupId (allow clear)
    if (Object.prototype.hasOwnProperty.call(updates, "itemGroupId")) {
      const v = String(updates.itemGroupId || "").trim();
      if (!v) {
        updates.$unset = { ...(updates.$unset || {}), itemGroupId: 1 };
        delete updates.itemGroupId;
      } else {
        updates.itemGroupId = v;
      }
    }

    // weightGrams
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

    // tags
    if (Array.isArray(updates.tags)) {
      updates.tags = updates.tags.filter(Boolean).map((t) => String(t).trim());
    }

    // imageUrls
    if (Array.isArray(updates.imageUrls)) {
      updates.imageUrls = updates.imageUrls
        .map((u) => String(u || "").trim())
        .filter(Boolean);
    }

    // Offers → MerchantOffer
    let incomingOffers;
    if (Object.prototype.hasOwnProperty.call(req.body, "offers")) {
      incomingOffers = sanitizeOffers(req.body.offers, {
        fallbackAsin:
          typeof updates.canonicalAsin === "string" && updates.canonicalAsin
            ? updates.canonicalAsin
            : undefined,
        fallbackItemGroupId:
          typeof updates.itemGroupId === "string" && updates.itemGroupId.trim()
            ? updates.itemGroupId.trim()
            : undefined,
      });
    }

    // Never store offers on CatalogItem
    if (Object.prototype.hasOwnProperty.call(updates, "offers"))
      delete updates.offers;

    const $set = { ...updates };
    const $unset = $set.$unset;
    delete $set.$unset;

    const updateDoc = $unset ? { $set, $unset } : { $set };

    const item = await CatalogItem.findByIdAndUpdate(req.params.id, updateDoc, {
      new: true,
      runValidators: true,
    });
    if (!item)
      return res.status(404).json({ message: "Catalog item not found." });

    // --- Sync GlobalItem templates (GlobalItem.category is a STRING in your app, so it's safe) ---
    await GlobalItem.updateMany(
      { productId: item._id },
      {
        $set: {
          name: item.name,
          brand: item.brand,
          itemType: item.itemType || item.subcategory || item.category || null,
          description: item.description || "",
          catalogCategory: item.category || null,
          catalogSubcategory: item.subcategory || null,
          tags: Array.isArray(item.tags) ? item.tags : [],
          attributes: item.attributes || {},
        },
      },
    );

    // Find global template ids tied to this product
    const globals = await GlobalItem.find({ productId: item._id })
      .select("_id")
      .lean();
    const globalIds = globals.map((g) => g._id);

    // --- Sync GearItems in lists ---
    // IMPORTANT: GearItem.category is likely ObjectId -> do NOT set it from a string like "Shelter"
    let gearItemSyncResult = null;

    if (globalIds.length) {
      const syncSet = {
        name: item.name,
        brand: item.brand,
        itemType: item.itemType || item.subcategory || item.category || null,
        description: item.description || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        attributes: item.attributes || {},
      };

      gearItemSyncResult = await GearItem.updateMany(
        {
          $or: [
            { globalItem: { $in: globalIds } },
            { globalItemId: { $in: globalIds } },
            { productId: item._id },
            { catalogItemId: item._id },
            { sourceProductId: item._id },
          ],
        },
        { $set: syncSet },
      );

      // If you have SortableItem, sync it too (same caution re: category)
      /*
      await SortableItem.updateMany(
        { globalItem: { $in: globalIds } },
        { $set: syncSet }
      );
      */
    }

    // Replace MerchantOffers if provided
    if (incomingOffers) {
      await MerchantOffer.deleteMany({ productId: item._id });

      if (incomingOffers.length) {
        await MerchantOffer.insertMany(
          incomingOffers.map((o) => ({
            network: o.network,
            region: o.region,
            merchantId:
              o.merchantId ||
              (o.network === "amazon" ? "amazon-us" : o.network),
            merchantName:
              o.merchantName || (o.network === "amazon" ? "Amazon" : undefined),
            productId: item._id,
            itemGroupId: o.itemGroupId || item.itemGroupId,
            externalProductId: o.externalProductId,
            deepLink: o.deepLink,
            priority: o.priority,
          })),
          { ordered: false },
        );
      }
    }

    const offers = await MerchantOffer.find({ productId: item._id }).lean();
    offers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return res.json({
      item: item.toObject(),
      offers,
      synced: {
        gearItemsMatched: gearItemSyncResult?.matchedCount ?? null,
        gearItemsModified: gearItemSyncResult?.modifiedCount ?? null,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/catalog-items/:id error", err);
    return res.status(500).json({
      message: err?.message || "Failed to update catalog item.",
    });
  }
});

// PATCH /api/admin/catalog-items/:id/archive
router.patch("/:id/archive", async (req, res) => {
  try {
    const { isActive } = req.body || {};
    const nextIsActive = typeof isActive === "boolean" ? isActive : false;

    const item = await CatalogItem.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: nextIsActive } },
      { new: true },
    );

    if (!item)
      return res.status(404).json({ message: "Catalog item not found." });

    res.json(item);
  } catch (err) {
    console.error(
      `PATCH /api/admin/catalog-items/${req.params.id}/archive error`,
      err,
    );
    res.status(500).json({ message: "Failed to update catalog item." });
  }
});

module.exports = router;
