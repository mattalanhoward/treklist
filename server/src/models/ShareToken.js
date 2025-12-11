// server/src/models/ShareToken.js
const mongoose = require("mongoose");

const ShareTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    list: { type: mongoose.Types.ObjectId, ref: "GearList", required: true },
    owner: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    // Use revokedAt to represent inactive tokens (null = active)
    revokedAt: { type: Date, default: null, index: true },
    // --- new fields ---
    viewsCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Enforce: at most one *active* token per list (active = revokedAt == null)
ShareTokenSchema.index(
  { list: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
);

module.exports = mongoose.model("ShareToken", ShareTokenSchema);
