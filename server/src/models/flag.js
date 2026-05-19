const mongoose = require("mongoose");

const FlagSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ["post", "comment"], required: true },
  },
  { timestamps: true }
);

FlagSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
FlagSchema.index({ targetId: 1, targetType: 1 });

module.exports = mongoose.model("Flag", FlagSchema);
