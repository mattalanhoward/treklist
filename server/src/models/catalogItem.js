const mongoose = require("mongoose");

// ------------------------------------------------------------
// LinkSchema → represents ONE affiliate link for ONE region.
// This stays for backwards compatibility during migration.
// Later, Offers will replace this, but keep this for now.
// ------------------------------------------------------------
const LinkSchema = new mongoose.Schema(
  {
    // Affiliate network providing this link
    // "amazon" | "awin" | "impact"
    network: {
      type: String,
      required: true,
      enum: ["amazon", "awin", "impact", "direct"],
    },

    // TrekList-internal region routing key
    // (not necessarily the network’s native region)
    // e.g. "us", "uk", "eu", "de", "ca", "global"
    region: {
      type: String,
      default: "global",
      index: true,
    },

    // Full affiliate tracking URL
    url: {
      type: String,
      required: true,
      trim: true,
    },

    // Merchant display label
    // e.g., "Amazon", "Bergfreunde", "REI", etc.
    merchantName: {
      type: String,
      trim: true,
    },

    // External product ID used by the network
    // e.g. ASIN (Amazon) or ProductId (Awin)
    externalId: {
      type: String,
      trim: true,
    },

    // Higher = preferred link for this region if duplicates exist
    priority: {
      type: Number,
      default: 0,
    },
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
      default: undefined,
    },

    // ADMIN-ESTIMATED PRICE (optional)
    // Used when importing into user lists as a placeholder.
    priceHint: {
      type: Number,
      min: 0,
      default: null,
    },

    // CURRENCY FOR priceHint
    // e.g. "usd", "eur", "gbp"
    priceHintCurrency: {
      type: String,
      trim: true,
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

    // LEGACY LINK STORAGE
    // We will migrate away from this when Offers are fully adopted.
    links: {
      type: [LinkSchema],
      default: [],
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
  if (this.brand) {
    this.brandLC = String(this.brand).toLowerCase().trim();
  }
  if (this.category) this.category = this.category.trim();
  if (this.subcategory) this.subcategory = this.subcategory.trim();
  if (this.itemType) this.itemType = this.itemType.trim();
  if (this.itemGroupId != null) this.itemGroupId = String(this.itemGroupId);
  next();
});

// ------------------------------------------------------------
// Helpful indexes for affiliate resolution & search
// ------------------------------------------------------------
CatalogItemSchema.index({ itemGroupId: 1 });
CatalogItemSchema.index({ canonicalAsin: 1 });
CatalogItemSchema.index({ brandLC: 1, category: 1 });

module.exports = mongoose.model("CatalogItem", CatalogItemSchema);
