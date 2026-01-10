// server/src/routes/gearLists.js
const mongoose = require("mongoose");
const express = require("express");
const auth = require("../middleware/auth");
const GearList = require("../models/gearList");
const Item = require("../models/gearItem");
const Category = require("../models/category");
const Share = require("../models/ShareToken");
const GlobalItem = require("../models/globalItem");
const cloudinary = require("../config/cloudinary");
const { v4: uuidv4 } = require("uuid");
const upload = require("../middleware/upload");
const {
  ensureActiveTokenForList,
  revokeTokenForList,
} = require("../utils/share");

const router = express.Router();

// All routes below here require auth
router.use(auth);

// POST /api/dashboard/:listId/share   → returns the single active token (create if missing)
router.post("/:listId/share", async (req, res) => {
  try {
    const { listId } = req.params;
    // (Optional) verify ownership here if your other routes do — omitted for brevity
    const doc = await ensureActiveTokenForList(listId, req.userId);
    res.json({ token: doc.token });
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
      Item.find({ gearList: listId }).sort({ category: 1, position: 1 }),
    ]);

    return res.json({ list, categories, items });
  } catch (err) {
    console.error("Error in GET /dashboard/:listId/full →", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

// GET /api/dashboard — only this user’s lists
router.get("/", async (req, res) => {
  try {
    const lists = await GearList.find({ owner: req.userId });
    res.json(lists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/dashboard — create a new gear list + one sample category
router.post("/", async (req, res) => {
  try {
    const { title, region } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required." });

    // 1) create the gear list
    const newList = await GearList.create({
      owner: req.userId,
      title,
      // region is optional; if client doesn’t send it we store null
      region: region || null,
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
    const { title, notes, tripStart, tripEnd, location, backgroundColor } =
      req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required." });
    }

    // build an update object only with provided fields
    const update = { title };
    if (notes !== undefined) update.notes = notes;
    if (tripStart !== undefined) update.tripStart = tripStart;
    if (tripEnd !== undefined) update.tripEnd = tripEnd;
    if (location !== undefined) update.location = location;
    if (backgroundColor !== undefined) update.backgroundColor = backgroundColor;

    const updated = await GearList.findOneAndUpdate(
      { _id: req.params.listId, owner: req.userId },
      update,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "List not found." });
    }
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
      title: "Sample Dolomites Packing List",
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
      }))
    );

    // 3) Seed the hero items that can later become affiliate-backed
    const itemSpecs = [
      {
        categoryTitle: "Hiking",
        brand: "Osprey",
        itemType: "Backpack - 24 L",
        name: "Stratos 24",
        description: "Osprey Stratos 24",
        weight: 1262,
        link: "https://amzn.to/43712Qe",
        worn: false,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Clothing",
        brand: "Darn Tough",
        itemType: "Socks - Hiker",
        name: "Hiker Micro Crew Midweight Cushion",
        description: "Darn Tough Hiker Micro Crew Midweight Cushion",
        weight: 68,
        link: "https://amzn.to/3RQg9bM",
        worn: true,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Hiking",
        brand: "Black Diamond",
        itemType: "Trekking Poles",
        name: "Black Diamond Alpine Carbon Cork Poles",
        description: "Lightweight trekking poles with cork grips.",
        weight: 624,
        link: "https://www.awin1.com/cread.php?awinmid=26895&p=https%3A%2F%2Fexample.…",
        worn: false,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Electronics",
        brand: "Anker",
        itemType: "Battery Bank",
        name: "Portable Charger 20,000mAh USB-C",
        description: "Anker Portable Charger 20,000mAh USB-C",
        weight: 357,
        link: "https://amzn.to/4kgaZSF",
        worn: false,
        consumable: false,
        quantity: 1,
      },
      {
        categoryTitle: "Rifugios",
        brand: "Sea to Summit",
        itemType: "Sleeping Bag Liner",
        name: "Comfort Blend Sleeping Bag Liner",
        description: "Sea to Summit Comfort Blend Sleeping Bag Liner",
        weight: 156,
        link: "https://amzn.to/3XxIiHo",
        worn: false,
        consumable: false,
        quantity: 1,
      },
    ];

    // Map category title → doc for easy lookup
    const categoryByTitle = new Map(
      categoryDocs.map((cat) => [cat.title, cat])
    );

    // Create matching GlobalItem docs (these live under "My Gear")
    const globalItems = await GlobalItem.insertMany(
      itemSpecs.map((spec) => ({
        owner: userId,
        category: spec.categoryTitle,
        brand: spec.brand,
        itemType: spec.itemType,
        name: spec.name,
        description: spec.description,
        weight: spec.weight,
        link: spec.link,
        worn: spec.worn,
        consumable: spec.consumable,
        quantity: spec.quantity,
        // weightSource, affiliate fields, etc. can be added later
      }))
    );

    // And the list-specific GearItem docs
    const positionsByCategory = new Map();
    const gearItemsPayload = itemSpecs.map((spec, index) => {
      const catDoc = categoryByTitle.get(spec.categoryTitle);
      if (!catDoc) {
        throw new Error(
          `Missing category document for title: ${spec.categoryTitle}`
        );
      }

      const catId = catDoc._id.toString();
      const currentPos = positionsByCategory.get(catId) ?? 0;
      positionsByCategory.set(catId, currentPos + 1);

      const global = globalItems[index];

      return {
        globalItem: global._id,
        gearList: sample._id,
        category: catDoc._id,
        brand: spec.brand,
        itemType: spec.itemType,
        name: spec.name,
        description: spec.description,
        weight: spec.weight,
        link: spec.link,
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
