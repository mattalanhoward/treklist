const mongoose = require("mongoose");

// =============================================================================
// IMPORT ATTRIBUTE SCHEMAS FOR VALIDATION
// =============================================================================
const {
  getAllItemTypes,
  isValidItemType,
  validateAttributes,
} = require("../config/attributeSchemas");

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function cleanString(val) {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s ? s : undefined;
}

function cleanUpper(val) {
  const s = cleanString(val);
  return s ? s.toUpperCase() : undefined;
}

function cleanStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    const s = cleanString(raw);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// =============================================================================
// SUB-SCHEMAS
// =============================================================================

const DimensionsSchema = new mongoose.Schema(
  {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { type: String, enum: ["cm"], default: "cm" },
    note: { type: String, trim: true },
  },
  { _id: false },
);

// -----------------------------------------------------------------------------
// VARIANT SUB-SCHEMAS
// -----------------------------------------------------------------------------
// A product can ship in selectable variants (e.g. a quilt in Temperature × Size).
// Each variant carries its OWN weight/sku because weight varies a lot between
// variants (a 10F Broad-Long quilt is ~2x a 30F Slim-Short). The user picks a
// variant on their GlobalItem; that drives the weight in their lists.
//
// `variantAxes` are the selectable dimensions (Color is intentionally dropped at
// import time — it doesn't change weight). `variants` is the flattened matrix.
// `defaultVariantKey` selects which variant's weight represents the product in
// previews before the user has chosen.
// -----------------------------------------------------------------------------

const VariantAxisSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Temperature"
    values: { type: [String], default: [] }, // e.g. ["30F (-1C)", "20F (-7C)"]
  },
  { _id: false },
);

const VariantSchema = new mongoose.Schema(
  {
    // Stable identifier = meaningful option values joined by " / ".
    // e.g. "20F (-7C) / Standard-Short". GlobalItem.variantKey references this.
    key: { type: String, required: true, trim: true },

    // Map of axis name -> chosen value, e.g. { Temperature: "20F (-7C)", Size: "Standard-Short" }
    options: { type: Map, of: String, default: {} },

    weightGrams: { type: Number, min: 0 },
    sku: { type: String, trim: true },
  },
  { _id: false },
);

// =============================================================================
// ITEM TYPE ENUM
// =============================================================================
// This enum is built from attributeSchemas.js to ensure consistency.
// null is allowed for items that haven't been categorized yet.
// =============================================================================

const ITEM_TYPE_ENUM = [...getAllItemTypes(), null];

// =============================================================================
// CATALOG ITEM SCHEMA
// =============================================================================
// Canonical product definition in TrekList.
// This is the ADMIN-curated product model.
// Everything else (Offers, AffiliateProduct, GlobalItem) maps to this.
// =============================================================================

const CatalogItemSchema = new mongoose.Schema(
  {
    // -------------------------------------------------------------------------
    // CORE IDENTIFICATION
    // -------------------------------------------------------------------------

    // HUMAN DISPLAY NAME (required)
    // e.g. "Nemo Hornet OSMO 2P Tent"
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // BRAND NAME
    // e.g. "Nemo", "Patagonia"
    brand: {
      type: String,
      trim: true,
    },

    // LOWERCASE BRAND for searching / matching
    brandLC: {
      type: String,
      index: true,
    },

    // MANUFACTURER MODEL NUMBER
    // Critical for matching across regions/networks.
    // e.g. "Hornet-2P-OSMO", "BD-620654"
    modelNumber: {
      type: String,
      trim: true,
    },

    // -------------------------------------------------------------------------
    // CATEGORIZATION
    // -------------------------------------------------------------------------

    // TOP-LEVEL CATEGORY (TrekList controlled taxonomy)
    // e.g. "Shelter", "Sleep System", "Clothing", "Electronics"
    category: {
      type: String,
      trim: true,
      index: true,
    },

    // OPTIONAL SECONDARY SUBCATEGORY
    // e.g. under "Shelter": "Tent", "Tarp", "Bivy"
    subcategory: {
      type: String,
      trim: true,
      index: true,
    },

    // ITEM TYPE - ENUM (drives attribute schema)
    // This determines which structured attributes are valid/required.
    // e.g. "Sleeping Bag (Down)", "Backpack", "Headlamp"
    // null = not yet categorized (attributes will be empty or unvalidated)
    itemType: {
      type: String,
      enum: {
        values: ITEM_TYPE_ENUM,
        message:
          "'{VALUE}' is not a valid item type. See attributeSchemas.js for valid types.",
      },
      default: null,
      index: true,
    },

    // -------------------------------------------------------------------------
    // DESCRIPTION & MEDIA
    // -------------------------------------------------------------------------

    // SHORT DESCRIPTION (admin-curated text)
    // Do NOT store Amazon text permanently (Amazon API ToS)
    description: {
      type: String,
      trim: true,
    },

    // MULTIPLE IMAGE URLs
    // imageUrls[0] = primary image.
    imageUrls: {
      type: [String],
      default: [],
    },

    // -------------------------------------------------------------------------
    // PHYSICAL SPECS
    // -------------------------------------------------------------------------

    // BASE WEIGHT (grams)
    // Canonical weight used for gear list import previews.
    weightGrams: {
      type: Number,
      min: 0,
    },

    // Physical dimensions (store canonical values you trust)
    dimensions: {
      type: DimensionsSchema,
      default: undefined, // prevents empty {} subdocs
    },

    // -------------------------------------------------------------------------
    // VARIANTS (optional)
    // -------------------------------------------------------------------------
    // When a product has selectable variants (Temperature × Size, Torso × Belt,
    // etc.), these describe the matrix. Empty for simple single-variant products,
    // in which case weightGrams above is authoritative.
    variantAxes: {
      type: [VariantAxisSchema],
      default: [],
    },
    variants: {
      type: [VariantSchema],
      default: [],
    },
    // Which variant.key represents the product before the user selects one.
    defaultVariantKey: {
      type: String,
      trim: true,
    },

    // -------------------------------------------------------------------------
    // STRUCTURED ATTRIBUTES (NEW!)
    // -------------------------------------------------------------------------
    // Validated against attributeSchemas.js based on itemType.
    // Using Mixed type for flexibility - validation happens in pre-save hook.
    //
    // Example for "Sleeping Bag (Down)":
    // {
    //   tempRatingF: 20,
    //   tempRatingC: -7,        // auto-derived
    //   fillPower: 850,
    //   shape: "Mummy",
    //   gender: "Mens"
    // }
    //
    // Example for "Backpack":
    // {
    //   volumeLiters: 45,
    //   gender: "Unisex",
    //   frameType: "Frameless",
    //   rainCoverIncluded: true
    // }
    // -------------------------------------------------------------------------
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // -------------------------------------------------------------------------
    // TAGS & SEARCH
    // -------------------------------------------------------------------------

    // TAGS FOR SEARCH / FILTERING
    // e.g. ["ultralight", "3-season", "freestanding"]
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // -------------------------------------------------------------------------
    // EXTERNAL IDS
    // -------------------------------------------------------------------------

    externalIds: {
      asin: { type: String, trim: true },
      upc: { type: String, trim: true },
      ean: { type: String, trim: true },
      sku: { type: String, trim: true },
      mpn: { type: String, trim: true },
    },

    // STABLE CROSS-NETWORK PRODUCT ID
    // Used to unify Amazon + Awin + Impact into one product.
    itemGroupId: {
      type: String,
      trim: true,
      index: true,
    },

    // PRIMARY AMAZON IDENTIFIER (optional)
    canonicalAsin: {
      type: String,
      trim: true,
      index: true,
    },

    // PRIMARY SKU FROM AWIN/IMPACT (optional)
    canonicalSku: {
      type: String,
      trim: true,
    },

    // -------------------------------------------------------------------------
    // ADMIN & STATUS
    // -------------------------------------------------------------------------

    // ADMIN WHO CREATED THIS PRODUCT
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // VISIBILITY TOGGLE (soft delete)
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// =============================================================================
// PRE-SAVE MIDDLEWARE
// =============================================================================

CatalogItemSchema.pre("save", function normalize(next) {
  // -------------------------------------------------------------------------
  // 1. NORMALIZE STRING FIELDS
  // -------------------------------------------------------------------------
  this.name = cleanString(this.name) || this.name;
  this.brand = cleanString(this.brand);
  this.brandLC = this.brand ? this.brand.toLowerCase() : undefined;

  this.modelNumber = cleanString(this.modelNumber);
  this.category = cleanString(this.category);
  this.subcategory = cleanString(this.subcategory);
  this.description = cleanString(this.description);

  this.itemGroupId = cleanString(this.itemGroupId);
  this.canonicalAsin = cleanUpper(this.canonicalAsin);
  this.canonicalSku = cleanString(this.canonicalSku);

  if (this.externalIds) {
    this.externalIds.asin = cleanUpper(this.externalIds.asin);
    this.externalIds.upc = cleanString(this.externalIds.upc);
    this.externalIds.ean = cleanString(this.externalIds.ean);
    this.externalIds.sku = cleanString(this.externalIds.sku);
    this.externalIds.mpn = cleanString(this.externalIds.mpn);
  }

  this.imageUrls = cleanStringArray(this.imageUrls);
  this.tags = cleanStringArray(this.tags);

  // -------------------------------------------------------------------------
  // 2. NORMALIZE itemType (trim whitespace)
  // -------------------------------------------------------------------------
  if (this.itemType) {
    this.itemType = cleanString(this.itemType);
  }

  // -------------------------------------------------------------------------
  // 3. VALIDATE & DERIVE ATTRIBUTES (if itemType is set)
  // -------------------------------------------------------------------------
  if (this.itemType && isValidItemType(this.itemType)) {
    const attrs = this.attributes || {};
    const result = validateAttributes(this.itemType, attrs);

    if (!result.valid) {
      // Validation failed - throw an error with details
      const err = new Error(
        `Invalid attributes for ${this.itemType}: ${result.errors.join(", ")}`,
      );
      err.name = "ValidationError";
      err.errors = result.errors;
      return next(err);
    }

    // Replace attributes with cleaned + derived values
    this.attributes = result.cleaned;
  } else if (this.itemType && !isValidItemType(this.itemType)) {
    // itemType is set but not in our enum - this shouldn't happen due to enum validation
    // but just in case, clear attributes to be safe
    this.attributes = {};
  }

  // If no itemType, leave attributes as-is (could be legacy data or empty)

  next();
});

// =============================================================================
// UPDATE MIDDLEWARE
// =============================================================================

function normalizeUpdateObject(update) {
  if (!update || typeof update !== "object") return update;

  const hasOperators = Object.keys(update).some((k) => k.startsWith("$"));
  const $set = hasOperators ? { ...(update.$set || {}) } : { ...update };
  const $unset = { ...(update.$unset || {}) };

  const unset = (path) => {
    delete $set[path];
    $unset[path] = 1;
  };

  const setClean = (path, val) => {
    const s = cleanString(val);
    if (!s) return unset(path);
    $set[path] = s;
  };

  if ("brand" in $set) {
    const b = cleanString($set.brand);
    if (!b) {
      unset("brand");
      unset("brandLC");
    } else {
      $set.brand = b;
      $set.brandLC = b.toLowerCase();
    }
  }

  if ("category" in $set) setClean("category", $set.category);
  if ("subcategory" in $set) setClean("subcategory", $set.subcategory);
  if ("modelNumber" in $set) setClean("modelNumber", $set.modelNumber);
  if ("description" in $set) setClean("description", $set.description);

  // itemType - clean but allow null
  if ("itemType" in $set) {
    const it = cleanString($set.itemType);
    if (!it) {
      $set.itemType = null;
    } else {
      $set.itemType = it;
    }
  }

  if ("itemGroupId" in $set) setClean("itemGroupId", $set.itemGroupId);

  if ("canonicalAsin" in $set) {
    const a = cleanUpper($set.canonicalAsin);
    if (!a) unset("canonicalAsin");
    else $set.canonicalAsin = a;
  }

  if ("externalIds.asin" in $set) {
    const a = cleanUpper($set["externalIds.asin"]);
    if (!a) unset("externalIds.asin");
    else $set["externalIds.asin"] = a;
  }

  if (
    "externalIds" in $set &&
    $set.externalIds &&
    typeof $set.externalIds === "object"
  ) {
    const ext = { ...$set.externalIds };
    if ("asin" in ext) ext.asin = cleanUpper(ext.asin);
    if ("upc" in ext) ext.upc = cleanString(ext.upc);
    if ("ean" in ext) ext.ean = cleanString(ext.ean);
    if ("sku" in ext) ext.sku = cleanString(ext.sku);
    if ("mpn" in ext) ext.mpn = cleanString(ext.mpn);
    $set.externalIds = ext;
  }

  if ("tags" in $set && Array.isArray($set.tags)) {
    $set.tags = cleanStringArray($set.tags);
  }
  if ("imageUrls" in $set && Array.isArray($set.imageUrls)) {
    $set.imageUrls = cleanStringArray($set.imageUrls);
  }

  // -------------------------------------------------------------------------
  // VALIDATE ATTRIBUTES ON UPDATE (if both itemType and attributes are set)
  // -------------------------------------------------------------------------
  if ("attributes" in $set && "itemType" in $set) {
    const itemType = $set.itemType;
    const attrs = $set.attributes;

    if (itemType && isValidItemType(itemType) && attrs) {
      const result = validateAttributes(itemType, attrs);
      if (result.valid) {
        $set.attributes = result.cleaned;
      }
      // If invalid, we let it through here - the route should validate first
      // This is a safety net, not the primary validation
    }
  }

  if (hasOperators) {
    update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    else delete update.$unset;
    return update;
  }

  // non-operator updates become $set/$unset to support unsetting on empty/null
  const next = { $set };
  if (Object.keys($unset).length) next.$unset = $unset;
  return next;
}

CatalogItemSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
    const update = normalizeUpdateObject(this.getUpdate());
    this.setUpdate(update);
    next();
  },
);

// =============================================================================
// CUSTOM VALIDATORS
// =============================================================================

// Dimensions validation
CatalogItemSchema.path("dimensions").validate(function (dims) {
  if (!dims) return true;

  const hasAnyNum =
    typeof dims.length === "number" ||
    typeof dims.width === "number" ||
    typeof dims.height === "number";

  const hasNote = Boolean(String(dims.note || "").trim());

  // unit-only (or completely empty) is not allowed
  if (!hasAnyNum && !hasNote) return false;

  const hasAllNums =
    typeof dims.length === "number" &&
    typeof dims.width === "number" &&
    typeof dims.height === "number";

  // partial numbers require a note
  if (hasAnyNum && !hasAllNums && !hasNote) return false;

  return true;
}, "Dimensions must include L/W/H, or a note. Partial L/W/H requires a note.");

// =============================================================================
// INDEXES
// =============================================================================

CatalogItemSchema.index({ itemGroupId: 1 });
CatalogItemSchema.index({ canonicalAsin: 1 });
CatalogItemSchema.index({ brandLC: 1, category: 1 });
CatalogItemSchema.index({ itemType: 1, isActive: 1 }); // NEW: for filtering by itemType

// =============================================================================
// EXPORT
// =============================================================================

module.exports = mongoose.model("CatalogItem", CatalogItemSchema);
