// server/src/models/catalogReport.js
//
// A crowd-sourced "report an issue" against a catalog item (bad weight, wrong
// category, broken image, etc.). Deduped by (catalogItem, field) with a counter
// so many users hitting the same problem collapse into one queue row — see the
// add-gear report popover (decision 12) and the admin QA queue.
const mongoose = require("mongoose");

// The dispute fields surfaced in the report popover (wireframe Frame 6).
const REPORT_FIELDS = ["weight", "category", "name", "image", "other"];

const CatalogReportSchema = new mongoose.Schema(
  {
    catalogItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CatalogItem",
      required: true,
      index: true,
    },

    // Which aspect is being disputed. One report row per (item, field).
    field: {
      type: String,
      enum: REPORT_FIELDS,
      required: true,
    },

    // How many times this exact (item, field) has been reported.
    count: {
      type: Number,
      default: 0,
    },

    // open until an admin resolves it; a fresh report reopens a resolved row.
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
      index: true,
    },

    // Context auto-attached by the client so the admin can reproduce.
    variantKey: { type: String, default: null },
    lastNote: { type: String, default: "" },
    // Snapshot of the values the reporter was shown (weight/category/name…).
    shownValues: { type: mongoose.Schema.Types.Mixed, default: null },
    lastReporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastReportedAt: { type: Date },
  },
  { timestamps: true },
);

// The dedupe key: one row per item+field.
CatalogReportSchema.index({ catalogItem: 1, field: 1 }, { unique: true });
// Queue query: open reports, hottest first.
CatalogReportSchema.index({ status: 1, count: -1 });

const CatalogReport = mongoose.model("CatalogReport", CatalogReportSchema);
CatalogReport.FIELDS = REPORT_FIELDS;

module.exports = CatalogReport;
