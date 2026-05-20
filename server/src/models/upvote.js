const mongoose = require("mongoose");

const UpvoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ["post", "comment"], required: true },
  },
  { timestamps: true }
);

UpvoteSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
UpvoteSchema.index({ targetId: 1, targetType: 1 });

module.exports = mongoose.model("Upvote", UpvoteSchema);
