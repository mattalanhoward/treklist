const { Schema, model } = require("mongoose");

/**
 * Stores every product row ingested from an affiliate network feed.
 * Acts as a searchable product index — CatalogItems are created from here
 * when an admin explicitly imports a product.
 */
const AffiliateProductSchema = new Schema(
  {
    network:      { type: String, enum: ["awin"], required: true },
    region:       { type: String, required: true },       // e.g. "GB"
    merchantId:   { type: String, required: true },       // Awin advertiser id
    merchantName: { type: String },

    // Awin's unique product id (aw_product_id)
    externalProductId: { type: String, required: true },

    // Merchant's base product code — first segment of merchant_product_id
    // e.g. merchant_product_id "8852999-5075752" → merchantProductId "8852999"
    // Matches the code in Decathlon URLs: /p/product-name/_/R-p-8852999
    merchantProductId: { type: String, index: true },

    name:        { type: String, required: true },
    brand:       { type: String },
    brandLC:     { type: String, index: true },
    description: { type: String },

    merchantCategory: { type: String },
    modelNumber:      { type: String },
    colour:           { type: String },

    awDeepLink: { type: String, required: true },
    imageUrl:   { type: String },

    price:            { type: Number },
    deliveryWeightKg: { type: Number },

    ean:         { type: String, index: true },
    sku:         { type: String },
    itemGroupId: { type: String },
  },
  { timestamps: true }
);

AffiliateProductSchema.pre("save", function (next) {
  if (this.region)  this.region  = String(this.region).toUpperCase();
  if (this.brand)   this.brandLC = String(this.brand).toLowerCase().trim();
  if (this.itemGroupId)        this.itemGroupId        = String(this.itemGroupId);
  if (this.merchantProductId)  this.merchantProductId  = String(this.merchantProductId);
  next();
});

// One row per network/region/merchant/product
AffiliateProductSchema.index(
  { network: 1, region: 1, merchantId: 1, externalProductId: 1 },
  { unique: true }
);

AffiliateProductSchema.index({ network: 1, region: 1, merchantId: 1, merchantProductId: 1 });
AffiliateProductSchema.index({ name: "text", brand: "text", description: "text" });
AffiliateProductSchema.index({ network: 1, region: 1, brandLC: 1 });
AffiliateProductSchema.index({ network: 1, region: 1, merchantCategory: 1 });

module.exports = model("AffiliateProduct", AffiliateProductSchema);
