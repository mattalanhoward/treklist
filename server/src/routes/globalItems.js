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
const User = require("../models/user");
const MerchantOffer = require("../models/merchantOffer");

const router = express.Router();

// Protect all routes
router.use(auth);

function sanitizeAttributes(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};

  for (const [k, v] of Object.entries(input)) {
    const key = String(k || "").trim();
    if (!key) continue;
    if (key.length > 40) continue;

    const val = v == null ? "" : String(v).trim();
    if (!val) continue; // drop empty values
    if (val.length > 120) continue;

    out[key] = val;
  }

  return out;
}

function normalizeExternalProductId(v) {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function pickBestOffer(offers, userRegion) {
  const list = Array.isArray(offers) ? offers : [];
  const scored = list
    .map((o) => {
      const region = String(o.region || "global").toLowerCase();
      const regionScore =
        region === userRegion ? 2 : region === "global" ? 1 : 0;
      const priority = Number(o.priority) || 0;
      return { o, regionScore, priority };
    })
    .filter((x) => x.regionScore > 0);

  scored.sort((a, b) => {
    if (a.regionScore !== b.regionScore) return b.regionScore - a.regionScore;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return 0;
  });

  return scored[0]?.o || null;
}

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
router.post(
  "/",
  [
    body("name").isString().isLength({ min: 1, max: 200 }).trim(),
    body("brand").optional().isString().isLength({ max: 120 }).trim(),
    body("description").optional().isString().isLength({ max: 5000 }).trim(),
    body("category").optional().isString().isLength({ max: 120 }).trim(),
    body("itemType").optional().isString().isLength({ max: 120 }).trim(),
    body("weight").optional().isFloat({ min: 0 }),
    body("link").optional().isString().isLength({ max: 2000 }).trim(),

    // ✅ A) attributes validator
    body("attributes")
      .optional()
      .custom((v) => {
        if (typeof v !== "object" || Array.isArray(v)) {
          throw new Error("attributes must be an object");
        }
        return true;
      }),

    body("worn").optional().isBoolean(),
    body("consumable").optional().isBoolean(),
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
      const allowedSources = [
        "user",
        "heuristic",
        "scraped",
        "catalog",
        "verified",
      ];

      const bodyIn = { ...req.body };

      // keep your existing weightSource cleanup
      if (
        typeof bodyIn.weightSource === "string" &&
        !allowedSources.includes(bodyIn.weightSource)
      ) {
        delete bodyIn.weightSource;
      }

      // ✅ B) sanitize attributes before saving
      if (Object.prototype.hasOwnProperty.call(bodyIn, "attributes")) {
        bodyIn.attributes = sanitizeAttributes(bodyIn.attributes);
      }

      const newItem = await GlobalItem.create({ owner: req.userId, ...bodyIn });
      res.status(201).json(newItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/global/items/:id — update template & cascade to GearItem instances
router.patch("/:id", async (req, res) => {
  try {
    const current = await GlobalItem.findOne({
      _id: req.params.id,
      owner: req.userId,
    });

    if (!current) {
      return res.status(404).json({ message: "Global item not found." });
    }

    const isAffiliateBacked =
      Boolean(current.productId) || Boolean(current?.affiliate?.network);

    // Lock fields for imported items (catalog/affiliate-backed)
    if (isAffiliateBacked) {
      const IMMUTABLE_IMPORTED = ["name", "brand", "description", "itemType"];
      for (const k of IMMUTABLE_IMPORTED) {
        if (Object.prototype.hasOwnProperty.call(req.body, k)) {
          delete req.body[k];
        }
      }
      // Link is custom-only
      if (Object.prototype.hasOwnProperty.call(req.body, "link")) {
        delete req.body.link;
      }
    }

    const allowed = [
      "category",
      "itemType",
      "name",
      "brand",
      "description",
      "weight",
      "link",
    ];

    // Ignore attributes in this endpoint (you said you don't want it editable here)
    if (Object.prototype.hasOwnProperty.call(req.body, "attributes")) {
      delete req.body.attributes;
    }

    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    // ---- Weight validation + weightSource logic ----
    if (Object.prototype.hasOwnProperty.call(updates, "weight")) {
      const raw = updates.weight;

      let nextWeight = null;
      if (raw === "" || raw === undefined) nextWeight = null;
      else if (raw === null) nextWeight = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ message: "Invalid weight." });
        }
        nextWeight = n;
      }

      // Only change weightSource if weight actually changes
      const currWeight = current.weight ?? null;
      const same =
        (currWeight === null && nextWeight === null) ||
        (typeof currWeight === "number" &&
          typeof nextWeight === "number" &&
          currWeight === nextWeight);

      updates.weight = nextWeight;

      if (!same) {
        updates.weightSource = "user";
      }
    }

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
      attributes: updated.attributes,
    };

    // Only cascade link for custom items
    if (!isAffiliateBacked) {
      cascade.link = updated.link;
    }

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

    // ---- Region (secure, from user profile) ----
    // NOTE: requires: const User = require("../models/user");
    const user = await User.findById(req.userId).select("region").lean();

    const normalizeRegion = (region) => {
      if (!region) return "global";
      const r = String(region).trim().toLowerCase();
      if (r === "netherlands") return "nl";
      if (r === "united states" || r === "usa") return "us";
      if (r.length === 2) return r;
      return r;
    };

    const userRegion = normalizeRegion(user?.region);

    // Load catalog items (only active)
    const catalogItems = await CatalogItem.find({
      _id: { $in: cleanIds },
      isActive: true,
    }).lean();

    const catalogIds = catalogItems.map((c) => c._id);

    // ---- Load MerchantOffers for these products for user's region + global ----
    const offers = await MerchantOffer.find({
      productId: { $in: catalogIds },
      region: { $in: ["global", userRegion] },
    }).lean();

    const offersByProductId = new Map();
    for (const o of offers) {
      const key = String(o.productId);
      const arr = offersByProductId.get(key) || [];
      arr.push(o);
      offersByProductId.set(key, arr);
    }

    const pickBestOffer = (list) => {
      if (!Array.isArray(list) || list.length === 0) return null;

      // Prefer user's region over global, then higher priority.
      // If still tied, prefer most recently updated/created.
      return list.slice().sort((a, b) => {
        const aRegionScore = a.region === userRegion ? 2 : 1; // global=1
        const bRegionScore = b.region === userRegion ? 2 : 1;

        if (aRegionScore !== bRegionScore) return bRegionScore - aRegionScore;

        const ap = typeof a.priority === "number" ? a.priority : 0;
        const bp = typeof b.priority === "number" ? b.priority : 0;
        if (ap !== bp) return bp - ap;

        const at = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const bt = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
        return bt - at;
      })[0];
    };

    // Existing imports for this owner
    const existing = await GlobalItem.find({
      owner: req.userId,
      productId: { $in: catalogIds },
    })
      .select("_id productId")
      .lean();

    const existingSet = new Set(existing.map((g) => String(g.productId)));

    // Prepare upsert operations (idempotent, safe in races due to unique index)
    const ops = catalogItems
      .filter((c) => !existingSet.has(String(c._id)))
      .map((c) => {
        const bestOffer = pickBestOffer(
          offersByProductId.get(String(c._id)) || []
        );

        const resolved = bestOffer
          ? {
              network: bestOffer.network,
              region: bestOffer.region || "global",
              deepLink: bestOffer.deepLink,
              merchantId: bestOffer.merchantId,
              merchantName: bestOffer.merchantName || "",
              externalProductId: normalizeExternalProductId(
                bestOffer.externalProductId
              ),
              itemGroupId: bestOffer.itemGroupId || c.itemGroupId || undefined,
              priority:
                typeof bestOffer.priority === "number" ? bestOffer.priority : 0,
            }
          : null;

        const payload = {
          owner: req.userId,
          productId: c._id,
          name: c.name,
          brand: c.brand,
          itemType: c.itemType || c.subcategory || c.category || null,
          description: c.description,
          weight: c.weightGrams,
          attributes: sanitizeAttributes(c.attributes),
          ...(typeof c.weightGrams === "number" && { weightSource: "catalog" }),
          tags: c.tags,
          catalogCategory: c.category || null,
          catalogSubcategory: c.subcategory || null,

          // link is ONLY for custom items; catalog-backed resolves via MerchantOffer
          link: null,

          // Affiliate metadata for routing / immutability rules
          affiliate: resolved
            ? {
                network: resolved.network,
                region: resolved.region,
                deepLink: resolved.deepLink,
                merchantId: resolved.merchantId,
                merchantName: resolved.merchantName,
                ...(resolved.externalProductId
                  ? { externalProductId: resolved.externalProductId }
                  : {}),
                itemGroupId: resolved.itemGroupId,
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
      productId: { $in: catalogIds },
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

    // choose best offer (region-aware)
    const user = await User.findById(req.userId).select("region").lean();
    const userRegion = (user?.region || "global")
      .toString()
      .trim()
      .toLowerCase();

    const offers = await MerchantOffer.find({
      productId: catalogItem._id,
      region: { $in: ["global", userRegion] },
    }).lean();

    const primaryOffer = pickBestOffer(offers, userRegion);

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
      attributes: sanitizeAttributes(catalogItem.attributes),
      // weight (+ mark it as coming from catalog if present)
      weight: catalogItem.weightGrams,
      ...(typeof catalogItem.weightGrams === "number" && {
        weightSource: "catalog",
      }),
      tags: catalogItem.tags,
      category: catalogItem.category || null,
      subcategory: catalogItem.subcategory || null,
      // link is ONLY for custom items; catalog-backed resolves via MerchantOffer
      link: null,
      // affiliate metadata for future routing
      affiliate: primaryOffer
        ? {
            network: primaryOffer.network,
            region: primaryOffer.region || "global",
            deepLink: primaryOffer.deepLink,
            merchantName: primaryOffer.merchantName || "",
            merchantId: primaryOffer.merchantId || "",
            ...(normalizeExternalProductId(primaryOffer.externalProductId)
              ? {
                  externalProductId: normalizeExternalProductId(
                    primaryOffer.externalProductId
                  ),
                }
              : {}),
            itemGroupId:
              primaryOffer.itemGroupId || catalogItem.itemGroupId || undefined,
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
