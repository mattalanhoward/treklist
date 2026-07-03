// server/src/routes/adminCatalogItems.js
const express = require("express");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");
const GlobalItem = require("../models/globalItem");
const GearItem = require("../models/gearItem");
// const SortableItem = require("../models/sortableItem"); // <- if you have this model

// =============================================================================
// IMPORT ATTRIBUTE SCHEMAS FOR VALIDATION
// =============================================================================
const {
  isValidItemType,
  validateAttributes,
  getAllItemTypes,
} = require("../config/attributeSchemas");

const router = express.Router();

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

  // If no numbers AND no note => clear
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

  // cm only (default to cm if missing)
  const unit = String(unitRaw || "cm")
    .trim()
    .toLowerCase();
  if (!ALLOWED_DIM_UNITS.has(unit)) {
    return { error: 'Dimensions unit must be "cm".' };
  }

  // If numbers are partial, require note
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

// =============================================================================
// ATTRIBUTE VALIDATION HELPER
// =============================================================================
/**
 * Validates itemType and attributes before saving.
 * Admin saves are LENIENT (strict:false): provided values are validated
 * (enums/ranges enforced) but missing required fields don't block the save —
 * items are often mid-curation, and attributes that vary per variant (e.g. a
 * sleeping bag's temp rating) live on variant.attributes, not the base.
 * Returns { valid: true, itemType, attributes } or { valid: false, error: string }
 */
function validateItemTypeAndAttributes(itemType, attributes) {
  // Normalize itemType
  const normalizedItemType =
    itemType && typeof itemType === "string" ? itemType.trim() : null;

  // If no itemType, attributes should be empty or will be ignored
  if (!normalizedItemType) {
    return {
      valid: true,
      itemType: null,
      attributes: {}, // Clear attributes if no itemType
    };
  }

  // Validate itemType is in our schema
  if (!isValidItemType(normalizedItemType)) {
    const validTypes = getAllItemTypes().join(", ");
    return {
      valid: false,
      error: `Invalid item type: "${normalizedItemType}". Valid types are: ${validTypes}`,
    };
  }

  // Validate attributes against schema (lenient: see docblock)
  const attrs = attributes && typeof attributes === "object" ? attributes : {};
  const result = validateAttributes(normalizedItemType, attrs, {
    strict: false,
  });

  if (!result.valid) {
    return {
      valid: false,
      error: `Invalid attributes for ${normalizedItemType}: ${result.errors.join(", ")}`,
    };
  }

  // Return validated + derived attributes
  return {
    valid: true,
    itemType: normalizedItemType,
    attributes: result.cleaned,
  };
}

// =============================================================================
// VARIANT VALIDATION HELPER
// =============================================================================
/**
 * Normalizes { variantAxes, variants, defaultVariantKey } as one coherent set.
 * - axis names/values trimmed, deduped; every axis needs a name and values
 * - variant keys are REGENERATED from options in axis order (" / " separator)
 * - per-variant weights rounded to whole grams
 * - per-variant attributes validated leniently (enums/ranges enforced, required
 *   fields not) and replaced with the cleaned result
 * - defaultVariantKey coerced to an existing key (first variant as fallback)
 * Returns { error } or
 * { variantAxes, variants, defaultVariantKey, defaultWeightGrams }.
 */
function normalizeVariantSet({
  variantAxes,
  variants,
  defaultVariantKey,
  itemType,
}) {
  const axes = [];
  const seenAxis = new Set();
  for (const a of Array.isArray(variantAxes) ? variantAxes : []) {
    const name = String(a?.name ?? "").trim();
    if (!name) return { error: "Each variant axis needs a name." };
    if (seenAxis.has(name))
      return { error: `Duplicate variant axis "${name}".` };
    seenAxis.add(name);

    const values = [];
    const seenVal = new Set();
    for (const raw of Array.isArray(a?.values) ? a.values : []) {
      const val = String(raw ?? "").trim();
      if (!val || seenVal.has(val)) continue;
      seenVal.add(val);
      values.push(val);
    }
    if (!values.length)
      return { error: `Variant axis "${name}" has no values.` };
    axes.push({ name, values });
  }

  const rawVariants = Array.isArray(variants) ? variants : [];
  if (rawVariants.length && !axes.length) {
    return { error: "Variants require at least one variant axis." };
  }

  const outVariants = [];
  const seenKeys = new Set();
  for (const v of rawVariants) {
    const options =
      v?.options && typeof v.options === "object" ? v.options : {};
    const cleanOptions = {};
    const parts = [];
    for (const axis of axes) {
      const val = String(options[axis.name] ?? "").trim();
      if (!val) {
        return {
          error: `A variant is missing a value for axis "${axis.name}".`,
        };
      }
      if (!axis.values.includes(val)) {
        return {
          error: `Variant value "${val}" is not a value of axis "${axis.name}".`,
        };
      }
      cleanOptions[axis.name] = val;
      parts.push(val);
    }
    const key = parts.join(" / ");
    if (seenKeys.has(key)) return { error: `Duplicate variant "${key}".` };
    seenKeys.add(key);

    let weightGrams;
    if (
      v?.weightGrams !== undefined &&
      v?.weightGrams !== null &&
      v?.weightGrams !== ""
    ) {
      const n = Number(v.weightGrams);
      if (Number.isNaN(n) || n < 0) {
        return { error: `Invalid weight for variant "${key}".` };
      }
      weightGrams = Math.round(n);
    }

    let attributes;
    if (
      v?.attributes &&
      typeof v.attributes === "object" &&
      Object.keys(v.attributes).length
    ) {
      if (!itemType || !isValidItemType(itemType)) {
        return {
          error: "Set a valid item type before adding per-variant attributes.",
        };
      }
      const res = validateAttributes(itemType, v.attributes, {
        strict: false,
      });
      if (!res.valid) {
        return { error: `Variant "${key}": ${res.errors.join(", ")}` };
      }
      if (Object.keys(res.cleaned).length) attributes = res.cleaned;
    }

    const sku =
      v?.sku != null && String(v.sku).trim() ? String(v.sku).trim() : undefined;

    const imageUrls = Array.isArray(v?.imageUrls)
      ? v.imageUrls
          .filter((u) => typeof u === "string" && u.trim())
          .map((u) => u.trim())
      : undefined;

    const deepLink =
      v?.deepLink != null && String(v.deepLink).trim()
        ? String(v.deepLink).trim()
        : undefined;

    const description =
      v?.description != null && String(v.description).trim()
        ? String(v.description).trim()
        : undefined;

    outVariants.push({
      key,
      options: cleanOptions,
      weightGrams,
      sku,
      attributes,
      ...(imageUrls && imageUrls.length ? { imageUrls } : {}),
      ...(deepLink ? { deepLink } : {}),
      ...(description ? { description } : {}),
    });
  }

  let defaultKey = String(defaultVariantKey || "").trim() || undefined;
  if (outVariants.length) {
    if (!defaultKey || !seenKeys.has(defaultKey))
      defaultKey = outVariants[0].key;
  } else {
    defaultKey = undefined;
  }

  const def = defaultKey
    ? outVariants.find((x) => x.key === defaultKey)
    : undefined;

  return {
    variantAxes: axes,
    variants: outVariants,
    defaultVariantKey: defaultKey,
    defaultWeightGrams:
      def && typeof def.weightGrams === "number" ? def.weightGrams : undefined,
  };
}

// =============================================================================
// GET /api/admin/catalog-items
// =============================================================================
router.get("/", async (req, res) => {
  try {
    const {
      q,
      category,
      brand,
      itemType,
      isActive = "true",
      limit = 50,
      skip = 0,
      sortField = "updatedAt",
      sortDir = "desc",
    } = req.query;

    const query = {};
    if (isActive === "true") query.isActive = true;
    if (isActive === "false") query.isActive = false;
    if (category) query.category = category;
    if (itemType) query.itemType = itemType;
    if (brand) query.brandLC = brand.trim().toLowerCase();

    if (q && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
      query.$or = [{ name: regex }, { brand: regex }, { tags: regex }];
    }

    const sortSpec = {};
    if (sortField === "name") sortSpec.name = sortDir === "asc" ? 1 : -1;
    else if (sortField === "brand") sortSpec.brandLC = sortDir === "asc" ? 1 : -1;
    else sortSpec.updatedAt = sortDir === "desc" ? -1 : 1;

    const items = await CatalogItem.find(query)
      .sort(sortSpec)
      .skip(Number(skip) || 0)
      .limit(Math.min(Number(limit) || 50, 200))
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

// =============================================================================
// GET /api/admin/catalog-items/item-types
// NEW: Returns list of valid item types for dropdown
// =============================================================================
router.get("/item-types", async (req, res) => {
  try {
    const itemTypes = getAllItemTypes();
    res.json({ itemTypes });
  } catch (err) {
    console.error("GET /api/admin/catalog-items/item-types error", err);
    res.status(500).json({ message: "Failed to get item types." });
  }
});

// =============================================================================
// GET /api/admin/catalog-items/brands
// Distinct brands across the WHOLE catalog (active + archived) — powers the admin
// brand filter dropdown (which must not be limited to the current page of results).
// =============================================================================
router.get("/brands", async (req, res) => {
  try {
    const brands = (await CatalogItem.distinct("brand"))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    res.json({ brands });
  } catch (err) {
    console.error("GET /api/admin/catalog-items/brands error", err);
    res.status(500).json({ message: "Failed to get brands." });
  }
});

// =============================================================================
// POST /api/admin/catalog-items
// =============================================================================
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
      variantAxes,
      variants,
      defaultVariantKey,
    } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required." });
    }

    // =========================================================================
    // VALIDATE ITEM TYPE AND ATTRIBUTES
    // =========================================================================
    const attrValidation = validateItemTypeAndAttributes(itemType, attributes);
    if (!attrValidation.valid) {
      return res.status(400).json({ message: attrValidation.error });
    }

    // =========================================================================
    // VALIDATE VARIANTS (optional)
    // =========================================================================
    let variantSet = null;
    if (
      variantAxes !== undefined ||
      variants !== undefined ||
      defaultVariantKey !== undefined
    ) {
      variantSet = normalizeVariantSet({
        variantAxes,
        variants,
        defaultVariantKey,
        itemType: attrValidation.itemType,
      });
      if (variantSet.error) {
        return res.status(400).json({ message: variantSet.error });
      }
    }

    const rawOffers = Array.isArray(offers)
      ? offers
      : Array.isArray(req.body?.links)
        ? req.body.links
        : [];

    // Offers are OPTIONAL
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

      // If they attempted to add offers but none are valid, error
      if (sanitizedOffers.length === 0) {
        return res.status(400).json({
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
            .split(/\r?\n/)
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

    // =========================================================================
    // CREATE CATALOG ITEM
    // =========================================================================
    // Base weight tracks the default variant when variants are provided.
    if (
      normalizedWeight === undefined &&
      typeof variantSet?.defaultWeightGrams === "number"
    ) {
      normalizedWeight = variantSet.defaultWeightGrams;
    }

    const item = new CatalogItem({
      name: name.trim(),
      brand: brand && String(brand).trim(),
      category: category && String(category).trim(),
      subcategory: subcategory && String(subcategory).trim(),
      itemType: attrValidation.itemType, // Use validated itemType
      modelNumber: modelNumber && String(modelNumber).trim(),
      description: description && String(description).trim(),
      attributes: attrValidation.attributes, // Use validated + derived attributes
      imageUrls: normalizedImageUrls,
      weightGrams: normalizedWeight,
      ...(variantSet
        ? {
            variantAxes: variantSet.variantAxes,
            variants: variantSet.variants,
            defaultVariantKey: variantSet.defaultVariantKey,
          }
        : {}),
      dimensions: dimNorm.clear ? undefined : dimNorm.dimensions,
      tags: Array.isArray(tags)
        ? tags.filter(Boolean).map((t) => String(t).trim())
        : [],
      canonicalAsin: normalizedCanonicalAsin,
      itemGroupId: normalizedItemGroupId,
      createdBy: req.userId,
    });
    // The pre-save hook re-validates strictly by default; admin saves are
    // lenient (route already validated provided values above).
    item.$locals.lenientAttributes = true;
    await item.save();

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

    // Better error handling for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e) => e.message);
      return res.status(400).json({
        message: messages.length ? messages.join(", ") : err.message,
      });
    }

    res.status(500).json({ message: "Failed to create catalog item." });
  }
});

// =============================================================================
// PATCH /api/admin/catalog-items/:id
// =============================================================================
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
      "variantAxes",
      "variants",
      "defaultVariantKey",
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
    if (typeof updates.modelNumber === "string")
      updates.modelNumber = updates.modelNumber.trim();
    if (typeof updates.description === "string")
      updates.description = updates.description.trim();

    // =========================================================================
    // VALIDATE ITEM TYPE AND ATTRIBUTES
    // =========================================================================
    // We need to handle cases where:
    // 1. Both itemType and attributes are being updated
    // 2. Only itemType is being updated (need to fetch current attributes)
    // 3. Only attributes are being updated (need to fetch current itemType)
    // 4. Neither is being updated (skip validation)

    const hasItemType = Object.prototype.hasOwnProperty.call(
      req.body,
      "itemType",
    );
    const hasAttributes = Object.prototype.hasOwnProperty.call(
      req.body,
      "attributes",
    );

    if (hasItemType || hasAttributes) {
      let itemTypeToValidate = updates.itemType;
      let attributesToValidate = updates.attributes;

      // If only one is provided, fetch the other from the existing document
      if (hasItemType !== hasAttributes) {
        const existing = await CatalogItem.findById(req.params.id)
          .select("itemType attributes")
          .lean();

        if (!existing) {
          return res.status(404).json({ message: "Catalog item not found." });
        }

        if (!hasItemType) {
          itemTypeToValidate = existing.itemType;
        }
        if (!hasAttributes) {
          attributesToValidate = existing.attributes;
        }
      }

      const attrValidation = validateItemTypeAndAttributes(
        itemTypeToValidate,
        attributesToValidate,
      );

      if (!attrValidation.valid) {
        return res.status(400).json({ message: attrValidation.error });
      }

      // Use validated values
      updates.itemType = attrValidation.itemType;
      updates.attributes = attrValidation.attributes;
    }

    // =========================================================================
    // VALIDATE VARIANTS
    // =========================================================================
    // Variant fields are normalized as one coherent set: fields not present in
    // the payload are read from the existing document so a partial update (e.g.
    // only defaultVariantKey) can't leave axes/variants/default inconsistent.
    const hasVariantUpdate = [
      "variantAxes",
      "variants",
      "defaultVariantKey",
    ].some((k) => Object.prototype.hasOwnProperty.call(req.body, k));

    if (hasVariantUpdate) {
      const existing = await CatalogItem.findById(req.params.id)
        .select("itemType variantAxes variants defaultVariantKey")
        .lean();
      if (!existing) {
        return res.status(404).json({ message: "Catalog item not found." });
      }

      const effectiveItemType = hasItemType
        ? updates.itemType
        : existing.itemType;

      const variantSet = normalizeVariantSet({
        variantAxes: Object.prototype.hasOwnProperty.call(
          req.body,
          "variantAxes",
        )
          ? req.body.variantAxes
          : existing.variantAxes,
        variants: Object.prototype.hasOwnProperty.call(req.body, "variants")
          ? req.body.variants
          : existing.variants,
        defaultVariantKey: Object.prototype.hasOwnProperty.call(
          req.body,
          "defaultVariantKey",
        )
          ? req.body.defaultVariantKey
          : existing.defaultVariantKey,
        itemType: effectiveItemType,
      });
      if (variantSet.error) {
        return res.status(400).json({ message: variantSet.error });
      }

      updates.variantAxes = variantSet.variantAxes;
      updates.variants = variantSet.variants;
      if (variantSet.defaultVariantKey) {
        updates.defaultVariantKey = variantSet.defaultVariantKey;
      } else {
        updates.$unset = { ...(updates.$unset || {}), defaultVariantKey: 1 };
        delete updates.defaultVariantKey;
      }

      // Base weight tracks the default variant unless the payload sets it
      // explicitly.
      if (
        variantSet.variants.length &&
        typeof variantSet.defaultWeightGrams === "number" &&
        !Object.prototype.hasOwnProperty.call(req.body, "weightGrams")
      ) {
        updates.weightGrams = variantSet.defaultWeightGrams;
      }
    }

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

    // --- Sync GlobalItem templates ---
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

    // Better error handling for validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e) => e.message);
      return res.status(400).json({
        message: messages.length ? messages.join(", ") : err.message,
      });
    }

    return res.status(500).json({
      message: err?.message || "Failed to update catalog item.",
    });
  }
});

// =============================================================================
// PATCH /api/admin/catalog-items/:id/archive
// =============================================================================
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
