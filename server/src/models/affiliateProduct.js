// // server/src/models/affiliateProduct.js
// const { Schema, model } = require("mongoose");

// /**
//  * Canonical store for ingested product rows from affiliate networks.
//  * v1 supports Awin; the schema stays network-agnostic so we can add AvantLink later.
//  */
// const AffiliateProductSchema = new Schema(
//   {
//     network: { type: String, enum: ["awin"], required: true },

//     region: { type: String, required: true }, // e.g., "GB","NL","DE"
//     merchantId: { type: String, required: true }, // Awin advertiser id
//     merchantName: { type: String },

//     // External product ID from the network (Awin product id)
//     externalProductId: { type: String, required: true },

//     name: { type: String, required: true },
//     brand: { type: String },
//     // derived, denormalized
//     brandLC: { type: String, index: true }, // "osprey", "black diamond", ...
//     description: { type: String },
//     categoryPath: [{ type: String }],
//     // derived, denormalized
//     itemType: { type: String, index: true }, // e.g., "Headlamps", "Daypacks"

//     awDeepLink: { type: String, required: true },
//     imageUrl: { type: String },

//     // Matching helpers for alternates/grouping
//     ean: { type: String },
//     sku: { type: String },
//     itemGroupId: { type: String },

//     lastUpdated: { type: Date, default: Date.now },
//   },
//   { timestamps: true }
// );

// // Normalize/derive fields
// AffiliateProductSchema.pre("save", function normalize(next) {
//   if (this.region) this.region = String(this.region).toUpperCase();
//   if (this.brand) this.brandLC = String(this.brand).toLowerCase().trim();
//   if (this.itemType) this.itemType = String(this.itemType).trim();
//   if (this.itemGroupId != null) this.itemGroupId = String(this.itemGroupId);
//   next();
// });

// // Uniqueness per network/region/merchant/product
// AffiliateProductSchema.index(
//   { network: 1, region: 1, merchantId: 1, externalProductId: 1 },
//   { unique: true, name: "uniq_network_region_merchant_prod" }
// );

// // Search & filters
// AffiliateProductSchema.index({ name: "text", brand: "text" });
// AffiliateProductSchema.index({ region: 1, merchantId: 1});
// // Helpful compound indexes for common filters (keep it lean)
// AffiliateProductSchema.index({ network: 1, region: 1, brandLC: 1 });
// AffiliateProductSchema.index({ network: 1, region: 1, itemType: 1 });
// AffiliateProductSchema.index({ network: 1, region: 1, merchantId: 1 });
// // For /affiliates/resolve fallback by group+region
// AffiliateProductSchema.index({
//   network: 1,
//   itemGroupId: 1,
//   region: 1,
//   updatedAt: -1,
// });

// module.exports = model("AffiliateProduct", AffiliateProductSchema);
