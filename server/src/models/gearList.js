// src/models/gearList.js
const mongoose = require("mongoose");
const { GEARLIST_SWATCHES } = require("../config/colors");

const GearListSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    notes: { type: String, default: "" },
    tripStart: { type: Date },
    tripEnd: { type: Date },
    location: { type: String, default: "" },
    backgroundImageUrl: { type: String, default: null },
    backgroundImageHistory: {
      type: [String],
      default: [],
    },
    backgroundColor: {
      type: String,
      enum: [...GEARLIST_SWATCHES, null],
      default: GEARLIST_SWATCHES[0],
    },
    region: { type: String, default: null },
    isSample: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GearList", GearListSchema);
