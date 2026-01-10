// server/src/models/gearItem.js
const mongoose = require("mongoose");

/**
 * GearItem
 *
 * Represents ONE item in ONE specific GearList.
 *
 * Think of the hierarchy as:
 *   CatalogItem → canonical product (admin-managed)
 *   GlobalItem  → user-owned template of that product (or custom item)
 *   GearItem    → concrete row inside a specific list (with overrides)
 *
 * GearItem is the thing you actually render in:
 *   - /dashboard/:gearListId
 *   - packing checklists, stats, totals, etc.
 */

const GearItemSchema = new mongoose.Schema(
  {
    // Which gear list this row belongs to.
    // e.g. "Alta Via 1 – Summer 2026"
    gearList: {
      type: mongoose.Types.ObjectId,
      ref: "GearList",
      required: true,
      index: true,
    },

    // Reference to the user's global template for this item.
    // This lets multiple lists share the same base item.
    globalItem: {
      type: mongoose.Types.ObjectId,
      ref: "GlobalItem",
      required: true,
      index: true,
    },

    // Optional direct link to the canonical catalog product.
    // When present, this connects:
    //   GearItem → CatalogItem → MerchantOffer (affiliate resolution)
    // so you don’t always have to hop through GlobalItem.
    productId: {
      type: mongoose.Types.ObjectId,
      ref: "CatalogItem",
      required: false,
      index: true,
    },

    // Optional reference to a Category document if you have a separate
    // Category model driving UI grouping. This is distinct from the
    // CatalogItem.category string.
    category: {
      type: mongoose.Types.ObjectId,
      ref: "Category",
      required: false,
    },

    // Snapshot of the brand at the time this GearItem was created
    // or last synced from GlobalItem / CatalogItem.
    brand: {
      type: String,
    },

    // Snapshot type label.
    // Typically mirrors GlobalItem.itemType or CatalogItem.itemType
    // but can be overridden per list if you allow that in the UI.
    itemType: {
      type: String,
    },

    // Display name of the item in this list.
    // This is what the user actually sees in their checklist UI.
    name: {
      type: String,
      required: true,
    },

    // Optional description / notes specific to this list entry.
    description: {
      type: String,
    },

    // Weight in grams for THIS item in THIS list.
    // Usually copied from GlobalItem.weight, but can be overridden
    // (e.g., user tweaks weight for a specific trip).
    weight: {
      type: Number, // grams
    },

    // Direct URL for this item in this list.
    // Usually copied from GlobalItem.link or a resolved offer deepLink,
    // but can be overridden by the user if allowed.
    link: {
      type: String,
    },

    // Whether this item is worn (not counted in pack weight).
    worn: {
      type: Boolean,
      default: false,
    },

    // Whether this item is consumable (food, fuel, etc.).
    consumable: {
      type: Boolean,
      default: false,
    },

    // Quantity of this item in the list (e.g. 2 pairs of socks).
    quantity: {
      type: Number,
      default: 1,
    },

    // Position of this item within its category/column for drag-and-drop
    // ordering. This is the primary sort key in the UI.
    position: {
      type: Number,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/**
 * INDEXES
 *
 * IMPORTANT:
 * - Don’t add manual single-field indexes that duplicate `index: true`
 *   in the schema fields above (Mongo will reject duplicates).
 */

// ✅ Most important for:
// - rendering dashboards grouped by category
// - fetching category items in sorted order
// - copy-list route queries per category (when you add .sort({ position: 1 }))
GearItemSchema.index(
  { gearList: 1, category: 1, position: 1 },
  { name: "list_category_position" }
);

// ✅ Useful for pages that load “all items in a list” sorted by position
GearItemSchema.index({ gearList: 1, position: 1 }, { name: "list_position" });

module.exports =
  mongoose.models.GearItem || mongoose.model("GearItem", GearItemSchema);
