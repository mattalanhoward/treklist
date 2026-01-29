const mongoose = require("mongoose");

const CatalogItemRequestSchema = new mongoose.Schema(
  {
    // Requested item
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: "" },

    // Who requested it (nice to have for support + prioritization)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userEmail: { type: String, trim: true, lowercase: true },
    region: { type: String, trim: true },
    locale: { type: String, trim: true },
    language: { type: String, trim: true },

    // Metadata (optional)
    source: { type: String, trim: true, default: "globalItemModal" },
    userAgent: { type: String, trim: true },
    ip: { type: String, trim: true },

    // Basic workflow fields (future admin panel)
    status: {
      type: String,
      enum: ["open", "in_progress", "done", "rejected"],
      default: "open",
      index: true,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CatalogItemRequest", CatalogItemRequestSchema);
