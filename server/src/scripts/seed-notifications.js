// =============================================================================
// SEED: Dummy notifications for local dev/testing
//
// RUN:
//   cd server
//   node src/scripts/seed-notifications.js
//
// Clears existing notifications for the target user then inserts fresh ones.
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");

const Notification = require("../models/notification");
const User = require("../models/user");
const Post = require("../models/post");

const TARGET_EMAIL = "mattalanhoward@gmail.com";

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  console.log("Connected to MongoDB");

  const recipient = await User.findOne({ email: TARGET_EMAIL }).lean();
  if (!recipient) {
    console.error(`User not found: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  // Prefer a user with a trailname so notifications display properly
  const sender = await User.findOne({ _id: { $ne: recipient._id }, trailname: { $exists: true, $ne: "" } }).lean();
  if (!sender) {
    console.error("No other user found to act as sender — run seed-forum.js first");
    process.exit(1);
  }

  // Find any post to link to
  const post = await Post.findOne({ deletedAt: null }).lean();

  // Clear existing notifications for this user
  await Notification.deleteMany({ recipientId: recipient._id });
  console.log("Cleared existing notifications");

  const now = new Date();
  const mins = (n) => new Date(now - n * 60 * 1000);

  const docs = [
    {
      recipientId: recipient._id,
      fromUserId: sender._id,
      type: "upvote_post",
      postId: post?._id || null,
      isRead: false,
      createdAt: mins(2),
    },
    {
      recipientId: recipient._id,
      fromUserId: sender._id,
      type: "reply_post",
      postId: post?._id || null,
      isRead: false,
      createdAt: mins(15),
    },
    {
      recipientId: recipient._id,
      fromUserId: sender._id,
      type: "upvote_comment",
      postId: post?._id || null,
      isRead: false,
      createdAt: mins(42),
    },
    {
      recipientId: recipient._id,
      fromUserId: sender._id,
      type: "reply_comment",
      postId: post?._id || null,
      isRead: true,
      createdAt: mins(120),
    },
    {
      recipientId: recipient._id,
      fromUserId: sender._id,
      type: "upvote_post",
      postId: post?._id || null,
      isRead: true,
      createdAt: mins(1440),
    },
  ];

  await Notification.insertMany(docs);
  console.log(`Inserted ${docs.length} notifications for ${recipient.trailname || TARGET_EMAIL}`);
  console.log(`  Sender: ${sender.trailname || sender.email}`);
  console.log(`  Post: ${post?.title || "(no post found)"}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
