const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const User = require("../models/user");
const authMiddleware = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const optionalAuth = require("../middleware/optionalAuth");

// GET /api/community — list active communities, annotated with favorited for auth users
router.get("/", optionalAuth, async (req, res) => {
  try {
    const communities = await Community.find({ isArchived: false })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    if (req.userId) {
      const user = await User.findById(req.userId).select("favoriteCommunities").lean();
      const favSet = new Set((user?.favoriteCommunities || []).map(String));
      communities.forEach((c) => { c.favorited = favSet.has(String(c._id)); });
    } else {
      communities.forEach((c) => { c.favorited = false; });
    }

    res.json(communities);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/community/:slug/favorite — toggle favorite
router.post("/:slug/favorite", authMiddleware, async (req, res) => {
  try {
    const community = await Community.findOne({ slug: req.params.slug, isArchived: false }).lean();
    if (!community) return res.status(404).json({ message: "Community not found" });

    const user = await User.findById(req.userId).select("favoriteCommunities");
    const idx = user.favoriteCommunities.findIndex((id) => String(id) === String(community._id));

    if (idx >= 0) {
      user.favoriteCommunities.splice(idx, 1);
    } else {
      user.favoriteCommunities.push(community._id);
    }

    await user.save();
    res.json({ favorited: idx < 0 });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/community — create community (admin only)
router.post("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, sortOrder } = req.body;
    if (!name || !slug) return res.status(400).json({ message: "name and slug required" });

    const community = new Community({ name, slug, description, sortOrder });
    await community.save();
    res.status(201).json(community);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Slug already exists" });
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/community/:slug — update community (admin only)
router.put("/:slug", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, description, isArchived, sortOrder } = req.body;
    const community = await Community.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { name, description, isArchived, sortOrder } },
      { new: true }
    );
    if (!community) return res.status(404).json({ message: "Community not found" });
    res.json(community);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
