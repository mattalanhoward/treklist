const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, trim: true, maxlength: 10000, default: "" },
    url: { type: String, trim: true, maxlength: 2048, default: "" },
    imageUrls: { type: [String], default: [] },
    upvoteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    flagCount: { type: Number, default: 0 },
    lang: { type: String, default: null, index: true },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PostSchema.index({ communityId: 1, deletedAt: 1, createdAt: -1 });
PostSchema.index({ communityId: 1, deletedAt: 1, upvoteCount: -1 });

module.exports = mongoose.model("Post", PostSchema);
