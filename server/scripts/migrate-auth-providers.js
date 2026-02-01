// Migration script to add authProviders field to existing users
// Run with: node scripts/migrate-auth-providers.js

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user");

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME || "TrekListDB",
    });

    console.log("Connected to MongoDB");

    // Find all users without authProviders field
    const users = await User.find({
      $or: [
        { authProviders: { $exists: false } },
        { authProviders: { $size: 0 } },
      ],
    });

    console.log(`Found ${users.length} users to migrate`);

    let migratedCount = 0;

    for (const user of users) {
      // All existing users have email/password authentication
      user.authProviders = [
        {
          provider: "email",
          providerId: null,
          connectedAt: user.createdAt || new Date(),
        },
      ];

      await user.save();
      migratedCount++;

      if (migratedCount % 10 === 0) {
        console.log(`Migrated ${migratedCount}/${users.length} users...`);
      }
    }

    console.log(`✓ Successfully migrated ${migratedCount} users`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
