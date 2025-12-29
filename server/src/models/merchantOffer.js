// server/src/models/merchantOffer.js
const mongoose = require("mongoose");

/**
 * Offer Model (Unified Across Affiliate Networks)
 *
 * Represents ONE purchasable offer for ONE product in ONE region
 * from ONE merchant on ONE affiliate network.
 *
 * Examples:
 * - Amazon (US) offer for ASIN B09ABC123
 * - Awin (DE) offer for Bergfreunde ProductId 123456789
 * - Impact (UK) offer for CotswoldOutdoor SKU 445577
 *
 * A CatalogItem (canonical product) can have MANY offers.
 */

const MerchantOfferSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------------------------
    // Required Affiliate Metadata
    // ---------------------------------------------------------------------

    // Affiliate network: "amazon", "awin", "impact", etc.
    network: {
      type: String,
      required: true,
      index: true,
    },

    // TrekList-internal region routing value
    // Not raw Awin/Amazon codes — normalized to: "us", "uk", "de", "eu", "ca", etc.
    region: {
      type: String,
      required: true,
      index: true,
    },

    // Merchant identifier on the network:
    // - Amazon marketplace (e.g., "ATVPDKIKX0DER")
    // - Awin advertiser ID
    // - Impact advertiser ID
    merchantId: {
      type: String,
      required: true,
    },

    // Pretty display name for UI: "Amazon", "REI", "Bergfreunde"
    merchantName: {
      type: String,
      trim: true,
    },

    // ---------------------------------------------------------------------
    // Product Identification
    // ---------------------------------------------------------------------

    // FK → CatalogItem (_id)
    // This is the canonical relationship once a product is known.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CatalogItem",
      required: false, // optional during ingestion, required once resolved
      index: true,
    },

    // Stable cross-network identifier used during ingestion
    // If we don’t know productId yet, we use this to match Awin/Amazon/Impact.
    itemGroupId: {
      type: String,
      required: false,
      index: true,
    },

    // External product ID from the network
    // Amazon → ASIN
    // Awin → ProductId
    // Impact → Sku or ProductId
    externalProductId: {
      type: String,
      trim: true,
      index: true,
    },

    // ---------------------------------------------------------------------
    // Pricing + Deep Link
    // ---------------------------------------------------------------------

    // Canonical deep link to send users to
    // (Amazon affiliate link, Awin deeplink, Impact deeplink)
    deepLink: {
      type: String,
      required: true,
      trim: true,
    },

    // Preferred offer selector
    // Example:
    //  - priority: 10 → “use this offer over others in the same region”
    priority: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ---------------------------------------------------------------------
// Normalization middleware
// ---------------------------------------------------------------------
MerchantOfferSchema.pre("save", function normalize(next) {
  if (this.region) this.region = String(this.region).toLowerCase();

  if (this.itemGroupId != null) this.itemGroupId = String(this.itemGroupId);
  if (this.merchantId != null) this.merchantId = String(this.merchantId);

  if (this.externalProductId != null) {
    this.externalProductId = String(this.externalProductId).trim();
    if (this.network === "amazon") {
      this.externalProductId = this.externalProductId.toUpperCase();
    }
  }

  next();
});

// ---------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------

// ✅ Resolved offers: unique per product + merchant + region + network
MerchantOfferSchema.index(
  { productId: 1, network: 1, region: 1, merchantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      productId: { $exists: true, $type: "objectId" },
    },
  }
);

// ✅ Unresolved offers (ingestion): unique per network + region + merchant + externalProductId
MerchantOfferSchema.index(
  { network: 1, region: 1, merchantId: 1, externalProductId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      productId: { $exists: false }, // important: don't store null for productId
      externalProductId: { $exists: true, $type: "string", $ne: "" },
    },
  }
);

// Efficient region → product → offers lookup
MerchantOfferSchema.index({ productId: 1, region: 1 });

// itemGroupId fallback (before productId is known)
MerchantOfferSchema.index({ network: 1, itemGroupId: 1, region: 1 });

module.exports = mongoose.model("MerchantOffer", MerchantOfferSchema);
