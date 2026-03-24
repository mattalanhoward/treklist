const express = require("express");
const auth = require("../middleware/auth");
const GearList = require("../models/gearList");
const Category = require("../models/category");
const GearItem = require("../models/gearItem");

const router = express.Router({ mergeParams: true });
router.use(auth);

// GET /api/dashboard/:listId/categories
router.get("/", async (req, res) => {
  try {
    const { listId } = req.params;

    // Ensure the list belongs to this user
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "Gear list not found." });

    const cats = await Category.find({ gearList: listId }).sort("position");
    res.json(cats);
  } catch (err) {
    console.error("Error GET categories:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/dashboard/:listId/categories
router.post("/", async (req, res) => {
  try {
    const { listId } = req.params;
    const { title, position } = req.body;

    if (!title || position == null) {
      return res
        .status(400)
        .json({ message: "Title and position are required." });
    }

    // Verify ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "Gear list not found." });

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    const newCat = new Category({ gearList: listId, title, position });
    await newCat.save();
    res.status(201).json(newCat);
  } catch (err) {
    console.error("Error POST category:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/dashboard/:listId/categories/:catId
// Allows updating title (and optionally position) in one go
router.patch("/:catId", async (req, res) => {
  try {
    const { listId, catId } = req.params;
    const { title, position } = req.body;
    if (title == null && position == null) {
      return res.status(400).json({ message: "Nothing to update." });
    }

    // Verify ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "Gear list not found." });

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    // Build update object
    const update = {};
    if (title != null) update.title = title;
    if (position != null) update.position = position;

    const updated = await Category.findOneAndUpdate(
      { _id: catId, gearList: listId },
      update,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Category not found." });
    }
    res.json(updated);
  } catch (err) {
    console.error("Error PATCH /categories/:catId:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/dashboard/:listId/categories/:catId/position
router.patch("/:catId/position", async (req, res) => {
  try {
    const { listId, catId } = req.params;
    const { position } = req.body;

    if (position == null) {
      return res.status(400).json({ message: "Position is required." });
    }

    // Verify ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "Gear list not found." });

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    const updated = await Category.findOneAndUpdate(
      { _id: catId, gearList: listId },
      { position },
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: "Category not found." });

    res.json(updated);
  } catch (err) {
    console.error("Error PATCH category position:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/dashboard/:listId/categories/:catId
router.delete("/:catId", async (req, res) => {
  try {
    const { listId, catId } = req.params;

    // Verify ownership
    const list = await GearList.findOne({ _id: listId, owner: req.userId });
    if (!list) return res.status(404).json({ message: "Gear list not found." });

    if (list.isLocked) {
      return res.status(403).json({ message: "List is locked" });
    }

    const deleted = await Category.findOneAndDelete({
      _id: catId,
      gearList: listId,
    });
    if (!deleted)
      return res.status(404).json({ message: "Category not found." });

    await GearItem.deleteMany({ gearList: listId, category: catId });

    res.json({ message: "Category deleted." });
  } catch (err) {
    console.error("Error DELETE category:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
