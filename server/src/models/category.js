const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    gearList: {
      type: mongoose.Types.ObjectId,
      ref: "GearList",
      required: true,
      index: true, // optional, harmless
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Add indexes AFTER schema definition
CategorySchema.index({ gearList: 1, position: 1 }, { name: "list_position" });

module.exports = mongoose.model("Category", CategorySchema);
