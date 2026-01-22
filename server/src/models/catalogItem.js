const mongoose = require("mongoose");

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

// ------------------------------------------------------------
// CatalogItemSchema → Canonical product definition in TrekList.
// This is the ADMIN-curated product model.
// Everything else (Offers, AffiliateProduct, GlobalItem) maps to this.
// ------------------------------------------------------------
const CatalogItemSchema = new mongoose.Schema(
  {
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

    // TOP-LEVEL CATEGORY (TrekList controlled taxonomy)
    // e.g. "shelter", "sleep-system", "clothing-top", "electronics"
    category: {
      type: String,
      trim: true,
      index: true,
    },

    // OPTIONAL SECONDARY SUBCATEGORY
    // e.g. under "shelter": "tent", "tarp", "bivy"
    subcategory: {
      type: String,
      trim: true,
      index: true,
    },

    // HUMAN-FRIENDLY TYPE LABEL
    // More specific than category, shown to users.
    // e.g. "ultralight 2-person tent", "mid-layer fleece"
    itemType: {
      type: String,
      trim: true,
      index: true,
    },

    // SHORT DESCRIPTION (admin-curated text)
    // Do NOT store Amazon text permanently (PAAPI rules)
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

    // BASE WEIGHT (grams)
    // Canonical weight used for gear list import previews.
    weightGrams: {
      type: Number,
      min: 0,
    },

    externalIds: {
      asin: { type: String, trim: true },
      upc: { type: String, trim: true },
      ean: { type: String, trim: true },
      sku: { type: String, trim: true },
      mpn: { type: String, trim: true },
    },

    // Physical dimensions (store canonical values you trust)
    dimensions: {
      type: DimensionsSchema,
      default: undefined, // prevents empty {} subdocs
    },

    // TAGS FOR SEARCH / FILTERING
    // e.g. ["ultralight", "3-season", "freestanding"]
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // FLEXIBLE ATTRIBUTE BAG (key/value pairs)
    // Examples:
    // { capacity: "2P", rvalue: "4.2", liters: "55", lumens: "350" }
    attributes: {
      type: Map,
      of: String,
      default: {},
    },

    // STABLE CROSS-NETWORK PRODUCT ID
    // Used to unify Amazon + Awin + Impact into one product.
    // Populated from your ingestion layer if available.
    itemGroupId: {
      type: String,
      trim: true,
      index: true,
    },

    // PRIMARY AMAZON IDENTIFIER (optional)
    // If the product has a canonical ASIN.
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

// ------------------------------------------------------------
// Normalization middleware
// Ensures consistent stored values & index performance
// ------------------------------------------------------------
CatalogItemSchema.pre("save", function normalize(next) {
  this.name = cleanString(this.name) || this.name;
  this.brand = cleanString(this.brand);
  this.brandLC = this.brand ? this.brand.toLowerCase() : undefined;

  this.modelNumber = cleanString(this.modelNumber);
  this.category = cleanString(this.category);
  this.subcategory = cleanString(this.subcategory);
  this.itemType = cleanString(this.itemType);
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
  next();
});

// Normalize updates too (findOneAndUpdate / updateOne / updateMany)
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
  if ("itemType" in $set) setClean("itemType", $set.itemType);
  if ("modelNumber" in $set) setClean("modelNumber", $set.modelNumber);
  if ("description" in $set) setClean("description", $set.description);

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

  if ("tags" in $set && Array.isArray($set.tags))
    $set.tags = cleanStringArray($set.tags);
  if ("imageUrls" in $set && Array.isArray($set.imageUrls))
    $set.imageUrls = cleanStringArray($set.imageUrls);

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

// - Allow note-only dimensions
// - Allow partial L/W/H ONLY if note is present
// - Disallow unit-only with no note and no numbers
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

// ------------------------------------------------------------
// Helpful indexes for affiliate resolution & search
// ------------------------------------------------------------
CatalogItemSchema.index({ itemGroupId: 1 });
CatalogItemSchema.index({ canonicalAsin: 1 });
CatalogItemSchema.index({ brandLC: 1, category: 1 });

module.exports = mongoose.model("CatalogItem", CatalogItemSchema);
