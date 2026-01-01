const mongoose = require("mongoose");

/**
 * GlobalItem
 *
 * A user-owned gear template that can be reused across multiple gear lists.
 * Think of this as "Matthew's personal master item" for a piece of gear.
 *
 * It can either:
 * - be linked to a canonical CatalogItem (productId → CatalogItem._id), OR
 * - be a fully custom item with no catalog link.
 */

const GlobalItemSchema = new mongoose.Schema(
  {
    // Owner of this global item (user who created it)
    owner: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional link to canonical product in the admin catalog.
    // If present, this item should inherit brand/name/images/affiliate offers
    // from CatalogItem unless overridden.
    productId: {
      type: mongoose.Types.ObjectId,
      ref: "CatalogItem",
      required: false,
      index: true,
    },

    catalogCategory: { type: String, trim: true, default: null },
    catalogSubcategory: { type: String, trim: true, default: null },

    // Brand label as stored on this global item.
    // May mirror CatalogItem.brand or be user-custom text.
    brand: {
      type: String,
    },

    // Type label as stored on this global item.
    // Typically the user-facing type ("mid-layer fleece", "rain jacket").
    itemType: {
      type: String,
    },

    // Display name for this item in the user’s lists.
    // e.g. "Nemo Hornet OSMO 2P", "TNF Futurelight Rain Jacket"
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional description / notes from the user.
    description: {
      type: String,
    },

    // Flexible specs (user-editable). Examples:
    // { capacityLiters: "24", lumens: "450", maxLengthCm: "140" }
    attributes: {
      type: Map,
      of: String,
      default: {},
    },

    // Affiliate metadata (present when this GlobalItem is merchant-managed)
    affiliate: {
      network: { type: String, trim: true },
      region: { type: String, trim: true },
      merchantId: { type: String, trim: true },
      merchantName: { type: String, trim: true },
      externalProductId: { type: String, trim: true },
      deepLink: { type: String, trim: true },
      itemGroupId: { type: String, trim: true },
    },

    // Base weight in grams. This may be:
    // - copied from CatalogItem.weightGrams
    // - entered by the user
    // - heuristically guessed
    weight: {
      type: Number,
      required: false,
    },

    // Indicates where the weight value came from.
    // Helps you trust "verified" values more than "heuristic" ones.
    weightSource: {
      type: String,
      enum: ["user", "heuristic", "scraped", "catalog", "verified"],
      default: "user",
      index: true,
    },

    // Optional direct link if this item is custom or the user wants
    // a non-catalog / non-affiliate URL.
    link: {
      type: String,
    },

    // Whether this item is worn (not carried in pack weight).
    worn: {
      type: Boolean,
      default: false,
    },

    // Whether this item is consumable (e.g., food, gas).
    consumable: {
      type: Boolean,
      default: false,
    },

    // Default quantity for this item on new gear lists.
    quantity: {
      type: Number,
      default: 1,
    },

    // Flags that this global item was created by importing from a shared list.
    importedFromShare: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Frequent query path: "all my global items"
GlobalItemSchema.index({ owner: 1 }, { name: "owner_idx" });

// Already existing index to support bulk updates via GlobalItem
GlobalItemSchema.index({ productId: 1 });
GlobalItemSchema.index({ name: 1, owner: 1 });

// ---- Deduping indexes (prevent duplicate imports) ----

// One catalog product per owner
GlobalItemSchema.index(
  { owner: 1, productId: 1 },
  {
    unique: true,
    name: "uniq_owner_productId",
    partialFilterExpression: {
      productId: { $exists: true, $type: "objectId" },
    },
  }
);

// One affiliate product per owner per region/network (for legacy affiliate-backed global items)
GlobalItemSchema.index(
  {
    owner: 1,
    "affiliate.network": 1,
    "affiliate.region": 1,
    "affiliate.externalProductId": 1,
  },
  {
    unique: true,
    name: "uniq_owner_affiliate_product",
    partialFilterExpression: {
      "affiliate.network": { $exists: true, $type: "string" },
      "affiliate.region": { $exists: true, $type: "string" },
      "affiliate.externalProductId": { $exists: true, $type: "string" },
    },
  }
);

module.exports = mongoose.model("GlobalItem", GlobalItemSchema);
