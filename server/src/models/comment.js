const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    upvoteCount: { type: Number, default: 0 },
    flagCount: { type: Number, default: 0 },
    lang: { type: String, default: null, index: true },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CommentSchema.index({ postId: 1, parentCommentId: 1, deletedAt: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", CommentSchema);
