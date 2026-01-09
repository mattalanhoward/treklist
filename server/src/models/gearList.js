// server/src/models/gearList.js
const mongoose = require("mongoose");
const { GEARLIST_SWATCHES } = require("../config/colors");

const GearListSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },
    tripStart: { type: Date },
    tripEnd: { type: Date },
    location: { type: String, default: "" },

    // ACTIVE background (what the user sees right now)
    backgroundImageUrl: { type: String, default: null },
    backgroundColor: {
      type: String,
      enum: [...GEARLIST_SWATCHES, null],
      default: GEARLIST_SWATCHES[0],
    },

    // SAVED custom upload (the one tile we keep, even if user switches to color/default)
    customBackground: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },

    region: { type: String, default: null },
    isFeatured: { type: Boolean, default: false },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GearList", GearListSchema);
