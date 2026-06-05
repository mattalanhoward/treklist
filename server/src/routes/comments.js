const express = require("express");
const router = express.Router({ mergeParams: true });
const Comment = require("../models/comment");
const Post = require("../models/post");
const User = require("../models/user");
const Upvote = require("../models/upvote");
const Flag = require("../models/flag");
const Notification = require("../models/notification");
const authMiddleware = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const { sendSupportEmail } = require("../utils/mailer");
const {
  communityCommentLimiter,
  communityUpvoteLimiter,
} = require("../middleware/rateLimiters");
const { detectLanguage } = require("../utils/googleTranslate");

// GET /api/posts/:postId/comments — fetch all comments for a post
router.get("/", optionalAuth, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null }).lean();
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comments = await Comment.find({ postId: post._id, deletedAt: null })
      .sort({ createdAt: 1 })
      .populate("userId", "trailname")
      .lean();

    let upvotedIds = new Set();
    if (req.userId) {
      const commentIds = comments.map((c) => c._id);
      const upvotes = await Upvote.find({
        userId: req.userId,
        targetId: { $in: commentIds },
        targetType: "comment",
      }).lean();
      upvotedIds = new Set(upvotes.map((u) => u.targetId.toString()));
    }

    // Build tree: top-level + replies grouped
    const topLevel = [];
    const replyMap = {};

    for (const c of comments) {
      const enriched = { ...c, upvoted: upvotedIds.has(c._id.toString()), replies: [] };
      if (!c.parentCommentId) {
        topLevel.push(enriched);
        replyMap[c._id.toString()] = enriched;
      }
    }
    for (const c of comments) {
      if (c.parentCommentId) {
        const parent = replyMap[c.parentCommentId.toString()];
        if (parent) {
          parent.replies.push({ ...c, upvoted: upvotedIds.has(c._id.toString()) });
        }
      }
    }

    res.json(topLevel);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/posts/:postId/comments — create comment or reply
router.post("/", authMiddleware, communityCommentLimiter, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const { body, parentCommentId } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ message: "Body required" });

    // Validate parent exists and is top-level (enforce one-level-deep threading)
    if (parentCommentId) {
      const parent = await Comment.findOne({ _id: parentCommentId, postId: post._id, deletedAt: null }).lean();
      if (!parent) return res.status(404).json({ message: "Parent comment not found" });
      if (parent.parentCommentId) return res.status(400).json({ message: "Cannot reply more than one level deep" });
    }

    const lang = await detectLanguage(body.trim()).catch(() => null);

    const comment = new Comment({
      postId: post._id,
      userId: req.userId,
      parentCommentId: parentCommentId || null,
      body: body.trim(),
      lang,
    });
    await comment.save();

    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

    await comment.populate("userId", "trailname");

    // Fire-and-forget notifications
    if (!parentCommentId) {
      if (post.userId.toString() !== req.userId) {
        Notification.create({
          recipientId: post.userId,
          type: "reply_post",
          fromUserId: req.userId,
          postId: post._id,
          commentId: comment._id,
        }).catch((e) => console.error("Comment notification error:", e));
      }
    } else {
      Comment.findById(parentCommentId).lean().then((parent) => {
        if (parent && parent.userId.toString() !== req.userId) {
          Notification.create({
            recipientId: parent.userId,
            type: "reply_comment",
            fromUserId: req.userId,
            postId: post._id,
            commentId: comment._id,
          }).catch((e) => console.error("Reply notification error:", e));
        }
      }).catch(() => {});
    }

    res.status(201).json({ ...comment.toObject(), replies: [] });
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/comments/:commentId — edit comment (author or admin)
router.put("/:commentId", authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.commentId, deletedAt: null });
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    const actor = await User.findById(req.userId).lean();
    if (comment.userId.toString() !== req.userId && !actor?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ message: "Body required" });

    comment.body = body.trim();
    comment.lang = await detectLanguage(body.trim()).catch(() => comment.lang);
    const isAuthor = comment.userId.toString() === req.userId;
    if (isAuthor) { comment.isEdited = true; comment.editedAt = new Date(); }
    await comment.save();
    await comment.populate("userId", "trailname");
    res.json(comment);
  } catch (err) {
    console.error("Update comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/comments/:commentId — soft delete (author or admin)
router.delete("/:commentId", authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.commentId, deletedAt: null });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const user = await User.findById(req.userId).lean();
    if (comment.userId.toString() !== req.userId && !user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    comment.deletedAt = new Date();
    await comment.save();

    await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/comments/:commentId/upvote — toggle upvote
router.post("/:commentId/upvote", authMiddleware, communityUpvoteLimiter, async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.commentId, deletedAt: null }).lean();
    if (!comment) return res.status(404).json({ message: "Comment not found" });


    // Atomic find-and-delete: if upvote existed, remove it and decrement
    const existing = await Upvote.findOneAndDelete({ userId: req.userId, targetId: comment._id, targetType: "comment" });
    if (existing) {
      const updated = await Comment.findByIdAndUpdate(
        comment._id,
        [{ $set: { upvoteCount: { $max: [0, { $subtract: ["$upvoteCount", 1] }] } } }],
        { new: true }
      );
      return res.json({ upvoted: false, upvoteCount: updated.upvoteCount });
    }

    await Upvote.create({ userId: req.userId, targetId: comment._id, targetType: "comment" });
    const updated = await Comment.findByIdAndUpdate(comment._id, { $inc: { upvoteCount: 1 } }, { new: true });

    // Fire-and-forget notification — skip if upvoter is the author
    if (comment.userId.toString() !== req.userId) {
      Notification.create({
        recipientId: comment.userId,
        type: "upvote_comment",
        fromUserId: req.userId,
        postId: comment.postId,
        commentId: comment._id,
      }).catch((e) => console.error("Upvote comment notification error:", e));
    }

    res.json({ upvoted: true, upvoteCount: updated.upvoteCount });
  } catch (err) {
    console.error("Upvote comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/comments/:commentId/flag — flag comment
router.post("/:commentId/flag", authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.commentId, deletedAt: null });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const existing = await Flag.findOne({ userId: req.userId, targetId: comment._id, targetType: "comment" });
    if (existing) return res.status(409).json({ message: "Already flagged" });

    await Flag.create({ userId: req.userId, targetId: comment._id, targetType: "comment" });
    await Comment.findByIdAndUpdate(comment._id, { $inc: { flagCount: 1 } });

    const [commentAuthor, flagger] = await Promise.all([
      User.findById(comment.userId).lean(),
      User.findById(req.userId).lean(),
    ]);
    const postUrl = `https://app.treklist.co/community/post/${comment.postId}`;
    sendSupportEmail({
      to: "support@treklist.co",
      subject: "🚩 Comment flagged for review",
      text: `A comment has been flagged for review.\n\nComment: ${comment.body?.slice(0, 200)}\nComment author: ${commentAuthor?.trailname || comment.userId}\nFlagged by: ${flagger?.trailname || req.userId}\n\nView post: ${postUrl}`,
      html: `<p>A comment has been flagged for review.</p><p><strong>Comment:</strong> ${comment.body?.slice(0, 200)}<br><strong>Comment author:</strong> ${commentAuthor?.trailname || comment.userId}<br><strong>Flagged by:</strong> ${flagger?.trailname || req.userId}</p><p><a href="${postUrl}">View post</a></p>`,
    }).catch((e) => console.error("Flag comment email error:", e));

    res.json({ message: "Flagged" });
  } catch (err) {
    console.error("Flag comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
