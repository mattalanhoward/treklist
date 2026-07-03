// server/src/routes/gearLists.js
const mongoose = require("mongoose");
const express = require("express");
const auth = require("../middleware/auth");
const GearList = require("../models/gearList");
const Item = require("../models/gearItem");
const Category = require("../models/category");
const Share = require("../models/ShareToken");
const GlobalItem = require("../models/globalItem");
const CatalogItem = require("../models/catalogItem");
const cloudinary = require("../config/cloudinary");
const {
  ensureActiveTokenForList,
  revokeTokenForList,
} = require("../utils/share");

const router = express.Router();

const User = require("../models/user");
const MerchantOffer = require("../models/merchantOffer");

/**
 * Returns true when both trip dates are present and the end precedes the start.
 * Used to reject invalid trip ranges on create/update.
 */
function isInvalidTripRange(start, end) {
  if (!start || !end) return false;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return e < s;
}

/**
 * Add hasOffer flag to items based on user's region.
 * Falls back to the linked GlobalItem when the GearItem has no link or productId,
 * covering items created before productId denormalization and list copies.
 *
 * @param {Array} items - Array of GearItem documents (lean)
 * @param {string} userId - User ID to get region from
 * @returns {Promise<Array>} Items with hasOffer flag added
 */
async function addOfferFlags(items, userId) {
  if (!items || items.length === 0) return [];

  // 1) Fetch user region once
  const user = await User.findById(userId).select("region").lean();
  const userRegion = normalizeRegion(user?.region);

  // 2) Collect ALL globalItem IDs — needed for both offer fallback and wishlist status
  const allGlobalItemIds = [...new Set(
    items.filter((i) => i.globalItem).map((i) => String(i.globalItem))
  )];

  const globalDocs = allGlobalItemIds.length
    ? await GlobalItem.find({ _id: { $in: allGlobalItemIds } })
        .select("link productId affiliate status variantKey")
        .lean()
    : [];
  const globalById = new Map(globalDocs.map((g) => [String(g._id), g]));

  // 3) Collect all productIds that need an offer check (GearItem or GlobalItem fallback)
  const productIdsToCheck = new Set();
  for (const item of items) {
    if (item.link) continue;
    if (item.productId) {
      productIdsToCheck.add(String(item.productId));
    } else if (item.globalItem) {
      const g = globalById.get(String(item.globalItem));
      if (g?.productId) productIdsToCheck.add(String(g.productId));
    }
  }

  // 4) Single query to find which productIds have an offer for this region
  const offerDocs = productIdsToCheck.size
    ? await MerchantOffer.find({
        productId: { $in: [...productIdsToCheck] },
        region: { $in: ["global", userRegion] },
      })
        .select("productId")
        .lean()
    : [];
  const offerProductIds = new Set(offerDocs.map((o) => String(o.productId)));

  // 5) Assign hasOffer + globalItemStatus + variantKey (from GearItem or its GlobalItem)
  return items.map((item) => {
    const g = item.globalItem ? globalById.get(String(item.globalItem)) : null;
    const globalItemStatus = g?.status ?? null;
    const variantKey = item.variantKey ?? g?.variantKey ?? null;

    let hasOffer = false;
    if (item.link) {
      hasOffer = true; // direct link on the GearItem
    } else if (item.productId) {
      hasOffer = offerProductIds.has(String(item.productId));
    } else if (g) {
      if (g.link) {
        hasOffer = true;
      } else if (g.productId) {
        hasOffer = offerProductIds.has(String(g.productId));
      } else {
        const deep =
          (typeof g.affiliate === "string" ? g.affiliate : null) ||
          g.affiliate?.deepLink ||
          g.affiliate?.awDeepLink ||
          g.affiliate?.url ||
          null;
        if (deep) hasOffer = true;
      }
    }

    return { ...item, hasOffer, globalItemStatus, variantKey };
  });
}

/**
 * Normalize region codes for consistency
 * @param {string} region - Raw region value
 * @returns {string} Normalized region code
 */
function normalizeRegion(region) {
  if (!region) return "global";
  const r = String(region).trim().toLowerCase();
  if (r === "netherlands") return "nl";
  if (r === "united states" || r === "usa") return "us";
  if (r.length === 2) return r;
  return r;
}

// All routes below here require auth
router.use(auth);

// POST /api/dashboard/:listId/share   → returns the single active token (create if missing)
router.post("/:listId/share", async (req, res) => {
  try {
    const { listId } = req.params;
    const [doc, list] = await Promise.all([
      ensureActiveTokenForList(listId, req.userId),
      GearList.findOne({ _id: listId, owner: req.userId })
        .select("shareSettings")
        .lean(),
    ]);
    const shareSettings = list?.shareSettings || {
      showNotes: false,
      showTripDetails: false,
      showLinks: false,
    };
    res.json({ token: doc.token, shareSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/dashboard/:listId/shareSettings
router.patch("/:listId/shareSettings", async (req, res) => {
  try {
    const { listId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "Invalid list ID." });
    }
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "List not found." });
    const { showNotes, showTripDetails, showLinks } = req.body;
    if (typeof showNotes === "boolean") list.shareSettings.showNotes = showNotes;
    if (typeof showTripDetails === "boolean")
      list.shareSettings.showTripDetails = showTripDetails;
    if (typeof showLinks === "boolean") list.shareSettings.showLinks = showLinks;
    await list.save();
    res.json({ shareSettings: list.shareSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/dashboard/:listId/share/revoke
router.post("/:listId/share/revoke", async (req, res) => {
  try {
    const { listId } = req.params;
    // (Optional) verify ownership here if your other routes do — omitted
    const doc = await revokeTokenForList(listId, req.userId);
    if (!doc)
      return res.status(404).json({ message: "No active share to revoke." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/:listId/full
router.get("/:listId/full", async (req, res) => {
  try {
    const { listId } = req.params;

    // 1) ensure this is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ error: "Invalid list ID." });
    }

    // 2) ensure the user owns this list
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }

    // 3) fetch categories and items
    const [categories, items] = await Promise.all([
      Category.find({ gearList: listId }).sort({ position: 1 }),
      Item.find({ gearList: listId }).sort({ category: 1, position: 1 }).lean(),
    ]);

    // 4) Add hasOffer flag to each item based on user's region
    const itemsWithOfferFlags = await addOfferFlags(items, req.userId);

    return res.json({ list, categories, items: itemsWithOfferFlags });
  } catch (err) {
    console.error("Error in GET /dashboard/:listId/full →", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

// GET /api/dashboard — only this user’s lists (with itemCount + baseWeight)
router.get("/", async (req, res) => {
  try {
    const lists = await GearList.find({ owner: req.userId });

    const listIds = lists.map((l) => l._id);
    const stats = await Item.aggregate([
      { $match: { gearList: { $in: listIds } } },
      {
        $group: {
          _id: "$gearList",
          itemCount: { $sum: 1 },
          baseWeight: {
            $sum: {
              $cond: [
                { $ne: ["$worn", true] },
                {
                  $multiply: [
                    { $ifNull: ["$weight", 0] },
                    { $ifNull: ["$quantity", 1] },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);
    const statsMap = Object.fromEntries(
      stats.map((s) => [String(s._id), s])
    );
    const listsWithStats = lists.map((l) => ({
      ...l.toObject(),
      itemCount: statsMap[String(l._id)]?.itemCount ?? 0,
      baseWeight: statsMap[String(l._id)]?.baseWeight ?? 0,
    }));

    res.json(listsWithStats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/dashboard — create a new gear list + one sample category
router.post("/", async (req, res) => {
  try {
    const { title, region, tripStart, tripEnd, location } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required." });
    if (isInvalidTripRange(tripStart, tripEnd)) {
      return res
        .status(400)
        .json({ message: "Trip end date can't be before the start date." });
    }

    // 1) create the gear list
    const newList = await GearList.create({
      owner: req.userId,
      title,
      // region is optional; if client doesn’t send it we store null
      region: region || null,
      tripStart: tripStart || null,
      tripEnd: tripEnd || null,
      location: location || null,
    });

    // 2) seed exactly one category at position 0
    const sample = await Category.create({
      gearList: newList._id,
      title: "Sample Category",
      position: 0,
    });

    // 3) return both
    res.status(201).json({ list: newList, categories: [sample] });
  } catch (err) {
    console.error("Error creating list:", err);
    // send the real error back so you can see it in your client console
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/dashboard/:listId — rename a list
router.patch("/:listId", async (req, res) => {
  try {
    // pull all updatable props from body
    const { title, notes, tripStart, tripEnd, location, links, backgroundColor } =
      req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required." });
    }

    // Check if list exists and is owned by user
    const list = await GearList.findOne({
      _id: req.params.listId,
      owner: req.userId,
    });

    if (!list) {
      return res.status(404).json({ message: "List not found." });
    }

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    // Validate the effective trip range (new value if provided, else existing).
    const effectiveStart = tripStart !== undefined ? tripStart : list.tripStart;
    const effectiveEnd = tripEnd !== undefined ? tripEnd : list.tripEnd;
    if (isInvalidTripRange(effectiveStart, effectiveEnd)) {
      return res
        .status(400)
        .json({ message: "Trip end date can't be before the start date." });
    }

    // build an update object only with provided fields
    const update = { title };
    if (notes !== undefined) update.notes = notes;
    if (tripStart !== undefined) {
      update.tripStart = tripStart;
      // Re-arm the pre-trip reminder if the start date actually changed.
      const prev = list.tripStart ? new Date(list.tripStart).getTime() : null;
      const next = tripStart ? new Date(tripStart).getTime() : null;
      if (prev !== next) update.tripReminderSentAt = null;
    }
    if (tripEnd !== undefined) update.tripEnd = tripEnd;
    if (location !== undefined) update.location = location;
    if (links !== undefined) update.links = links;
    if (backgroundColor !== undefined) update.backgroundColor = backgroundColor;

    const updated = await GearList.findOneAndUpdate(
      { _id: req.params.listId, owner: req.userId },
      update,
      { new: true },
    );

    // return the full updated document
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/dashboard/:listId — delete a list and its categories
router.delete("/:listId", async (req, res) => {
  try {
    const deleted = await GearList.findOneAndDelete({
      _id: req.params.listId,
      owner: req.userId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "List not found." });
    }

    // cascade-delete everything tied to that list
    await Promise.all([
      Category.deleteMany({ gearList: req.params.listId }),
      Item.deleteMany({ gearList: req.params.listId }),
      Share.deleteMany({ list: req.params.listId }),
    ]);

    return res.json({ message: "List and all related data deleted." });
  } catch (err) {
    console.error("Error deleting list:", err.message);
    return res.status(500).json({ message: "Server error deleting list." });
  }
});

// PATCH /api/dashboard/:listId/preferences
router.patch("/:listId/preferences", async (req, res, next) => {
  try {
    const { listId } = req.params;
    const { backgroundColor, backgroundImageUrl } = req.body;

    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "List not found" });

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    // Color update: clear ACTIVE image only (do not delete customBackground)
    if (backgroundColor !== undefined) {
      list.backgroundColor = backgroundColor;
      list.backgroundImageUrl = null;
    }

    // Image update (default OR custom): set ACTIVE image only
    if (backgroundImageUrl) {
      list.backgroundImageUrl = backgroundImageUrl;
      list.backgroundColor = null;
    }

    await list.save();

    return res.json({
      list: {
        _id: list._id,
        backgroundColor: list.backgroundColor,
        backgroundImageUrl: list.backgroundImageUrl,
        customBackground: list.customBackground,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:listId/preferences/image-direct", async (req, res, next) => {
  try {
    const { listId } = req.params;
    const { imageUrl, publicId } = req.body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ message: "imageUrl is required" });
    }

    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "List not found" });

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    const oldPublicId = list.customBackground?.publicId || null;

    // Set ACTIVE background
    list.backgroundImageUrl = imageUrl;
    list.backgroundColor = null;

    // Set SAVED custom background tile
    list.customBackground = {
      url: imageUrl,
      publicId: publicId || null,
      updatedAt: new Date(),
    };

    await list.save();

    // Best-effort delete old custom asset (only if it exists and differs)
    if (oldPublicId && oldPublicId !== publicId) {
      cloudinary.uploader.destroy(oldPublicId).catch(() => {});
    }

    return res.json({
      imageUrl: list.backgroundImageUrl,
      customBackground: list.customBackground,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/dashboard/:listId/lock — toggle list lock
router.patch("/:listId/lock", async (req, res, next) => {
  try {
    const { listId } = req.params;
    const { isLocked } = req.body;

    if (typeof isLocked !== "boolean") {
      return res.status(400).json({ message: "isLocked must be a boolean" });
    }

    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "List not found" });

    list.isLocked = isLocked;
    await list.save();

    return res.json({ isLocked: list.isLocked });
  } catch (err) {
    next(err);
  }
});

// POST /api/dashboard/sample-list
// Create (or reuse) a sample gear list for the current user.
router.post("/sample-list", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    // If we already created a sample list for this user, just reuse it
    let sample = await GearList.findOne({ owner: userId, isSample: true });
    if (sample) {
      return res.json({ list: sample, reused: true });
    }

    // 1) Create the sample list itself
    sample = await GearList.create({
      owner: userId,
      title: "Sample Dolomites Gear List",
      description:
        "A small example gear list using a few of my real-world favorite items.",
      isSample: true,
    });

    // 2) Seed categories for the sample list
    const categoryTitles = [
      "Hiking",
      "Clothing",
      "Rifugios",
      "Electronics",
      "Hygiene",
      "Other",
    ];

    const categoryDocs = await Category.insertMany(
      categoryTitles.map((title, index) => ({
        gearList: sample._id,
        title,
        position: index,
      })),
    );

    // 3) Seed affiliate-backed hero items by linking to existing CatalogItems.
    // IMPORTANT: we do NOT store a hardcoded link here.
    // The UI will call /api/affiliates/offers/resolve-link using globalItemId,
    // which looks up MerchantOffer by GlobalItem.productId (+ region).
    const itemSpecs = [
      {
        categoryTitle: "Hiking",
        catalogItemId: "6952d06d77f0204ff7da39d1", // Osprey Stratos 24
        worn: false,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Hiking",
        catalogItemId: "695820670ae7ad8d1ba15a04", // Sea to Summit Lightweight Dry Bag
        worn: false,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Clothing",
        catalogItemId: "6956837de9f5d8692a3e06d1", // Darn Tough socks
        worn: true,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Clothing",
        catalogItemId: "6956837de9f5d8692a3e0708", // Pesu hat (direct offer)
        worn: true,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Hiking",
        catalogItemId: "696bab841d02c9b950131501", // Black Diamond Distance Z poles
        worn: false,
        consumable: false,
        quantity: 1,
      },
    ];

    const catalogIds = itemSpecs.map((x) => x.catalogItemId);
    const catalogDocs = await CatalogItem.find({ _id: { $in: catalogIds } })
      .lean()
      .exec();

    const catalogById = new Map(catalogDocs.map((d) => [String(d._id), d]));

    const missing = catalogIds.filter((id) => !catalogById.get(String(id)));
    if (missing.length) {
      return res.status(500).json({
        message: "Sample list seed failed: missing CatalogItem(s).",
        missingCatalogItemIds: missing,
      });
    }

    // Map category title → doc for easy lookup
    const categoryByTitle = new Map(
      categoryDocs.map((cat) => [cat.title, cat]),
    );

    // catalogIds already validated + catalogById already built

    const productObjectIds = itemSpecs.map(
      (spec) => catalogById.get(String(spec.catalogItemId))._id,
    );

    // 1) Upsert global items by owner+productId (idempotent)
    await GlobalItem.bulkWrite(
      itemSpecs.map((spec) => {
        const c = catalogById.get(String(spec.catalogItemId));
        return {
          updateOne: {
            filter: { owner: userId, productId: c._id },
            update: {
              $setOnInsert: {
                owner: userId,
                productId: c._id,
                catalogCategory: c.category ?? null,
                catalogSubcategory: c.subcategory ?? null,
                brand: c.brand ?? null,
                itemType: c.itemType ?? null,
                name: c.name,
                description: c.description ?? null,
                weight:
                  typeof c.weightGrams === "number" ? c.weightGrams : null,
                weightSource: "catalog",
                link: null,
                worn: spec.worn,
                consumable: spec.consumable,
                quantity: spec.quantity,
                importedFromShare: true, // sample items appear in "Shared List" tab, not "Owned Gear"
              },
            },
            upsert: true,
          },
        };
      }),
    );

    // 2) Fetch them back in the same order as itemSpecs
    const globals = await GlobalItem.find({
      owner: userId,
      productId: { $in: productObjectIds },
    })
      .select("_id productId")
      .lean();

    const globalByProductId = new Map(
      globals.map((g) => [String(g.productId), g]),
    );

    // 3) Build an ordered array matching itemSpecs order
    const globalItems = itemSpecs.map((spec) => {
      const c = catalogById.get(String(spec.catalogItemId));
      const g = globalByProductId.get(String(c._id));
      if (!g) throw new Error(`Missing GlobalItem for productId ${c._id}`);
      return g;
    });

    // And the list-specific GearItem docs
    const positionsByCategory = new Map();
    const gearItemsPayload = itemSpecs.map((spec, index) => {
      const catDoc = categoryByTitle.get(spec.categoryTitle);
      if (!catDoc) {
        throw new Error(
          `Missing category document for title: ${spec.categoryTitle}`,
        );
      }

      const catId = catDoc._id.toString();
      const currentPos = positionsByCategory.get(catId) ?? 0;
      positionsByCategory.set(catId, currentPos + 1);

      const global = globalItems[index];
      const c = catalogById.get(String(spec.catalogItemId));

      return {
        globalItem: global._id,
        productId: c._id,
        gearList: sample._id,
        category: catDoc._id,
        brand: c.brand ?? null,
        itemType: c.itemType ?? null,
        name: c.name,
        description: c.description ?? null,
        weight: typeof c.weightGrams === "number" ? c.weightGrams : null,
        link: null, // let resolver provide affiliate link
        worn: spec.worn,
        consumable: spec.consumable,
        quantity: spec.quantity,
        position: currentPos,
      };
    });

    await Item.insertMany(gearItemsPayload);

    return res.status(201).json({ list: sample, created: true });
  } catch (err) {
    console.error("Error creating sample list:", err);
    return res.status(500).json({ message: "Could not create sample list." });
  }
});

// POST /api/dashboard/:listId/copy
router.post("/:listId/copy", async (req, res) => {
  try {
    const { listId } = req.params;

    // 1) Find original list (lean to avoid mongoose doc overhead)
    const orig = await GearList.findOne({
      _id: listId,
      owner: req.userId,
    }).lean();

    if (!orig) return res.status(404).json({ error: "List not found" });

    // 2) Create the new list
    const copy = await GearList.create({
      owner: req.userId,
      title: `Copy of ${orig.title}`,
      region: orig.region || null,
      // If you want to copy these too, uncomment:
      // backgroundColor: orig.backgroundColor || "",
      // backgroundImageUrl: orig.backgroundImageUrl || "",
      // customBackground: orig.customBackground || undefined,
      // backgroundImageHistory: orig.backgroundImageHistory || [],
    });

    // 3) Read all categories once
    const cats = await Category.find({ gearList: orig._id })
      .sort({ position: 1 })
      .lean();

    // 4) Bulk insert categories for the new list
    const newCatDocs = cats.map((c) => ({
      gearList: copy._id,
      title: c.title,
      position: c.position,
    }));

    const insertedCats = newCatDocs.length
      ? await Category.insertMany(newCatDocs)
      : [];

    // 5) Map oldCatId -> newCatId (insertMany preserves input order)
    const catIdMap = new Map();
    for (let i = 0; i < cats.length; i++) {
      catIdMap.set(String(cats[i]._id), insertedCats[i]._id);
    }

    // 6) Read all items once (no per-category query)
    const items = await Item.find({ gearList: orig._id }).lean();

    // 7) Bulk insert items for the new list
    const newItemDocs = items
      .map((i) => {
        const newCatId = catIdMap.get(String(i.category));
        if (!newCatId) return null; // safety guard if orphaned item

        return {
          globalItem: i.globalItem,
          productId: i.productId,
          name: i.name,
          gearList: copy._id,
          category: newCatId,
          brand: i.brand,
          itemType: i.itemType,
          description: i.description,
          weight: i.weight,
          link: i.link,
          worn: i.worn,
          consumable: i.consumable,
          quantity: i.quantity,
          position: i.position,
        };
      })
      .filter(Boolean);

    if (newItemDocs.length) {
      await Item.insertMany(newItemDocs);
    }

    return res.json({ list: copy });
  } catch (err) {
    console.error("Copy list error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
