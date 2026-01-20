const mongoose = require("mongoose");

const DimensionsSchema = new mongoose.Schema(
  {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { type: String, enum: ["cm"], default: "cm" },
    note: { type: String, trim: true },
  },
  { _id: false }
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
  }
);

// ------------------------------------------------------------
// Normalization middleware
// Ensures consistent stored values & index performance
// ------------------------------------------------------------
CatalogItemSchema.pre("save", function normalize(next) {
  if (this.brand) this.brandLC = String(this.brand).toLowerCase().trim();
  if (this.category) this.category = this.category.trim();
  if (this.subcategory) this.subcategory = this.subcategory.trim();
  if (this.itemType) this.itemType = this.itemType.trim();
  if (this.itemGroupId !== undefined)
    this.itemGroupId = String(this.itemGroupId);
  if (this.canonicalAsin !== undefined)
    this.canonicalAsin = String(this.canonicalAsin);
  if (this.externalIds?.asin !== undefined)
    this.externalIds.asin = String(this.externalIds.asin).trim().toUpperCase();
  next();
});

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
