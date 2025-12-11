// server/src/routes/adminPublicLists.js
const express = require("express");
const mongoose = require("mongoose");

const GearList = require("../models/gearList");
const ShareToken = require("../models/ShareToken");
const { revokeTokenForList } = require("../utils/share");

const router = express.Router();

/**
 * GET /api/
 *
 * Returns a paginated list of currently public (non-revoked) shared gear lists.
 * Query params:
 *   - limit (default 25, max 100)
 *   - skip (default 0)
 *   - q: optional search on list title, user email/trailname, or token
 */
router.get("/", async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const rawSkip = parseInt(req.query.skip, 10);

    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 100)
      : 25;
    const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;

    const q = (req.query.q || "").trim().toLowerCase();

    // Volume of public lists is expected to be small, so we can do
    // in-memory filtering + pagination for now.
    const tokens = await ShareToken.find({})
      .sort({ createdAt: -1 }) // newest first
      .populate("list", "title region isFeatured createdAt updatedAt")
      .populate("owner", "email trailname")
      .exec();

    // Group by list, keeping the newest token per list
    const byList = new Map();
    for (const t of tokens) {
      if (!t.list || !t.owner) continue;
      const key = String(t.list._id);
      if (!byList.has(key)) {
        byList.set(key, t); // first one we see is newest due to sort
      }
    }

    let rows = Array.from(byList.values());

    if (q) {
      rows = rows.filter((t) => {
        const title = (t.list.title || "").toLowerCase();
        const email = (t.owner.email || "").toLowerCase();
        const trailname = (t.owner.trailname || "").toLowerCase();
        const tokenStr = (t.token || "").toLowerCase();

        return (
          title.includes(q) ||
          email.includes(q) ||
          trailname.includes(q) ||
          tokenStr.includes(q)
        );
      });
    }

    const total = rows.length;
    const pageRows = rows.slice(skip, skip + limit);

    const result = pageRows.map((t) => ({
      _id: t.list._id.toString(),
      title: t.list.title,
      region: t.list.region || null,
      ownerEmail: t.owner.email,
      ownerTrailname: t.owner.trailname || null,
      token: t.token,
      isActive: !t.revokedAt, // always true here; we only load revokedAt:null
      isFeatured: Boolean(t.list.isFeatured),
      viewsCount: typeof t.viewsCount === "number" ? t.viewsCount : 0,
      lastViewedAt: t.lastViewedAt || null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return res.json({ total, lists: result });
  } catch (err) {
    console.error("Failed to list public gear lists:", err);
    return res.status(500).json({ message: "Failed to load public lists." });
  }
});

/**
 * POST /api/admin/public-lists/:id/revoke
 *
 * Revokes the active public share token for the given gear list.
 */
router.post("/:id/revoke", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid list id." });
    }

    const list = await GearList.findById(id).select("_id owner title").exec();
    if (!list) {
      return res.status(404).json({ message: "List not found." });
    }

    // Use shared utility to revoke the active token for this list + owner.
    await revokeTokenForList(list._id, list.owner);

    return res.json({
      message: `Public link revoked for "${list.title}".`,
    });
  } catch (err) {
    console.error("Failed to revoke public list:", err);
    return res.status(500).json({ message: "Failed to revoke public link." });
  }
});

/**
 * POST /api/admin/public-lists/:id/unrevoke
 *
 * Re-enables the most recent share token for a list by clearing revokedAt.
 */
router.post("/:id/unrevoke", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid list id." });
    }

    const list = await GearList.findById(id).select("_id owner title").exec();
    if (!list) {
      return res.status(404).json({ message: "List not found." });
    }

    // Find the newest token for this list+owner (even if revoked)
    const token = await ShareToken.findOne({
      list: list._id,
      owner: list.owner,
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!token) {
      return res
        .status(404)
        .json({ message: "No share token found to unrevoke." });
    }

    token.revokedAt = null;
    await token.save();

    return res.json({
      message: `Public link re-enabled for "${list.title}".`,
    });
  } catch (err) {
    console.error("Failed to unrevoke public list:", err);
    return res
      .status(500)
      .json({ message: "Failed to re-enable public link." });
  }
});

/**
 * PATCH /api/admin/public-lists/:id
 *
 * Currently supports toggling the "isFeatured" flag on the underlying GearList.
 */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid list id." });
    }

    if (typeof isFeatured !== "boolean") {
      return res.status(400).json({ message: "isFeatured must be a boolean." });
    }

    const updated = await GearList.findByIdAndUpdate(
      id,
      { $set: { isFeatured } },
      { new: true }
    ).exec();

    if (!updated) {
      return res.status(404).json({ message: "List not found." });
    }

    return res.json({
      message: "List updated.",
      list: {
        id: updated._id.toString(),
        title: updated.title,
        isFeatured: updated.isFeatured,
      },
    });
  } catch (err) {
    console.error("Failed to update public list:", err);
    return res.status(500).json({ message: "Failed to update public list." });
  }
});

module.exports = router;
