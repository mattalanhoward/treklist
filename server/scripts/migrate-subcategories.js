// Normalise legacy subcategory values to the canonical names defined in
// client/src/config/catalogTaxonomy.js CATALOG_SUBCATEGORIES.
//
// Run with: node scripts/migrate-subcategories.js
// Dry-run (no writes): node scripts/migrate-subcategories.js --dry-run

require("dotenv").config();
const mongoose = require("mongoose");

const RENAMES = [
  { from: "Tent",         to: "Tents" },
  { from: "Ground Sheets", to: "Ground Sheet" },
  { from: "Power Banks",  to: "Charging & Power Banks" },
];

async function migrate(dryRun) {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || "TrekList",
  });
  console.log(`Connected. Dry-run: ${dryRun}`);

  const CatalogItem = mongoose.model(
    "CatalogItem",
    new mongoose.Schema({}, { strict: false }),
    "catalogitems"
  );

  for (const { from, to } of RENAMES) {
    const matches = await CatalogItem.find({ subcategory: from });
    console.log(`"${from}" → "${to}": ${matches.length} item(s)`);
    if (!dryRun && matches.length > 0) {
      const result = await CatalogItem.updateMany(
        { subcategory: from },
        { $set: { subcategory: to } }
      );
      console.log(`  Updated ${result.modifiedCount} document(s).`);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

const dryRun = process.argv.includes("--dry-run");
migrate(dryRun).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
