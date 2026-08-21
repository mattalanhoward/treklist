// server/scripts/ensure-indexes.js
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ No MONGO_URI defined in environment!");
    process.exit(1);
  }

  // Load models to register schemas & indexes
  const GlobalItem = require("../src/models/globalItem");
  const GearList = require("../src/models/gearList");
  const AffiliateProduct = require("../src/models/affiliateProduct");
  // TTL index here is what enforces the pane-log retention window.
  const UserEvent = require("../src/models/userEvent");

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME, // ← ensure we don't default to 'test'
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("Connected DB =", mongoose.connection.name);

  // Create common owner indexes (idempotent)
  await Promise.allSettled([
    GlobalItem.collection.createIndex({ owner: 1 }, { name: "owner_idx" }),
    GearList.collection.createIndex({ owner: 1 }, { name: "owner_idx" }),
  ]);

  // Sync model-defined indexes
  await Promise.allSettled([
    AffiliateProduct.syncIndexes(),
    GlobalItem.syncIndexes(),
    GearList.syncIndexes(),
    UserEvent.syncIndexes(),
  ]);

  console.log("✅ Indexes ensured.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ ensure-indexes error:", err);
  process.exit(1);
});
