// server/src/models/catalogItem.js
const mongoose = require("mongoose");

const LinkSchema = new mongoose.Schema(
  {
    // "amazon" | "awin" | "impact" | etc.
    network: {
      type: String,
      required: true,
      enum: ["amazon", "awin", "impact"],
    },
    // Simple region code used by TrekList to route users
    // e.g. "us", "uk", "de", "eu", "ca", "global"
    region: {
      type: String,
      default: "global",
      index: true,
    },
    // Full affiliate URL (with tag / tracking params)
    url: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional merchant label: "Amazon", "Bergfreunde", "REI", etc.
    merchantName: {
      type: String,
      trim: true,
    },
    // External product identifier (ASIN, Awin product id, etc.)
    externalId: {
      type: String,
      trim: true,
    },
    // Higher = preferred when multiple links match the region
    priority: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const CatalogItemSchema = new mongoose.Schema(
  {
    // Display name of the gear item ("Nemo Hornet OSMO 2P")
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional brand field ("Nemo", "Patagonia")
    brand: {
      type: String,
      trim: true,
    },
    // Broad gear category used for filtering in Import tab
    // e.g. "shelter", "sleeping-bag", "mid-layer", "headlamp"
    category: {
      type: String,
      trim: true,
      index: true,
    },
    // Optional short description for the Import UI
    description: {
      type: String,
      trim: true,
    },
    // Base weight in grams (keep it simple & consistent with rest of app)
    weightGrams: {
      type: Number,
      min: 0,
    },
    // Optional tags to help filter / search
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // Affiliate links for different networks / regions
    links: {
      type: [LinkSchema],
      default: [],
    },

    // Which admin created / last owns this catalog item
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Soft delete / visibility toggle
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CatalogItem", CatalogItemSchema);
