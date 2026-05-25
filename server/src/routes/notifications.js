const express = require("express");
const router = express.Router();
const Notification = require("../models/notification");
const authMiddleware = require("../middleware/auth");

// GET /api/notifications — fetch recent notifications for current user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("fromUserId", "trailname")
      .populate("postId", "title communityId")
      .lean();

    const unreadCount = await Notification.countDocuments({ recipientId: req.userId, isRead: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put("/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ recipientId: req.userId, isRead: false }, { $set: { isRead: true } });
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/notifications/:id/read — mark one as read
router.put("/:id/read", authMiddleware, async (req, res) => {
  try {
    await Notification.updateOne({ _id: req.params.id, recipientId: req.userId }, { $set: { isRead: true } });
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
