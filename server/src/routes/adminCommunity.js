const express = require("express");
const router = express.Router();
const Post = require("../models/post");
const Comment = require("../models/comment");
const authMiddleware = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

router.use(authMiddleware, requireAdmin);

// GET /api/admin/community/flagged — flagged posts and comments
router.get("/flagged", async (req, res) => {
  try {
    const [posts, comments] = await Promise.all([
      Post.find({ flagCount: { $gt: 0 }, deletedAt: null })
        .sort({ flagCount: -1, createdAt: -1 })
        .populate("userId", "trailname email")
        .populate("communityId", "name slug")
        .lean(),
      Comment.find({ flagCount: { $gt: 0 }, deletedAt: null })
        .sort({ flagCount: -1, createdAt: -1 })
        .populate("userId", "trailname email")
        .populate("postId", "title communityId")
        .lean(),
    ]);
    res.json({ posts, comments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/community/posts/:postId — hard delete as admin
router.delete("/posts/:postId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    post.deletedAt = new Date();
    await post.save();
    res.json({ message: "Post removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/community/comments/:commentId — soft delete as admin
router.delete("/comments/:commentId", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    comment.deletedAt = new Date();
    await comment.save();
    res.json({ message: "Comment removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/admin/community/posts/:postId/clear-flags — clear flags
router.put("/posts/:postId/clear-flags", async (req, res) => {
  try {
    await Post.updateOne({ _id: req.params.postId }, { $set: { flagCount: 0 } });
    res.json({ message: "Flags cleared" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/admin/community/comments/:commentId/clear-flags
router.put("/comments/:commentId/clear-flags", async (req, res) => {
  try {
    await Comment.updateOne({ _id: req.params.commentId }, { $set: { flagCount: 0 } });
    res.json({ message: "Flags cleared" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
