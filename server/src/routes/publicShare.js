// server/src/routes/publicShare.js
const express = require("express");
const mongoose = require("mongoose");
const { resolveActiveToken } = require("../utils/share");
const GearList = require("../models/gearList");
const Category = require("../models/category");
const Item = require("../models/gearItem");
const GlobalItem = require("../models/globalItem");

const router = express.Router();
const auth = require("../middleware/auth");

// simple per-process in-memory lock with TTL
const copyLocks = new Map(); // key: `${userId}:${listId}` -> timeoutId
function withCopyLock(key, fn, ttlMs = 5000) {
  if (copyLocks.has(key)) return Promise.reject(new Error("Copy in progress"));
  copyLocks.set(
    key,
    setTimeout(() => copyLocks.delete(key), ttlMs)
  );
  const clear = () => {
    const t = copyLocks.get(key);
    if (t) clearTimeout(t);
    copyLocks.delete(key);
  };
  return fn().finally(clear);
}

// GET /api/public/share/:token/full
router.get("/:token/full", async (req, res) => {
  const tokenDoc = await resolveActiveToken(req.params.token);
  if (!tokenDoc)
    return res.status(404).json({
      error: "This list has been deleted or the share token has been revoked",
    });
  const listId = tokenDoc.list;

  if (!mongoose.Types.ObjectId.isValid(listId)) {
    return res.status(400).json({ error: "Invalid list" });
  }

  // --- Track views for this share token (best-effort, de-duped) ---
  try {
    const now = Date.now();
    const last =
      tokenDoc.lastViewedAt instanceof Date
        ? tokenDoc.lastViewedAt.getTime()
        : 0;

    // Only count a new view if the last one was > 5s ago
    if (!last || now - last > 5000) {
      tokenDoc.viewsCount = (tokenDoc.viewsCount || 0) + 1;
      tokenDoc.lastViewedAt = new Date(now);
      await tokenDoc.save();
    }
  } catch (err) {
    console.error("Failed to update share views (full):", err);
  }
  // ----------------------------------------------------------------

  const [list, categories, items] = await Promise.all([
    GearList.findById(listId)
      .select({ _id: 1, title: 1, region: 1, storeRegion: 1 })
      .lean(),
    Category.find({ gearList: listId })
      .sort({ position: 1 })
      .select({ _id: 1, title: 1, position: 1 })
      .lean(),
    Item.find({ gearList: listId })
      .sort({ position: 1 })
      .select({
        _id: 1,
        category: 1,
        itemType: 1,
        brand: 1,
        name: 1,
        weight: 1,
        consumable: 1,
        worn: 1,
        quantity: 1,
        price: 1,
        affiliate: 1,
        link: 1,
        position: 1,
      })
      .lean(),
  ]);

  if (!list) return res.status(404).json({ error: "List not found" });

  res.json({
    list: {
      id: list._id.toString(),
      title: list.title,
      region: list.region || null,
      storeRegion: list.storeRegion || null,
    },
    categories: categories.map((c) => ({
      id: c._id.toString(),
      title: c.title,
    })),
    items: items.map((i) => ({
      id: i._id.toString(),
      categoryId: i.category?.toString() || null,
      itemType: i.itemType || "gear",
      brand: i.brand || "",
      name: i.name || "",
      weight_g: typeof i.weight === "number" ? i.weight : null,
      consumable: !!i.consumable,
      worn: !!i.worn,
      qty: i.quantity ?? 1,
      price: typeof i.price === "number" ? i.price : null,
      affiliate: i.affiliate || null,
      link: i.link || null,
    })),
  });
});

// GET /api/public/share/:token/csv  → returns CSV of the list
router.get("/:token/csv", async (req, res) => {
  try {
    const tokenDoc = await resolveActiveToken(req.params.token);
    if (!tokenDoc) {
      return res
        .status(404)
        .type("text/plain")
        .send("This list has been deleted or the share token has been revoked");
    }
    const listId = tokenDoc.list;
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).type("text/plain").send("Invalid list");
    }

    // --- Track views for this share token (best-effort, de-duped) ---
    try {
      const now = Date.now();
      const last =
        tokenDoc.lastViewedAt instanceof Date
          ? tokenDoc.lastViewedAt.getTime()
          : 0;

      if (!last || now - last > 5000) {
        tokenDoc.viewsCount = (tokenDoc.viewsCount || 0) + 1;
        tokenDoc.lastViewedAt = new Date(now);
        await tokenDoc.save();
      }
    } catch (err) {
      console.error("Failed to update share views (csv):", err);
    }
    // ----------------------------------------------------------------

    const [list, categories, items] = await Promise.all([
      GearList.findById(listId).select({ _id: 1, title: 1 }).lean(),
      Category.find({ gearList: listId })
        .sort({ position: 1 })
        .select({ _id: 1, title: 1, position: 1 })
        .lean(),
      Item.find({ gearList: listId })
        .sort({ position: 1 })
        .select({
          _id: 1,
          category: 1,
          itemType: 1,
          brand: 1,
          name: 1,
          weight: 1,
          consumable: 1,
          worn: 1,
          quantity: 1,
          price: 1,
          affiliate: 1,
          link: 1,
          position: 1,
        })
        .lean(),
    ]);
    if (!list) {
      return res.status(404).type("text/plain").send("List not found");
    }

    const catById = new Map(categories.map((c) => [c._id.toString(), c.title]));

    const rows = items.map((i) => ({
      Category: i.category ? catById.get(i.category.toString()) || "" : "",
      "Gear List Item": i.itemType || "",
      Brand: i.brand || "",
      Name: i.name || "",
      "Weight (g)": typeof i.weight === "number" ? i.weight : "",
      Consumable: i.consumable ? "Yes" : "",
      Worn: i.worn ? "Yes" : "",
      Qty: i.quantity ?? 1,
      "Price (USD)": typeof i.price === "number" ? i.price : "",
      Link: (i.affiliate && i.affiliate.url) || i.link || "",
    }));

    const headers = Object.keys(
      rows[0] || {
        Category: "",
        "Gear List Item": "",
        Brand: "",
        Name: "",
        "Weight (g)": "",
        Consumable: "",
        Worn: "",
        Qty: "",
        "Price (USD)": "",
        Link: "",
      }
    );

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return "";
      const s = String(val);
      // quote if contains comma, quote or newline
      if (/[",\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(",")),
    ];
    const csv = lines.join("\n");

    const safeTitle =
      (list.title || "gear-list").trim().replace(/[^\w.-]+/g, "_") +
      "_share.csv";

    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}"`,
      })
      .send(csv);
  } catch (err) {
    console.error("GET /api/public/share/:token/csv failed:", err);
    res.status(500).type("text/plain").send("Internal error");
  }
});

// POST /api/public/share/:token/copy  (auth required)
router.post("/:token/copy", auth, async (req, res) => {
  try {
    const tokenDoc = await resolveActiveToken(req.params.token);
    if (!tokenDoc)
      return res.status(404).json({ error: "Invalid or revoked token" });
    const sourceListId = tokenDoc.list;

    // load source
    const [srcList, srcCats, srcItems] = await Promise.all([
      GearList.findById(sourceListId),
      Category.find({ gearList: sourceListId }).sort({ position: 1 }),
      Item.find({ gearList: sourceListId }).sort({ position: 1 }),
    ]);
    if (!srcList) return res.status(404).json({ error: "List not found" });

    // Accept user id from multiple middleware shapes
    const ownerId =
      req.userId ||
      req.user?.id ||
      req.user?._id ||
      (typeof req.user === "string" ? req.user : null);

    if (!ownerId) {
      // Temporary debug – safe to keep or remove later
      console.warn("Auth present but no ownerId on request", {
        hasUserId: !!req.userId,
        userShape: req.user ? Object.keys(req.user) : null,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }
    // create new list for user (idempotent for brief window)
    const copySuffix = " (copy)";
    const lockKey = `${ownerId}:${sourceListId}`;
    try {
      const result = await withCopyLock(lockKey, async () => {
        // quick check: did we just create a copy with the same title very recently?
        const existing = await GearList.findOne({
          owner: ownerId,
          title: { $in: [srcList.title, `${srcList.title}${copySuffix}`] },
        })
          .sort({ createdAt: -1 })
          .lean();
        if (
          existing &&
          Date.now() - new Date(existing.createdAt).getTime() < 5000
        ) {
          return { list: existing, created: false };
        }
        const newList = await GearList.create({
          owner: ownerId,
          title: `${srcList.title}${copySuffix}`,
        });
        return { list: newList, created: true };
      });
      const newList = result.list;
      // 1) Clone all referenced GlobalItems and build an id map
      const globalIds = Array.from(
        new Set(
          srcItems
            .map((it) => (it.globalItem ? it.globalItem.toString() : null))
            .filter(Boolean)
        )
      );

      const oldToNewGlobalId = {};
      if (globalIds.length) {
        const srcGlobals = await GlobalItem.find({ _id: { $in: globalIds } });
        for (const g of srcGlobals) {
          // clone document for new owner
          const obj = g.toObject({ depopulate: true });
          delete obj._id;
          delete obj.createdAt;
          delete obj.updatedAt;
          // Always assign the new owner
          obj.owner = ownerId;
          const created = await GlobalItem.create({
            ...obj,
            importedFromShare: true,
          });
          oldToNewGlobalId[g._id.toString()] = created._id;
        }
      }

      // map oldCatId -> newCatId
      const catIdMap = {};
      for (const c of srcCats) {
        const nc = await Category.create({
          gearList: newList._id,
          title: c.title,
          position: c.position,
        });
        catIdMap[c._id.toString()] = nc._id;
      }

      // copy items (safer globalItem handling)
      for (const it of srcItems) {
        const payload = {
          gearList: newList._id,
          category: it.category ? catIdMap[it.category.toString()] : null,
          itemType: it.itemType,
          brand: it.brand,
          name: it.name,
          weight: it.weight,
          consumable: it.consumable,
          worn: it.worn,
          quantity: it.quantity,
          price: it.price,
          affiliate: it.affiliate,
          link: it.link,
          position: it.position,
        };

        // rewire globalItem reference (if present). If your schema requires `globalItem`,
        // this falls back to the original id if the clone wasn’t created for any reason.
        if (it.globalItem) {
          payload.globalItem =
            oldToNewGlobalId[it.globalItem.toString()] || it.globalItem;
        }

        await Item.create(payload);
      }
      const body = { listId: newList._id.toString() };
      return result.created ? res.status(201).json(body) : res.json(body);
    } catch (e) {
      if (e.message === "Copy in progress") {
        return res.status(409).json({ error: "Copy already in progress" });
      }
      throw e;
    }
  } catch (err) {
    console.error("POST /api/public/share/:token/copy failed:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
