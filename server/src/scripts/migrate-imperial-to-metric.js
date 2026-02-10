// server/src/scripts/migrate-imperial-to-metric.js
// =============================================================================
// MIGRATION: Convert imperial-primary attributes to metric-primary
// =============================================================================
//
// WHAT THIS DOES:
//   1. Backs up current attributes to a JSON file
//   2. Converts imperial field values to metric equivalents
//   3. Renames keys (e.g., tempRatingF → tempRatingC) and stores derived imperial
//   4. Handles both CatalogItem (Mixed) and GlobalItem (Map<String,String>)
//
// RUN:
//   cd server
//   node src/scripts/migrate-imperial-to-metric.js
//
// OPTIONS:
//   --dry-run     Preview changes without writing to database
//   --backup-only Just create backup, don't migrate anything
//
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BACKUP_ONLY = args.includes("--backup-only");

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------
const GRAMS_PER_OUNCE = 28.3495;

const conversions = {
  // °F → °C (primary), keep °F as derived
  tempRatingF: {
    metricKey: "tempRatingC",
    imperialKey: "tempRatingF",
    toMetric: (f) => Math.round((f - 32) * (5 / 9)),
    toImperial: (c) => Math.round(c * (9 / 5) + 32),
  },
  tempBoostF: {
    metricKey: "tempBoostC",
    imperialKey: "tempBoostF",
    // Boost is a delta, not absolute — no +32
    toMetric: (f) => Math.round(f * (5 / 9)),
    toImperial: (c) => Math.round(c * (9 / 5)),
  },
  // oz → g
  fillWeightOz: {
    metricKey: "fillWeightG",
    imperialKey: "fillWeightOz",
    toMetric: (oz) => Math.round(oz * GRAMS_PER_OUNCE),
    toImperial: (g) => Math.round((g / GRAMS_PER_OUNCE) * 10) / 10,
  },
  // in → cm
  thicknessIn: {
    metricKey: "thicknessCm",
    imperialKey: "thicknessIn",
    toMetric: (inches) => Math.round(inches * 2.54 * 10) / 10,
    toImperial: (cm) => Math.round((cm / 2.54) * 10) / 10,
  },
  inseamIn: {
    metricKey: "inseamCm",
    imperialKey: "inseamIn",
    toMetric: (inches) => Math.round(inches * 2.54 * 10) / 10,
    toImperial: (cm) => Math.round((cm / 2.54) * 10) / 10,
  },
  // sq ft → sq m  (keys that were previously just "floorArea", "vestibuleArea", "coverageArea")
  floorArea: {
    metricKey: "floorAreaSqM",
    imperialKey: "floorAreaSqFt",
    toMetric: (sqft) => Math.round(sqft * 0.0929 * 100) / 100,
    toImperial: (sqm) => Math.round((sqm / 0.0929) * 10) / 10,
  },
  vestibuleArea: {
    metricKey: "vestibuleAreaSqM",
    imperialKey: "vestibuleAreaSqFt",
    toMetric: (sqft) => Math.round(sqft * 0.0929 * 100) / 100,
    toImperial: (sqm) => Math.round((sqm / 0.0929) * 10) / 10,
  },
  coverageArea: {
    metricKey: "coverageAreaSqM",
    imperialKey: "coverageAreaSqFt",
    toMetric: (sqft) => Math.round(sqft * 0.0929 * 100) / 100,
    toImperial: (sqm) => Math.round((sqm / 0.0929) * 10) / 10,
  },
  // peakHeightIn was already renamed to peakHeightCm in an earlier change,
  // but handle in case any old data still has it
  peakHeightIn: {
    metricKey: "peakHeightCm",
    imperialKey: null, // no imperial derived field for this one
    toMetric: (inches) => Math.round(inches * 2.54),
    toImperial: null,
  },
};

/**
 * Migrate a plain attributes object (CatalogItem style).
 * Returns { migrated, changed } where changed is true if any keys were converted.
 */
function migrateAttributes(attrs) {
  if (!attrs || typeof attrs !== "object") return { migrated: attrs, changed: false };

  const migrated = { ...attrs };
  let changed = false;

  for (const [oldKey, conv] of Object.entries(conversions)) {
    if (migrated[oldKey] != null) {
      // Skip if the metric field already exists (item was already entered in metric)
      if (migrated[conv.metricKey] != null && oldKey !== conv.metricKey) {
        continue;
      }
      const val = Number(migrated[oldKey]);
      if (Number.isFinite(val)) {
        // Set metric primary
        migrated[conv.metricKey] = conv.toMetric(val);
        // Set imperial derived (if applicable)
        if (conv.imperialKey && conv.toImperial) {
          migrated[conv.imperialKey] = conv.toImperial(migrated[conv.metricKey]);
        }
        // Remove old key if it differs from both new keys
        if (oldKey !== conv.metricKey && oldKey !== conv.imperialKey) {
          delete migrated[oldKey];
        }
        changed = true;
      }
    }
  }

  return { migrated, changed };
}

/**
 * Migrate a Map-style attributes object (GlobalItem style).
 * Values are strings — parse, convert, stringify.
 */
function migrateMapAttributes(attrsMap) {
  if (!attrsMap || typeof attrsMap !== "object") return { migrated: attrsMap, changed: false };

  // Convert Map to plain object
  const plain =
    attrsMap instanceof Map ? Object.fromEntries(attrsMap) : { ...attrsMap };

  const migrated = { ...plain };
  let changed = false;

  for (const [oldKey, conv] of Object.entries(conversions)) {
    if (migrated[oldKey] != null) {
      // Skip if the metric field already exists (item was already entered in metric)
      if (migrated[conv.metricKey] != null && oldKey !== conv.metricKey) {
        continue;
      }
      const val = Number(migrated[oldKey]);
      if (Number.isFinite(val)) {
        migrated[conv.metricKey] = String(conv.toMetric(val));
        if (conv.imperialKey && conv.toImperial) {
          migrated[conv.imperialKey] = String(
            conv.toImperial(Number(migrated[conv.metricKey])),
          );
        }
        if (oldKey !== conv.metricKey && oldKey !== conv.imperialKey) {
          delete migrated[oldKey];
        }
        changed = true;
      }
    }
  }

  return { migrated, changed };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("TREKLIST MIGRATION - Imperial to Metric Primary");
  console.log("=".repeat(70));
  console.log();

  if (DRY_RUN) {
    console.log("DRY RUN MODE - No changes will be written to database");
    console.log();
  }
  if (BACKUP_ONLY) {
    console.log("BACKUP ONLY MODE - Will create backup but not migrate");
    console.log();
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not set in environment");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB_NAME });
  console.log(`Connected to database: ${mongoose.connection.name}`);
  console.log();

  const CatalogItem = require("../models/catalogItem");
  const GlobalItem = require("../models/globalItem");

  // =========================================================================
  // STEP 1: Backup
  // =========================================================================
  console.log("STEP 1: Creating backup...");

  const catalogItems = await CatalogItem.find({}).lean();
  const globalItems = await GlobalItem.find({}).lean();

  const backup = {
    timestamp: new Date().toISOString(),
    catalogItems: catalogItems.map((item) => ({
      _id: item._id.toString(),
      name: item.name,
      brand: item.brand,
      itemType: item.itemType,
      attributes:
        item.attributes instanceof Map
          ? Object.fromEntries(item.attributes)
          : item.attributes || {},
    })),
    globalItems: globalItems
      .filter((item) => {
        const attrs =
          item.attributes instanceof Map
            ? Object.fromEntries(item.attributes)
            : item.attributes || {};
        return Object.keys(attrs).length > 0;
      })
      .map((item) => ({
        _id: item._id.toString(),
        name: item.name,
        attributes:
          item.attributes instanceof Map
            ? Object.fromEntries(item.attributes)
            : item.attributes || {},
      })),
  };

  const backupDir = path.join(__dirname, "../../backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(
    backupDir,
    `imperial-to-metric-backup-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup saved to: ${backupPath}`);
  console.log(
    `  ${backup.catalogItems.length} catalog items, ${backup.globalItems.length} global items with attributes`,
  );
  console.log();

  if (BACKUP_ONLY) {
    console.log("Backup complete. Exiting (--backup-only mode).");
    await mongoose.disconnect();
    return;
  }

  // =========================================================================
  // STEP 2: Migrate CatalogItems
  // =========================================================================
  console.log("STEP 2: Migrating CatalogItem attributes...");

  let catalogChanged = 0;
  let catalogSkipped = 0;

  for (const item of catalogItems) {
    const attrs =
      item.attributes instanceof Map
        ? Object.fromEntries(item.attributes)
        : item.attributes || {};

    if (Object.keys(attrs).length === 0) {
      catalogSkipped++;
      continue;
    }

    const { migrated, changed } = migrateAttributes(attrs);

    if (changed) {
      if (DRY_RUN) {
        console.log(
          `  [DRY RUN] Would migrate: ${item.name} (${item.itemType})`,
        );
        console.log(`    Before: ${JSON.stringify(attrs)}`);
        console.log(`    After:  ${JSON.stringify(migrated)}`);
      } else {
        await CatalogItem.updateOne(
          { _id: item._id },
          { $set: { attributes: migrated } },
        );
      }
      catalogChanged++;
    } else {
      catalogSkipped++;
    }
  }

  console.log(
    `  Catalog: ${catalogChanged} migrated, ${catalogSkipped} skipped (no imperial fields)`,
  );
  console.log();

  // =========================================================================
  // STEP 3: Migrate GlobalItems
  // =========================================================================
  console.log("STEP 3: Migrating GlobalItem attributes...");

  let globalChanged = 0;
  let globalSkipped = 0;

  for (const item of globalItems) {
    const attrs =
      item.attributes instanceof Map
        ? Object.fromEntries(item.attributes)
        : item.attributes || {};

    if (Object.keys(attrs).length === 0) {
      globalSkipped++;
      continue;
    }

    const { migrated, changed } = migrateMapAttributes(attrs);

    if (changed) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would migrate: ${item.name}`);
        console.log(`    Before: ${JSON.stringify(attrs)}`);
        console.log(`    After:  ${JSON.stringify(migrated)}`);
      } else {
        // GlobalItem uses Map<String, String> — set each key
        const update = {};
        // Clear old keys, set new ones
        for (const key of Object.keys(attrs)) {
          if (!(key in migrated)) {
            update[`attributes.${key}`] = undefined;
          }
        }
        // Use $set and $unset
        const $set = {};
        const $unset = {};
        for (const [k, v] of Object.entries(migrated)) {
          $set[`attributes.${k}`] = v;
        }
        for (const key of Object.keys(attrs)) {
          if (!(key in migrated)) {
            $unset[`attributes.${key}`] = "";
          }
        }
        const updateOp = {};
        if (Object.keys($set).length) updateOp.$set = $set;
        if (Object.keys($unset).length) updateOp.$unset = $unset;
        if (Object.keys(updateOp).length) {
          await GlobalItem.updateOne({ _id: item._id }, updateOp);
        }
      }
      globalChanged++;
    } else {
      globalSkipped++;
    }
  }

  console.log(
    `  Global: ${globalChanged} migrated, ${globalSkipped} skipped (no imperial fields)`,
  );
  console.log();

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("=".repeat(70));
  console.log("MIGRATION COMPLETE");
  console.log("=".repeat(70));
  console.log();
  console.log(`Backup: ${backupPath}`);
  console.log(`Catalog items migrated: ${catalogChanged}`);
  console.log(`Global items migrated:  ${globalChanged}`);
  if (DRY_RUN) {
    console.log();
    console.log("This was a dry run. Re-run without --dry-run to apply changes.");
  }
  console.log();

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
