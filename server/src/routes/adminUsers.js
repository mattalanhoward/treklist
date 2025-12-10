// server/src/routes/adminUsers.js
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const User = require("../models/user");
const GearList = require("../models/gearList");
const GearItem = require("../models/gearItem");
const Category = require("../models/category");
const ShareToken = require("../models/ShareToken");
const GlobalItem = require("../models/globalItem");

const { isValidObjectId } = mongoose;

const router = express.Router();

// All routes below require auth + admin
router.use(auth, requireAdmin);

/**
 * GET /api/admin/users
 * List users with search, filters, pagination, and listsCount
 *
 * Query params:
 *  - q           (optional) search term (email / trailname)
 *  - isVerified  (optional) "true" | "false" | "all"
 *  - role        (optional) "admin" | "user"
 *  - limit       (optional) default 50, max 200
 *  - skip        (optional) default 0
 */
router.get("/", async (req, res) => {
  try {
    const {
      q,
      isVerified = "all",
      role = "all",
      limit = 50,
      skip = 0,
    } = req.query;

    const query = {};

    // Filter by verification flag
    if (isVerified === "true") query.isVerified = true;
    else if (isVerified === "false") query.isVerified = false;

    // Filter by role (isAdmin bool)
    if (role === "admin") query.isAdmin = true;
    else if (role === "user") query.isAdmin = false;

    // Search by email / trailname (case-insensitive)
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      query.$or = [{ email: regex }, { trailname: regex }];
    }

    const safeLimit = Math.min(Number(limit) || 50, 200);
    const safeSkip = Number(skip) || 0;

    // Fetch users (lean for speed, project only needed fields)
    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(safeSkip)
        .limit(safeLimit)
        .select(
          "email trailname isVerified isAdmin createdAt updatedAt locale currency theme marketing"
        )
        .lean(),
      User.countDocuments(query),
    ]);

    // Compute listsCount per user (single aggregate over GearList)
    const userIds = users.map((u) => u._id);
    let listCountsByUserId = {};
    if (userIds.length > 0) {
      const listCounts = await GearList.aggregate([
        { $match: { owner: { $in: userIds } } },
        { $group: { _id: "$owner", count: { $sum: 1 } } },
      ]);

      listCountsByUserId = listCounts.reduce((acc, row) => {
        acc[String(row._id)] = row.count;
        return acc;
      }, {});
    }

    const enrichedUsers = users.map((u) => ({
      ...u,
      listsCount: listCountsByUserId[String(u._id)] || 0,
    }));

    res.json({
      users: enrichedUsers,
      total,
    });
  } catch (err) {
    console.error("GET /api/admin/users error", err);
    res.status(500).json({ message: "Failed to load users." });
  }
});

/**
 * GET /api/admin/users/:id
 * Fetch a single user + a summary of their gear lists
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const user = await User.findById(id)
      .select(
        "-passwordHash -refreshTokens -verifyEmailToken -verifyEmailExpires -resetPasswordToken -resetPasswordExpires"
      )
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const lists = await GearList.find({ owner: id })
      .sort({ updatedAt: -1 })
      .select("title createdAt updatedAt region")
      .lean();

    res.json({
      user,
      lists,
      listsCount: lists.length,
    });
  } catch (err) {
    console.error(`GET /api/admin/users/${req.params.id} error`, err);
    res.status(500).json({ message: "Failed to load user." });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Allowed updates (v1):
 *  - trailname
 *  - isVerified
 *  - isAdmin
 */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const updates = {};
    const body = req.body || {};

    if (Object.prototype.hasOwnProperty.call(body, "trailname")) {
      updates.trailname =
        typeof body.trailname === "string" ? body.trailname.trim() : "";
    }

    if (Object.prototype.hasOwnProperty.call(body, "isVerified")) {
      updates.isVerified = Boolean(body.isVerified);
    }

    if (Object.prototype.hasOwnProperty.call(body, "isAdmin")) {
      updates.isAdmin = Boolean(body.isAdmin);
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided to update." });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    )
      .select(
        "email trailname isVerified isAdmin createdAt updatedAt locale currency theme marketing"
      )
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json(updated);
  } catch (err) {
    console.error(`PATCH /api/admin/users/${req.params.id} error`, err);
    res.status(500).json({ message: "Failed to update user." });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Hard-delete user + their lists + items + global items + share tokens
 * (GDPR-style delete for support requests)
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const user = await User.findById(id).select("isAdmin");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Simple guard: don't allow deleting admin accounts via API for now
    if (user.isAdmin) {
      return res
        .status(400)
        .json({ message: "Refusing to delete admin accounts via API." });
    }

    // All gear lists owned by this user
    const lists = await GearList.find({ owner: id }).select("_id").lean();
    const listIds = lists.map((l) => l._id);

    // Cascade deletes
    const deletions = [];

    if (listIds.length > 0) {
      deletions.push(
        GearItem.deleteMany({ gearList: { $in: listIds } }),
        Category.deleteMany({ gearList: { $in: listIds } }),
        ShareToken.deleteMany({
          $or: [{ owner: id }, { list: { $in: listIds } }],
        }),
        GearList.deleteMany({ _id: { $in: listIds } })
      );
    } else {
      // Still clean up any share tokens owned by user even if no lists found
      deletions.push(ShareToken.deleteMany({ owner: id }));
    }

    // Global templates owned by this user
    deletions.push(GlobalItem.deleteMany({ owner: id }));

    // Finally remove the user record
    deletions.push(User.deleteOne({ _id: id }));

    await Promise.all(deletions);

    res.json({ message: "User and related data deleted." });
  } catch (err) {
    console.error(`DELETE /api/admin/users/${req.params.id} error`, err);
    res.status(500).json({ message: "Failed to delete user." });
  }
});

module.exports = router;
