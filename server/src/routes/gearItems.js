const express = require("express");
const auth = require("../middleware/auth");
const GearItem = require("../models/gearItem");
const Category = require("../models/category");
const GearList = require("../models/gearList");

const router = express.Router({ mergeParams: true });
router.use(auth);

const User = require("../models/user");
const MerchantOffer = require("../models/merchantOffer");

/**
 * Add hasOffer flag to a single item
 */
async function addOfferFlagToItem(item, userId) {
  // Get user's region
  const user = await User.findById(userId).select("region").lean();
  const userRegion = normalizeRegion(user?.region);

  // Items with direct links always have offers
  if (item.link) {
    return { ...item, hasOffer: true };
  }

  // Items with productId need offer lookup
  if (item.productId) {
    const offerExists = await MerchantOffer.exists({
      productId: item.productId,
      region: { $in: ["global", userRegion] },
    });
    return { ...item, hasOffer: !!offerExists };
  }

  // Items without link or productId
  return { ...item, hasOffer: false };
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
    const itemsWithOffers = await Promise.all(
      items.map((item) => addOfferFlagToItem(item, req.userId)),
    );

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
      worn,
      consumable,
      quantity,
      position,
    });

    // 4) Add hasOffer flag before returning
    const itemWithOffer = await addOfferFlagToItem(
      newItem.toObject(),
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
