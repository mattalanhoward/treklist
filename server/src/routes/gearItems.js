const express = require("express");
const auth = require("../middleware/auth");
const GearItem = require("../models/gearItem");
const Category = require("../models/category");
const GearList = require("../models/gearList");

const router = express.Router({ mergeParams: true });
router.use(auth);

const User = require("../models/user");
const MerchantOffer = require("../models/merchantOffer");
const GlobalItem = require("../models/globalItem");

/**
 * Add hasOffer flags to a batch of items in one pass.
 * Fetches user region once, batch-fetches needed GlobalItems,
 * and batch-checks MerchantOffers — no N+1 queries.
 */
async function addOfferFlagsToItems(items, userId) {
  if (!items.length) return items;

  // 1) Fetch user region once
  const user = await User.findById(userId).select("region").lean();
  const userRegion = normalizeRegion(user?.region);

  // 2) Collect globalItem IDs for items that have no direct link or productId
  // Fetch GlobalItem docs for all items that reference one (for offer flags + status)
  const allGlobalItemIds = [
    ...new Set(items.filter((i) => i.globalItem).map((i) => String(i.globalItem))),
  ];
  const needsFallback = items.filter((i) => !i.link && !i.productId && i.globalItem);
  const globalItemIds = [...new Set(needsFallback.map((i) => String(i.globalItem)))];

  const globalDocs = allGlobalItemIds.length
    ? await GlobalItem.find({ _id: { $in: allGlobalItemIds } })
        .select("link productId affiliate status")
        .lean()
    : [];
  const globalById = new Map(globalDocs.map((g) => [String(g._id), g]));

  // 3) Collect all productIds that need an offer check (from GearItem or GlobalItem fallback)
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

  // 5) Assign hasOffer + globalItemStatus to each item
  return items.map((item) => {
    const g = item.globalItem ? globalById.get(String(item.globalItem)) : null;
    const globalItemStatus = g?.status || "owned";

    // Direct link on the GearItem → always has offer
    if (item.link) return { ...item, hasOffer: true, globalItemStatus };

    // GearItem has its own productId
    if (item.productId) {
      return { ...item, hasOffer: offerProductIds.has(String(item.productId)), globalItemStatus };
    }

    // Fall back to the linked GlobalItem
    if (g) {
      if (g.link) return { ...item, hasOffer: true, globalItemStatus };
      if (g.productId) {
        return { ...item, hasOffer: offerProductIds.has(String(g.productId)), globalItemStatus };
      }
      const deep =
        (typeof g.affiliate === "string" ? g.affiliate : null) ||
        g.affiliate?.deepLink ||
        g.affiliate?.awDeepLink ||
        g.affiliate?.url ||
        null;
      if (deep) return { ...item, hasOffer: true, globalItemStatus };
    }

    return { ...item, hasOffer: false, globalItemStatus };
  });
}

/**
 * Normalize region codes
 */
function normalizeRegion(region) {
  if (!region) return "global";
  const r = String(region).trim().toLowerCase();
  if (r === "netherlands") return "nl";
  if (r === "united states" || r === "usa") return "us";
  if (r.length === 2) return r;
  return r;
}

// ─── GET /api/dashboard/:listId/categories/:catId/items ───
// Return all items in this category
router.get("/", async (req, res) => {
  const { listId, catId } = req.params;

  try {
    // 1) Verify list ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) {
      return res.status(404).json({ message: "Gear list not found." });
    }

    // 2) Verify that this category lives under that list
    const cat = await Category.findOne({ _id: catId, gearList: listId });
    if (!cat) {
      return res.status(404).json({ message: "Category not found." });
    }

    // 3) Fetch items
    const items = await GearItem.find({ gearList: listId, category: catId })
      .sort("position")
      .lean();

    // 4) Add hasOffer flags to all items
    const itemsWithOffers = await addOfferFlagsToItems(items, req.userId);

    return res.json(itemsWithOffers);
  } catch (err) {
    console.error("Error GET items:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /api/dashboard/:listId/categories/:catId/items ───
// Create a new item in this category
router.post("/", async (req, res) => {
  const { listId, catId } = req.params;
  const {
    globalItem,
    productId,
    brand,
    itemType,
    name,
    description,
    weight,
    link,
    imageUrls,
    worn,
    consumable,
    quantity,
    position,
  } = req.body;

  // basic required validation
  if (!globalItem || !name || position == null) {
    return res
      .status(400)
      .json({ message: "Required fields: globalItem, name, position" });
  }

  try {
    // 1) Verify ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) {
      return res.status(404).json({ message: "Gear list not found." });
    }

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    // 2) Verify that category exists under this list
    const cat = await Category.findOne({ _id: catId, gearList: listId });
    if (!cat) {
      return res.status(404).json({ message: "Category not found." });
    }
    // 3) Create the new item
    const newItem = await GearItem.create({
      globalItem,
      productId,
      gearList: listId,
      category: catId,
      brand,
      itemType,
      name,
      description,
      weight,
      link,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      worn,
      consumable,
      quantity,
      position,
    });

    // 4) Add hasOffer flag before returning
    const [itemWithOffer] = await addOfferFlagsToItems(
      [newItem.toObject()],
      req.userId,
    );

    return res.status(201).json(itemWithOffer);
  } catch (err) {
    console.error("Error POST item:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/dashboard/:listId/categories/:catId/items/:itemId ───
// Update inline fields and possibly move to another category
router.patch("/:itemId", async (req, res) => {
  const { listId, catId, itemId } = req.params;

  // Build update object from allowed fields
  const updates = {};
  for (const field of ["consumable", "worn", "quantity", "position"]) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  if (req.body.category) {
    updates.category = req.body.category;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: "No valid fields to update." });
  }

  try {
    // 1) Verify list ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) {
      return res.status(404).json({ message: "Gear list not found." });
    }

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    // 2) Verify old category exists under that list
    const oldCat = await Category.findOne({ _id: catId, gearList: listId });
    if (!oldCat) {
      return res.status(404).json({ message: "Category not found." });
    }

    // 3) If moving category, verify the new target category exists under this same list
    if (updates.category) {
      const newCat = await Category.findOne({
        _id: updates.category,
        gearList: listId,
      });
      if (!newCat) {
        return res.status(400).json({ message: "Target category not found." });
      }
    }

    // 4) Perform the update, still filtering by the “old” category:
    const updated = await GearItem.findOneAndUpdate(
      {
        _id: itemId,
        gearList: listId,
        category: catId,
      },
      updates,
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Item not found." });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error PATCH item:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /api/dashboard/:listId/categories/:catId/items/:itemId/swap ───
// Swap the globalItem reference to another item from the user's gear
router.patch("/:itemId/swap", async (req, res) => {
  const { listId, catId, itemId } = req.params;
  const { newGlobalItemId } = req.body;

  if (!newGlobalItemId) {
    return res.status(400).json({ message: "newGlobalItemId is required." });
  }

  try {
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "Gear list not found." });
    if (list.isLocked) return res.status(403).json({ message: "List is locked" });

    const newGlobal = await GlobalItem.findOne({
      _id: newGlobalItemId,
      owner: req.userId,
    }).lean();
    if (!newGlobal) return res.status(404).json({ message: "Global item not found." });

    const snapshot = {
      globalItem: newGlobal._id,
      productId: newGlobal.productId || null,
      name: newGlobal.name,
      brand: newGlobal.brand || "",
      itemType: newGlobal.itemType || "",
      weight: newGlobal.weight ?? null,
      link: newGlobal.link || null,
      imageUrls: newGlobal.imageUrls || [],
      description: newGlobal.description || "",
    };

    const updated = await GearItem.findOneAndUpdate(
      { _id: itemId, gearList: listId, category: catId },
      { $set: snapshot },
      { new: true },
    );
    if (!updated) return res.status(404).json({ message: "Item not found." });

    const [itemWithOffer] = await addOfferFlagsToItems(
      [updated.toObject()],
      req.userId,
    );
    return res.json(itemWithOffer);
  } catch (err) {
    console.error("Error PATCH swap item:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /api/dashboard/:listId/categories/:catId/items/:itemId ───
// Remove one gear item
router.delete("/:itemId", async (req, res) => {
  const { listId, catId, itemId } = req.params;

  try {
    // 1) Verify list ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) {
      return res.status(404).json({ message: "Gear list not found." });
    }

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    // 2) Verify category
    const cat = await Category.findOne({ _id: catId, gearList: listId });
    if (!cat) {
      return res.status(404).json({ message: "Category not found." });
    }

    // 3) Delete the item
    const deleted = await GearItem.findOneAndDelete({
      _id: itemId,
      gearList: listId,
      category: catId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Item not found." });
    }

    return res.json({ message: "Item deleted." });
  } catch (err) {
    console.error("Error DELETE item:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
