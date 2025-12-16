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

    // High-level category string (same general idea as CatalogItem.category)
    // e.g. "shelter", "sleep-system", "clothing-top"
    category: {
      type: String,
      trim: true,
      default: null,
    },

    subcategory: {
      type: String,
      trim: true,
      default: null,
    },

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

    // Snapshot price on the global item (for user’s reference).
    // This is NOT your canonical pricing; that lives on MerchantOffer.
    price: {
      type: Number,
      required: false,
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

    // Affiliate info is now considered "legacy" / custom override.
    // For catalog-backed items, you’ll normally resolve offers via:
    //   productId → CatalogItem → MerchantOffer
    affiliate: {
      type: new mongoose.Schema(
        {
          // Affiliate network ("awin", "amazon", "impact")
          network: {
            type: String,
            enum: ["awin", "amazon", "impact"],
            required: true,
          },

          // Network-specific merchant identifier (e.g., Awin advertiser id)
          merchantId: { type: String },

          // Merchant display name ("Amazon", "Bergfreunde", etc.)
          merchantName: { type: String },

          // Source region for this affiliate link (e.g., "GB", "US").
          // For catalog-backed items, user routing should use MerchantOffer.region instead.
          region: { type: String },

          // External product ID from the network (ASIN, Awin product id, etc.)
          externalProductId: { type: String },

          // The canonical deep link that was stored on this item.
          // For new catalog-backed flows, prefer MerchantOffer.deepLink.
          deepLink: { type: String },

          // Stable group id used to correlate offers across regions for this item.
          // This mirrors CatalogItem.itemGroupId / MerchantOffer.itemGroupId when used.
          itemGroupId: { type: String },

          // Optional alternate links for other regions/merchants.
          // Legacy structure from the earlier design.
          alternates: [
            {
              region: String,
              deepLink: String,
              merchantId: String,
              externalProductId: String,
            },
          ],
        },
        { _id: false }
      ),
      required: false,
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

module.exports = mongoose.model("GlobalItem", GlobalItemSchema);
