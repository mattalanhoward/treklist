//server/src/models/amazonSnapshot.js
const mongoose = require("mongoose");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const AmazonSnapshotSchema = new mongoose.Schema(
  {
    catalogItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CatalogItem",
      required: false,
      index: true,
    },

    asin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // marketplace / partner (us, uk, de, nl, etc.)
    marketplace: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // For debugging/reference only (you said: store Amazon category only in snapshot)
    amazonCategoryHint: { type: String, trim: true },

    // Amazon-derived product content (treat as cached; refresh after 24h)
    title: { type: String, trim: true },
    brand: { type: String, trim: true },
    description: { type: String, trim: true },
    modelNumber: { type: String, trim: true },

    weightGrams: { type: Number, min: 0 },

    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, trim: true, lowercase: true }, // "cm" | "in"
    },

    imageUrls: [{ type: String, trim: true }],

    fetchedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + ONE_DAY_MS),
      index: true,
    },
  },
  { timestamps: true }
);

// Idempotent per ASIN+marketplace (latest snapshot overwrites via upsert)
AmazonSnapshotSchema.index({ asin: 1, marketplace: 1 }, { unique: true });
AmazonSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AmazonSnapshot", AmazonSnapshotSchema);
