const express = require("express");
const router = express.Router();
const Post = require("../models/post");
const Comment = require("../models/comment");
const Community = require("../models/community");
const authMiddleware = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { translateAllLanguages, detectLanguage } = require("../utils/googleTranslate");

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

// GET /api/admin/community/forums — list all communities including archived
router.get("/forums", async (req, res) => {
  try {
    const forums = await Community.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(forums);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/community/forums — create a new community
router.post("/forums", async (req, res) => {
  try {
    const { name, slug, description, sortOrder } = req.body;
    if (!name || !slug) return res.status(400).json({ message: "name and slug required" });
    const i18n = await translateAllLanguages(description || "");
    const community = new Community({ name, slug, description: description || "", i18n, sortOrder: sortOrder || 0 });
    await community.save();
    res.status(201).json(community);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Slug already exists" });
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/admin/community/forums/:id — update a community by ID
router.put("/forums/:id", async (req, res) => {
  try {
    const { name, description, isArchived, sortOrder } = req.body;
    const existing = await Community.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Community not found" });
    const update = { name, description, isArchived, sortOrder };
    if (description !== undefined && description !== existing.description) {
      update.i18n = await translateAllLanguages(description || "");
    }
    const community = await Community.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    res.json(community);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/community/backfill-langs — detect and store lang for posts/comments missing it
router.post("/backfill-langs", async (req, res) => {
  try {
    const [posts, comments] = await Promise.all([
      Post.find({ lang: null, deletedAt: null }).select("title body").lean(),
      Comment.find({ lang: null, deletedAt: null }).select("body").lean(),
    ]);

    let postCount = 0, commentCount = 0;

    for (const p of posts) {
      const text = `${p.title} ${(p.body || "").replace(/<[^>]+>/g, " ")}`.trim();
      const lang = await detectLanguage(text).catch(() => null);
      if (lang) { await Post.updateOne({ _id: p._id }, { $set: { lang } }); postCount++; }
    }

    for (const c of comments) {
      const lang = await detectLanguage(c.body).catch(() => null);
      if (lang) { await Comment.updateOne({ _id: c._id }, { $set: { lang } }); commentCount++; }
    }

    res.json({ message: `Updated ${postCount} posts and ${commentCount} comments` });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/community/forums/backfill-translations — populate i18n for communities missing it
router.post("/forums/backfill-translations", async (req, res) => {
  try {
    const communities = await Community.find({ $or: [{ i18n: {} }, { i18n: { $exists: false } }] });
    let count = 0;
    for (const c of communities) {
      if (c.description) {
        c.i18n = await translateAllLanguages(c.description);
        await c.save();
        count++;
      }
    }
    res.json({ message: `Translated ${count} communities` });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/community/forums/:id — hard delete a community
router.delete("/forums/:id", async (req, res) => {
  try {
    const community = await Community.findByIdAndDelete(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found" });
    res.json({ message: "Community deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
