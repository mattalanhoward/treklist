// server/src/routes/adminUsers.js
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { hashToken } = require("../utils/tokenHash");
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

const USER_SORT_FIELD_MAP = {
  email: "email",
  trailname: "trailname",
  role: "isAdmin",
  verified: "isVerified",
  marketing: "marketing.optedIn",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  lastLoginAt: "lastLoginAt",
  lastActiveAt: "lastActiveAt",
  // Derived in the aggregation below
  lists: "listsCount",
  items: "itemsCount",
  own: "ownItemsCount",
  engagement: "engagementRank",
};

/**
 * Engagement buckets — how far a user got past signing up.
 *
 *  none    signed up, no lists and no gear
 *  copier  has gear, but every item came from copying someone else's list
 *  builder has added their own gear (the first real signal of intent)
 *  power   has built out a substantial kit of their own
 *
 * "Own" means a GlobalItem the user created themselves, i.e. NOT
 * importedFromShare. That is the number worth scanning for.
 */
const POWER_USER_OWN_ITEMS = 25;

const ENGAGEMENT_RANK = { none: 0, copier: 1, builder: 2, power: 3 };

function engagementExpr() {
  return {
    $switch: {
      branches: [
        {
          case: {
            $and: [
              { $eq: ["$listsCount", 0] },
              { $eq: ["$itemsCount", 0] },
            ],
          },
          then: "none",
        },
        {
          case: { $gte: ["$ownItemsCount", POWER_USER_OWN_ITEMS] },
          then: "power",
        },
        { case: { $gt: ["$ownItemsCount", 0] }, then: "builder" },
      ],
      default: "copier",
    },
  };
}

/**
 * GET /api/admin/users
 * List users with search, filters, pagination and sorting.
 *
 * Each row is enriched with derived engagement data so the table can answer
 * "what is this person actually doing?" at a glance:
 *   listsCount / listsCopied   how many lists, how many are copies
 *   itemsCount                 My Gear size (excludes wishlisted)
 *   catalogItemsCount          items linked to a CatalogItem
 *   customItemsCount           items with no catalog link (hand-typed by SOMEONE —
 *                              note these can arrive via a copy, so this is not
 *                              a measure of what the user typed themselves)
 *   ownItemsCount              items the user added themselves (not from a copy)
 *   importedItemsCount         items that arrived by copying someone's list
 *   engagement                 none | copier | builder | power
 *
 * These are computed in-aggregation (not post-pagination) so sorting and
 * filtering on them is correct across the whole result set.
 *
 * Query params:
 *  - q           (optional) search term (email / trailname)
 *  - isVerified  (optional) "true" | "false" | "all"
 *  - role        (optional) "admin" | "user"
 *  - engagement  (optional) "none" | "copier" | "builder" | "power" | "all"
 *  - limit       (optional) default 50, max 200
 *  - skip        (optional) default 0
 *  - sortField   (optional) field to sort by (see USER_SORT_FIELD_MAP)
 *  - sortDir     (optional) "asc" | "desc" (default "desc")
 */
router.get("/", async (req, res) => {
  try {
    const {
      q,
      isVerified = "all",
      role = "all",
      engagement = "all",
      limit = 50,
      skip = 0,
      sortField = "createdAt",
      sortDir = "desc",
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

    const dbSortField = USER_SORT_FIELD_MAP[sortField] || "createdAt";
    const dbSortDir = sortDir === "asc" ? 1 : -1;

    const pipeline = [
      { $match: query },

      // Lists owned, and how many of them are copies of someone else's list
      {
        $lookup: {
          from: "gearlists",
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$owner", "$$uid"] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                copied: {
                  $sum: {
                    $cond: [{ $ifNull: ["$copiedFrom.at", false] }, 1, 0],
                  },
                },
                lastListUpdatedAt: { $max: "$updatedAt" },
              },
            },
          ],
          as: "listAgg",
        },
      },

      // My Gear composition. Wishlisted items are excluded to match the
      // counts shown everywhere else in the app.
      {
        $lookup: {
          from: "globalitems",
          let: { uid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$owner", "$$uid"] },
                status: { $ne: "wishlisted" },
              },
            },
            {
              $group: {
                _id: null,
                catalog: {
                  $sum: { $cond: [{ $ifNull: ["$productId", false] }, 1, 0] },
                },
                custom: {
                  $sum: { $cond: [{ $ifNull: ["$productId", false] }, 0, 1] },
                },
                imported: {
                  $sum: { $cond: [{ $eq: ["$importedFromShare", true] }, 1, 0] },
                },
                own: {
                  $sum: { $cond: [{ $eq: ["$importedFromShare", true] }, 0, 1] },
                },
                lastItemAddedAt: { $max: "$createdAt" },
              },
            },
          ],
          as: "itemAgg",
        },
      },

      {
        $addFields: {
          listsCount: { $ifNull: [{ $first: "$listAgg.count" }, 0] },
          listsCopied: { $ifNull: [{ $first: "$listAgg.copied" }, 0] },
          lastListUpdatedAt: { $first: "$listAgg.lastListUpdatedAt" },
          catalogItemsCount: { $ifNull: [{ $first: "$itemAgg.catalog" }, 0] },
          customItemsCount: { $ifNull: [{ $first: "$itemAgg.custom" }, 0] },
          importedItemsCount: { $ifNull: [{ $first: "$itemAgg.imported" }, 0] },
          ownItemsCount: { $ifNull: [{ $first: "$itemAgg.own" }, 0] },
          lastItemAddedAt: { $first: "$itemAgg.lastItemAddedAt" },
        },
      },
      {
        $addFields: {
          itemsCount: { $add: ["$catalogItemsCount", "$customItemsCount"] },
        },
      },
      { $addFields: { engagement: engagementExpr() } },
      {
        $addFields: {
          engagementRank: {
            $switch: {
              branches: Object.entries(ENGAGEMENT_RANK).map(([key, rank]) => ({
                case: { $eq: ["$engagement", key] },
                then: rank,
              })),
              default: 0,
            },
          },
        },
      },

      ...(ENGAGEMENT_RANK[engagement] !== undefined
        ? [{ $match: { engagement } }]
        : []),

      {
        $project: {
          listAgg: 0,
          itemAgg: 0,
          passwordHash: 0,
          refreshTokens: 0,
          verifyEmailToken: 0,
          verifyEmailExpires: 0,
          resetPasswordToken: 0,
          resetPasswordExpires: 0,
        },
      },

      {
        $facet: {
          rows: [
            { $sort: { [dbSortField]: dbSortDir, _id: 1 } },
            { $skip: safeSkip },
            { $limit: safeLimit },
          ],
          meta: [{ $count: "total" }],
        },
      },
    ];

    const [result] = await User.aggregate(pipeline);

    res.json({
      users: result?.rows || [],
      total: result?.meta?.[0]?.total || 0,
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
      .select(
        "title createdAt updatedAt region tripStart tripEnd location isFeatured isSample isLocked copiedFrom"
      )
      .lean();

    // Per-list item counts and active-share status
    const listIds = lists.map((l) => l._id);
    let itemCountByList = {};
    let sharedListIds = new Set();
    if (listIds.length > 0) {
      const [itemCounts, shareTokens] = await Promise.all([
        GearItem.aggregate([
          { $match: { gearList: { $in: listIds } } },
          { $group: { _id: "$gearList", count: { $sum: 1 } } },
        ]),
        ShareToken.find({ list: { $in: listIds }, revokedAt: null })
          .select("list")
          .lean(),
      ]);
      itemCountByList = itemCounts.reduce((acc, row) => {
        acc[String(row._id)] = row.count;
        return acc;
      }, {});
      sharedListIds = new Set(shareTokens.map((t) => String(t.list)));
    }

    const enrichedLists = lists.map((l) => ({
      ...l,
      itemCount: itemCountByList[String(l._id)] || 0,
      hasActiveShare: sharedListIds.has(String(l._id)),
    }));

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
      lists: enrichedLists,
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
 * GET /api/admin/users/:id/activity
 *
 * The "what is this person actually doing?" view.
 *
 * Treklist has no event log, so everything here is reconstructed from document
 * timestamps and provenance flags. Two flags carry most of the signal:
 *   GlobalItem.importedFromShare  true  => arrived by copying someone's list
 *                                 false => the user chose and added it
 *   GearList.copiedFrom           set   => this list started as a copy
 *
 * What this CAN see: what they added, when, in what order, what they kept from
 * a copy, and what copied gear they abandoned.
 * What it CANNOT see: deletions (only inferred), renames, and browsing. An
 * imported item with no list row is *probably* deleted from the list, but it
 * could equally have been imported and never placed.
 */

// An item added to My Gear and dropped into a list is one user action; the two
// documents are written within moments of each other.
const SAME_ACTION_MS = 10_000;
// Ignore the write-back that immediately follows a create (variant defaults etc).
const MEANINGFUL_EDIT_MS = 1500;

router.get("/:id/activity", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const user = await User.findById(id).select("email createdAt").lean();
    if (!user) return res.status(404).json({ message: "User not found." });

    const ownerId = new mongoose.Types.ObjectId(id);

    const [lists, globalItems] = await Promise.all([
      GearList.find({ owner: ownerId })
        .sort({ createdAt: 1 })
        .select("title createdAt updatedAt copiedFrom tripStart location")
        .lean(),
      GlobalItem.find({ owner: ownerId })
        .sort({ createdAt: 1 })
        .select(
          "brand name itemType weight variantKey productId catalogCategory catalogSubcategory importedFromShare status createdAt updatedAt"
        )
        .lean(),
    ]);

    const listIds = lists.map((l) => l._id);
    const gearItems = listIds.length
      ? await GearItem.find({ gearList: { $in: listIds } })
          .select("gearList globalItem name brand createdAt updatedAt")
          .sort({ createdAt: 1 })
          .lean()
      : [];

    const listById = new Map(lists.map((l) => [String(l._id), l]));
    const globalById = new Map(globalItems.map((g) => [String(g._id), g]));

    // ---- My Gear composition -------------------------------------------------
    const active = globalItems.filter((g) => g.status !== "wishlisted");
    const ownGear = active.filter((g) => !g.importedFromShare);
    const importedGear = active.filter((g) => g.importedFromShare);

    // Which My Gear templates are actually placed in a list right now?
    const placedGlobalIds = new Set(
      gearItems.map((it) => String(it.globalItem)).filter(Boolean)
    );

    // Imported gear sitting in My Gear with no list row = copy residue. Usually
    // means they took a copy and then stripped items out of it.
    const unusedImported = importedGear.filter(
      (g) => !placedGlobalIds.has(String(g._id))
    );

    // ---- Per-list breakdown --------------------------------------------------
    const itemsByList = new Map();
    for (const it of gearItems) {
      const key = String(it.gearList);
      if (!itemsByList.has(key)) itemsByList.set(key, []);
      itemsByList.get(key).push(it);
    }

    // Source list sizes, so "kept 9 of 62" is possible for lists still around.
    const sourceIds = lists
      .map((l) => l.copiedFrom?.list)
      .filter(Boolean)
      .map((x) => new mongoose.Types.ObjectId(String(x)));

    let sourceInfoById = new Map();
    if (sourceIds.length) {
      const [sourceLists, sourceCounts] = await Promise.all([
        GearList.find({ _id: { $in: sourceIds } })
          .select("title owner")
          .lean(),
        GearItem.aggregate([
          { $match: { gearList: { $in: sourceIds } } },
          { $group: { _id: "$gearList", count: { $sum: 1 } } },
        ]),
      ]);
      const countById = new Map(
        sourceCounts.map((r) => [String(r._id), r.count])
      );
      sourceInfoById = new Map(
        sourceLists.map((l) => [
          String(l._id),
          { title: l.title, itemCount: countById.get(String(l._id)) ?? null },
        ])
      );
    }

    const listBreakdown = lists.map((l) => {
      const rows = itemsByList.get(String(l._id)) || [];
      let keptFromCopy = 0;
      let ownAdded = 0;
      for (const r of rows) {
        const g = globalById.get(String(r.globalItem));
        if (g?.importedFromShare) keptFromCopy += 1;
        else ownAdded += 1;
      }

      const src = l.copiedFrom?.list
        ? sourceInfoById.get(String(l.copiedFrom.list))
        : null;

      return {
        _id: l._id,
        title: l.title,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        tripStart: l.tripStart || null,
        location: l.location || "",
        itemCount: rows.length,
        keptFromCopy,
        ownAdded,
        copiedFrom: l.copiedFrom?.at
          ? {
              listId: l.copiedFrom.list || null,
              title: l.copiedFrom.title || src?.title || null,
              ownerEmail: l.copiedFrom.ownerEmail || null,
              at: l.copiedFrom.at,
              sourceStillExists: Boolean(src),
              // Only meaningful while the source list exists and is unedited;
              // treat as indicative, not exact.
              sourceItemCount: src?.itemCount ?? null,
            }
          : null,
      };
    });

    // ---- Their own gear, with where it ended up ------------------------------
    const listTitlesByGlobal = new Map();
    for (const it of gearItems) {
      const key = String(it.globalItem);
      if (!key) continue;
      const title = listById.get(String(it.gearList))?.title;
      if (!title) continue;
      if (!listTitlesByGlobal.has(key)) listTitlesByGlobal.set(key, new Set());
      listTitlesByGlobal.get(key).add(title);
    }

    const ownItems = ownGear.map((g) => ({
      _id: g._id,
      brand: g.brand || "",
      name: g.name,
      itemType: g.itemType || "",
      weight: g.weight ?? null,
      variantKey: g.variantKey || null,
      isCustom: !g.productId,
      category: [g.catalogCategory, g.catalogSubcategory]
        .filter(Boolean)
        .join(" / "),
      createdAt: g.createdAt,
      edited: g.updatedAt - g.createdAt > MEANINGFUL_EDIT_MS,
      inLists: Array.from(listTitlesByGlobal.get(String(g._id)) || []),
    }));

    // ---- Timeline ------------------------------------------------------------
    const events = [];

    events.push({
      at: user.createdAt,
      type: "signup",
      label: "Signed up",
      detail: user.email,
    });

    for (const l of listBreakdown) {
      if (l.copiedFrom) {
        const from = l.copiedFrom.title || "a shared list";
        const by = l.copiedFrom.ownerEmail ? ` (${l.copiedFrom.ownerEmail})` : "";
        events.push({
          at: l.createdAt,
          type: "list.copied",
          label: `Copied "${from}"${by}`,
          detail:
            l.copiedFrom.sourceItemCount != null
              ? `${l.copiedFrom.sourceItemCount} items copied in`
              : null,
          listId: l._id,
        });
      } else {
        events.push({
          at: l.createdAt,
          type: "list.created",
          label: `Created list "${l.title}"`,
          detail: null,
          listId: l._id,
        });
      }
    }

    // Gear the user chose themselves. If a list row appeared at the same moment,
    // fold it into one event rather than reporting the same action twice.
    for (const g of ownGear) {
      const rows = gearItems.filter(
        (it) =>
          String(it.globalItem) === String(g._id) &&
          Math.abs(new Date(it.createdAt) - new Date(g.createdAt)) <=
            SAME_ACTION_MS
      );
      const intoList = rows.length
        ? listById.get(String(rows[0].gearList))?.title
        : null;

      events.push({
        at: g.createdAt,
        type: "item.added",
        label: `Added ${[g.brand, g.name].filter(Boolean).join(" ")}`,
        detail: intoList ? `to "${intoList}"` : "to My Gear",
        meta: [g.itemType, g.variantKey, g.weight != null ? `${g.weight} g` : null]
          .filter(Boolean)
          .join(" · "),
      });

      if (new Date(g.updatedAt) - new Date(g.createdAt) > MEANINGFUL_EDIT_MS) {
        events.push({
          at: g.updatedAt,
          type: "item.edited",
          label: `Edited ${[g.brand, g.name].filter(Boolean).join(" ")}`,
          detail: g.variantKey ? `variant: ${g.variantKey}` : null,
        });
      }
    }

    // Gear already in My Gear, dropped into a list later — a separate action
    // from adding it, and worth seeing (it's how a returning user builds).
    for (const it of gearItems) {
      const g = globalById.get(String(it.globalItem));
      if (!g || g.importedFromShare) continue;
      const gap = new Date(it.createdAt) - new Date(g.createdAt);
      if (gap <= SAME_ACTION_MS) continue; // already covered by item.added
      const title = listById.get(String(it.gearList))?.title;
      events.push({
        at: it.createdAt,
        type: "item.placed",
        label: `Placed ${[g.brand, g.name].filter(Boolean).join(" ")} in "${title || "a list"}"`,
        detail: "from My Gear",
      });
    }

    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    // ---- Session grouping ----------------------------------------------------
    // Distinct days on which the user did something we can see.
    const activeDays = new Set(
      events.map((e) => new Date(e.at).toISOString().slice(0, 10))
    );

    const timestamps = events.map((e) => new Date(e.at).getTime());
    const firstActionAt = timestamps.length ? new Date(Math.min(...timestamps)) : null;
    const lastActionAt = timestamps.length ? new Date(Math.max(...timestamps)) : null;

    res.json({
      summary: {
        listsTotal: lists.length,
        listsCopied: listBreakdown.filter((l) => l.copiedFrom).length,
        listsOriginal: listBreakdown.filter((l) => !l.copiedFrom).length,
        itemsTotal: active.length,
        ownItems: ownGear.length,
        importedItems: importedGear.length,
        customItems: active.filter((g) => !g.productId).length,
        wishlistedItems: globalItems.length - active.length,
        unusedImported: unusedImported.length,
        activeDays: activeDays.size,
        firstActionAt,
        lastActionAt,
      },
      lists: listBreakdown,
      ownItems,
      unusedImported: unusedImported.slice(0, 100).map((g) => ({
        _id: g._id,
        brand: g.brand || "",
        name: g.name,
      })),
      timeline: events.slice(0, 250),
      timelineTruncated: events.length > 250,
    });
  } catch (err) {
    console.error(`GET /api/admin/users/${req.params.id}/activity error`, err);
    res.status(500).json({ message: "Failed to load user activity." });
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

    // Generate fresh verification token (store hash, email raw — F1)
    const verifyToken = crypto.randomBytes(20).toString("hex");
    user.verifyEmailToken = hashToken(verifyToken);
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
