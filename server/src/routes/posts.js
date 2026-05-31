const express = require("express");
const router = express.Router();
const sanitizeHtml = require("sanitize-html");
const Post = require("../models/post");
const Comment = require("../models/comment");
const Community = require("../models/community");
const Upvote = require("../models/upvote");
const Flag = require("../models/flag");
const Notification = require("../models/notification");
const User = require("../models/user");
const authMiddleware = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const {
  communityPostLimiter,
  communityUpvoteLimiter,
} = require("../middleware/rateLimiters");
const { detectLanguage } = require("../utils/googleTranslate");
const { sendSupportEmail } = require("../utils/mailer");

const PAGE_SIZE = 20;

// Only allow the tags Tiptap's StarterKit can produce — no attributes
const SANITIZE_OPTS = {
  allowedTags: ["p", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code", "pre", "br"],
  allowedAttributes: {},
};

function sanitizeBody(html) {
  if (!html) return "";
  return sanitizeHtml(html.trim(), SANITIZE_OPTS);
}

// Escape special regex characters to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CLOUDINARY_PREFIX = "https://res.cloudinary.com/treklist/";

function validateImageUrls(urls) {
  return Array.isArray(urls) && urls.every((u) => typeof u === "string" && u.startsWith(CLOUDINARY_PREFIX));
}

function parseImageUrls(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.slice(0, 5).map((u) => u.trim()).filter((u) => u.startsWith(CLOUDINARY_PREFIX));
}

// GET /api/community/:slug/posts — paginated post feed
router.get("/:slug/posts", optionalAuth, async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isArchived: false }).lean();
    if (!community) return res.status(404).json({ message: "Community not found" });

    const { sort = "new", page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * PAGE_SIZE;
    const sortField = sort === "top" ? { upvoteCount: -1, createdAt: -1 } : { createdAt: -1 };

    const [posts, total] = await Promise.all([
      Post.find({ communityId: community._id, deletedAt: null })
        .sort(sortField)
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("userId", "trailname")
        .lean(),
      Post.countDocuments({ communityId: community._id, deletedAt: null }),
    ]);

    let upvotedIds = new Set();
    if (req.userId) {
      const postIds = posts.map((p) => p._id);
      const upvotes = await Upvote.find({
        userId: req.userId,
        targetId: { $in: postIds },
        targetType: "post",
      }).lean();
      upvotedIds = new Set(upvotes.map((u) => u.targetId.toString()));
    }

    const enriched = posts.map((p) => ({ ...p, upvoted: upvotedIds.has(p._id.toString()) }));
    res.json({ community, posts: enriched, total, page: parseInt(page), pageSize: PAGE_SIZE });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/community/:slug/posts — create post
router.post("/:slug/posts", authMiddleware, communityPostLimiter, async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isArchived: false }).lean();
    if (!community) return res.status(404).json({ message: "Community not found" });

    const { title, body, url, imageUrls } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: "Title required" });

    // Validate URL if provided
    const cleanUrl = url ? url.trim() : "";
    if (cleanUrl) {
      try { new URL(cleanUrl); } catch { return res.status(400).json({ message: "Invalid URL" }); }
    }

    const plainText = `${title.trim()} ${(body || "").replace(/<[^>]+>/g, " ")}`.trim();
    const lang = await detectLanguage(plainText).catch(() => null);

    const post = new Post({
      communityId: community._id,
      userId: req.userId,
      title: title.trim(),
      body: sanitizeBody(body),
      url: cleanUrl,
      imageUrls: parseImageUrls(imageUrls),
      lang,
    });
    await post.save();
    await post.populate("userId", "trailname");
    res.status(201).json(post);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/posts/search?q=... — full-text search across all communities
router.get("/search", optionalAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ posts: [] });

    // Escape each word to prevent ReDoS, then AND them together
    const words = q.split(/\s+/).filter(Boolean).slice(0, 10); // cap at 10 words
    const wordConditions = words.map((w) => {
      const escaped = escapeRegex(w);
      return {
        $or: [
          { title: { $regex: escaped, $options: "i" } },
          { body: { $regex: escaped, $options: "i" } },
        ],
      };
    });

    const posts = await Post.find({ deletedAt: null, $and: wordConditions })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("userId", "trailname")
      .populate("communityId", "name slug")
      .lean();

    let upvotedIds = new Set();
    if (req.userId) {
      const upvotes = await Upvote.find({
        userId: req.userId,
        targetId: { $in: posts.map((p) => p._id) },
        targetType: "post",
      }).lean();
      upvotedIds = new Set(upvotes.map((u) => u.targetId.toString()));
    }

    const enriched = posts.map((p) => ({ ...p, upvoted: upvotedIds.has(p._id.toString()) }));
    res.json({ posts: enriched });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/posts/:postId — post detail
router.get("/:postId", optionalAuth, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null })
      .populate("userId", "trailname")
      .lean();
    if (!post) return res.status(404).json({ message: "Post not found" });

    const community = await Community.findById(post.communityId).lean();

    let upvoted = false;
    if (req.userId) {
      const vote = await Upvote.findOne({ userId: req.userId, targetId: post._id, targetType: "post" });
      upvoted = !!vote;
    }

    res.json({ ...post, upvoted, community });
  } catch (err) {
    console.error("Get post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/posts/:postId — edit post (author only)
router.put("/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null });
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId.toString() !== req.userId) return res.status(403).json({ message: "Forbidden" });

    const { title, body, url, imageUrls } = req.body;
    const contentChanged = (title !== undefined) || (body !== undefined);
    if (title !== undefined) post.title = title.trim();
    if (body !== undefined) post.body = sanitizeBody(body);
    if (url !== undefined) {
      const cleanUrl = url.trim();
      if (cleanUrl) {
        try { new URL(cleanUrl); } catch { return res.status(400).json({ message: "Invalid URL" }); }
      }
      post.url = cleanUrl;
    }
    if (imageUrls !== undefined) post.imageUrls = parseImageUrls(imageUrls);
    if (contentChanged) {
      const plainText = `${post.title} ${post.body.replace(/<[^>]+>/g, " ")}`.trim();
      post.lang = await detectLanguage(plainText).catch(() => post.lang);
    }
    post.isEdited = true;
    post.editedAt = new Date();

    await post.save();
    await post.populate("userId", "trailname");
    res.json(post);
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/posts/:postId — soft delete (author or admin)
router.delete("/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const user = await require("../models/user").findById(req.userId).lean();
    if (post.userId.toString() !== req.userId && !user?.isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const now = new Date();
    post.deletedAt = now;
    await post.save();

    // Cascade soft-delete all comments on this post
    await Comment.updateMany({ postId: post._id, deletedAt: null }, { deletedAt: now });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/posts/:postId/upvote — toggle upvote
router.post("/:postId/upvote", authMiddleware, communityUpvoteLimiter, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null }).lean();
    if (!post) return res.status(404).json({ message: "Post not found" });


    // Atomic find-and-delete: if upvote existed, remove it and decrement
    const existing = await Upvote.findOneAndDelete({ userId: req.userId, targetId: post._id, targetType: "post" });
    if (existing) {
      const updated = await Post.findByIdAndUpdate(
        post._id,
        [{ $set: { upvoteCount: { $max: [0, { $subtract: ["$upvoteCount", 1] }] } } }],
        { new: true }
      );
      return res.json({ upvoted: false, upvoteCount: updated.upvoteCount });
    }

    await Upvote.create({ userId: req.userId, targetId: post._id, targetType: "post" });
    const updated = await Post.findByIdAndUpdate(post._id, { $inc: { upvoteCount: 1 } }, { new: true });

    // Fire-and-forget notification — skip if upvoter is the author
    if (post.userId.toString() !== req.userId) {
      Notification.create({
        recipientId: post.userId,
        type: "upvote_post",
        fromUserId: req.userId,
        postId: post._id,
      }).catch((e) => console.error("Upvote notification error:", e));
    }

    res.json({ upvoted: true, upvoteCount: updated.upvoteCount });
  } catch (err) {
    console.error("Upvote post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/posts/:postId/flag — flag post
router.post("/:postId/flag", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, deletedAt: null });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const existing = await Flag.findOne({ userId: req.userId, targetId: post._id, targetType: "post" });
    if (existing) return res.status(409).json({ message: "Already flagged" });

    await Flag.create({ userId: req.userId, targetId: post._id, targetType: "post" });
    await Post.findByIdAndUpdate(post._id, { $inc: { flagCount: 1 } });

    const [postAuthor, flagger] = await Promise.all([
      User.findById(post.userId).lean(),
      User.findById(req.userId).lean(),
    ]);
    const postUrl = `https://treklist.co/community/post/${post._id}`;
    sendSupportEmail({
      to: "support@treklist.co",
      subject: "🚩 Post flagged for review",
      text: `A post has been flagged for review.\n\nTitle: ${post.title}\nPost author: ${postAuthor?.trailname || post.userId}\nFlagged by: ${flagger?.trailname || req.userId}\n\nView post: ${postUrl}`,
      html: `<p>A post has been flagged for review.</p><p><strong>Title:</strong> ${post.title}<br><strong>Post author:</strong> ${postAuthor?.trailname || post.userId}<br><strong>Flagged by:</strong> ${flagger?.trailname || req.userId}</p><p><a href="${postUrl}">View post</a></p>`,
    }).catch((e) => console.error("Flag post email error:", e));

    res.json({ message: "Flagged" });
  } catch (err) {
    console.error("Flag post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
