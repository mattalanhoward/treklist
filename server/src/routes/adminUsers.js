// server/src/routes/adminUsers.js
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const authRouter = require("./auth");

const User = require("../models/user");
const GearList = require("../models/gearList");
const GearItem = require("../models/gearItem");
const Category = require("../models/category");
const ShareToken = require("../models/ShareToken");
const GlobalItem = require("../models/globalItem");

const { isValidObjectId } = mongoose;

const router = express.Router();

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      const regex = new RegExp(escapeRegex(q.trim()), "i");
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
          "email trailname isVerified isAdmin isDisabled createdAt updatedAt lastLoginAt lastActiveAt locale theme marketing"
        )
        .lean(),
      User.countDocuments(query),
    ]);

    // Compute listsCount and item counts per user
    const userIds = users.map((u) => u._id);
    let listCountsByUserId = {};
    let itemCountsByUserId = {};
    if (userIds.length > 0) {
      const [listCounts, itemCounts] = await Promise.all([
        GearList.aggregate([
          { $match: { owner: { $in: userIds } } },
          { $group: { _id: "$owner", count: { $sum: 1 } } },
        ]),
        GlobalItem.aggregate([
          { $match: { owner: { $in: userIds }, status: { $ne: "wishlisted" } } },
          {
            $group: {
              _id: "$owner",
              catalog: {
                $sum: { $cond: [{ $ifNull: ["$productId", false] }, 1, 0] },
              },
              custom: {
                $sum: { $cond: [{ $ifNull: ["$productId", false] }, 0, 1] },
              },
            },
          },
        ]),
      ]);

      listCountsByUserId = listCounts.reduce((acc, row) => {
        acc[String(row._id)] = row.count;
        return acc;
      }, {});

      itemCountsByUserId = itemCounts.reduce((acc, row) => {
        acc[String(row._id)] = { catalog: row.catalog, custom: row.custom };
        return acc;
      }, {});
    }

    const enrichedUsers = users.map((u) => {
      const ic = itemCountsByUserId[String(u._id)] || { catalog: 0, custom: 0 };
      return {
        ...u,
        listsCount: listCountsByUserId[String(u._id)] || 0,
        catalogItemsCount: ic.catalog,
        customItemsCount: ic.custom,
      };
    });

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

    const [user, tokenDoc] = await Promise.all([
      User.findById(id)
        .select(
          "-passwordHash -refreshTokens -verifyEmailToken -verifyEmailExpires -resetPasswordToken -resetPasswordExpires"
        )
        .lean(),
      User.findById(id).select("refreshTokens").lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const sessionCount = tokenDoc?.refreshTokens?.length ?? 0;

    const lists = await GearList.find({ owner: id })
      .sort({ updatedAt: -1 })
      .select("title createdAt updatedAt region")
      .lean();

    const [catalogItemsCount, customItemsCount] = await Promise.all([
      GlobalItem.countDocuments({
        owner: id,
        status: { $ne: "wishlisted" },
        productId: { $ne: null },
      }),
      GlobalItem.countDocuments({
        owner: id,
        status: { $ne: "wishlisted" },
        $or: [{ productId: null }, { productId: { $exists: false } }],
      }),
    ]);

    res.json({
      user,
      lists,
      listsCount: lists.length,
      catalogItemsCount,
      customItemsCount,
      sessionCount,
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

    if (Object.prototype.hasOwnProperty.call(body, "isDisabled")) {
      const disabled = Boolean(body.isDisabled);
      updates.isDisabled = disabled;

      // If we're disabling the account, also revoke all refresh tokens
      if (disabled) {
        updates.refreshTokens = [];
      }
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
        "email trailname isVerified isAdmin isDisabled createdAt updatedAt lastLoginAt lastActiveAt locale theme marketing"
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

/**
 * POST /api/admin/users/:id/resend-verification
 * Resend verification email to an unverified user
 */
router.post("/:id/resend-verification", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified." });
    }

    // Generate fresh verification token
    const verifyToken = crypto.randomBytes(20).toString("hex");
    user.verifyEmailToken = verifyToken;
    user.verifyEmailExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
    await user.save();

    // Send verification email
    await authRouter.sendVerificationEmail(user.email, verifyToken, null);

    res.json({ message: "Verification email sent." });
  } catch (err) {
    console.error(`POST /api/admin/users/${req.params.id}/resend-verification error`, err);
    res.status(500).json({ message: "Failed to send verification email." });
  }
});

/**
 * POST /api/admin/users/:id/revoke-sessions
 * Revoke all refresh tokens without disabling the account
 */
router.post("/:id/revoke-sessions", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const user = await User.findById(id).select("_id");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await User.updateOne({ _id: id }, { $set: { refreshTokens: [] } });

    res.json({ message: "All sessions revoked." });
  } catch (err) {
    console.error(
      `POST /api/admin/users/${req.params.id}/revoke-sessions error`,
      err
    );
    res.status(500).json({ message: "Failed to revoke sessions." });
  }
});

module.exports = router;
