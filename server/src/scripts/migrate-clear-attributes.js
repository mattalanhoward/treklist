// server/src/scripts/migrate-clear-attributes.js
// =============================================================================
// MIGRATION: Clear legacy free-form attributes for structured re-entry
// =============================================================================
//
// WHAT THIS DOES:
//   1. Backs up current attributes to a JSON file (for reference during re-entry)
//   2. Clears all attributes to {}
//   3. Preserves itemType (already populated)
//   4. Reports summary
//
// RUN:
//   cd server
//   node src/scripts/migrate-clear-attributes.js
//
// OPTIONS:
//   --dry-run     Preview changes without writing to database
//   --backup-only Just create backup, don't clear anything
//
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Parse command line args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BACKUP_ONLY = args.includes("--backup-only");

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("TREKLIST ATTRIBUTE MIGRATION - Clear for Structured Re-entry");
  console.log("=".repeat(70));
  console.log();

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be written to database");
    console.log();
  }

  if (BACKUP_ONLY) {
    console.log(
      "📦 BACKUP ONLY MODE - Will create backup but not clear attributes",
    );
    console.log();
  }

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not set in environment");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME,
  });
  console.log(`✅ Connected to database: ${mongoose.connection.name}`);
  console.log();

  // Get the CatalogItem model
  const CatalogItem = require("../models/catalogItem");

  // Fetch all catalog items
  console.log("Fetching all catalog items...");
  const items = await CatalogItem.find({}).lean();
  console.log(`Found ${items.length} catalog items`);
  console.log();

  // =============================================================================
  // STEP 1: Create backup
  // =============================================================================
  console.log("STEP 1: Creating backup of current attributes...");

  const backup = items.map((item) => ({
    _id: item._id.toString(),
    name: item.name,
    brand: item.brand,
    category: item.category,
    subcategory: item.subcategory,
    itemType: item.itemType,
    weightGrams: item.weightGrams,
    dimensions: item.dimensions,
    attributes:
      item.attributes instanceof Map
        ? Object.fromEntries(item.attributes)
        : item.attributes || {},
  }));

  const backupPath = path.join(
    __dirname,
    `../../backups/attributes-backup-${Date.now()}.json`,
  );

  // Ensure backups directory exists
  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup saved to: ${backupPath}`);
  console.log();

  if (BACKUP_ONLY) {
    console.log("Backup complete. Exiting (--backup-only mode).");
    await mongoose.disconnect();
    return;
  }

  // =============================================================================
  // STEP 2: Analyze current state
  // =============================================================================
  console.log("STEP 2: Analyzing current attributes...");

  const stats = {
    total: items.length,
    withAttributes: 0,
    withoutAttributes: 0,
    byCategory: {},
    byItemType: {},
  };

  for (const item of items) {
    const attrs =
      item.attributes instanceof Map
        ? Object.fromEntries(item.attributes)
        : item.attributes || {};
    const hasAttrs = Object.keys(attrs).length > 0;

    if (hasAttrs) {
      stats.withAttributes++;
    } else {
      stats.withoutAttributes++;
    }

    // Count by category
    const cat = item.category || "(none)";
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

    // Count by itemType
    const type = item.itemType || "(none)";
    stats.byItemType[type] = (stats.byItemType[type] || 0) + 1;
  }

  console.log(`  Total items: ${stats.total}`);
  console.log(`  With attributes: ${stats.withAttributes}`);
  console.log(`  Without attributes: ${stats.withoutAttributes}`);
  console.log();

  console.log("  Items by category:");
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count}`);
    });
  console.log();

  console.log("  Items by itemType (top 20):");
  Object.entries(stats.byItemType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });
  console.log();

  // =============================================================================
  // STEP 3: Clear attributes
  // =============================================================================
  console.log("STEP 3: Clearing attributes...");

  if (DRY_RUN) {
    console.log("  [DRY RUN] Would clear attributes on all items");
    console.log("  [DRY RUN] itemType values would be preserved");
  } else {
    // Use updateMany to clear all attributes
    const result = await CatalogItem.updateMany(
      {}, // match all
      { $set: { attributes: {} } },
    );

    console.log(`  ✅ Cleared attributes on ${result.modifiedCount} items`);
  }
  console.log();

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log("=".repeat(70));
  console.log("MIGRATION COMPLETE");
  console.log("=".repeat(70));
  console.log();
  console.log(`Backup saved to: ${backupPath}`);
  console.log();
  console.log("NEXT STEPS:");
  console.log("1. Open AdminView in your browser");
  console.log("2. For each catalog item, click Edit");
  console.log("3. Select the correct itemType (most should already be set)");
  console.log("4. Fill in the structured attribute fields");
  console.log("5. Use the backup JSON as reference for original values");
  console.log();
  console.log("TIP: Start with Sleep System items (53 items) - they have the");
  console.log(
    "     most detailed schemas and will benefit most from structure.",
  );
  console.log();

  await mongoose.disconnect();
  console.log("Done.");
}

// Run
main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
