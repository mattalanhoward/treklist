// server/src/models/searchLog.js
//
// Demand signal for catalog gaps: when a catalog search settles on zero
// results, we upsert the normalized query with a counter. No user-identifying
// data — just "how often did people search for something we don't have".
// Replaces the cut "Request a gear item" feature (handoff CUT section) and
// feeds the brand backlog via the admin QA table.
const mongoose = require("mongoose");

const SearchLogSchema = new mongoose.Schema(
  {
    // Normalized (trimmed, lowercased) query string. Unique = the dedupe key.
    query: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    count: { type: Number, default: 0 },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);

// Admin table sorts by demand.
SearchLogSchema.index({ count: -1 });

module.exports = mongoose.model("SearchLog", SearchLogSchema);
