const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");

const GlobalItem = require("../src/models/globalItem");
const CatalogItem = require("../src/models/catalogItem");

function getArgValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}
function normStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function lc(v) {
  return normStr(v).toLowerCase();
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGO_URI/MONGODB_URI in env.");

  const dbName = process.env.MONGO_DB_NAME; // you said treklist_local
  const dryRun = !hasFlag("--commit");

  const owner = getArgValue("--owner=");
  const limit = Number(getArgValue("--limit=") || 0) || 0;

  // Default behavior: skip GlobalItems that are already linked to a CatalogItem (productId exists)
  const includeLinked = hasFlag("--include-linked");

  // You gave this admin id for LIVE/DEV
  const createdByRaw =
    getArgValue("--createdBy=") || "6947eb98b098a3a6c93da9e5";

  const createdBy = new mongoose.Types.ObjectId(createdByRaw);

  await mongoose.connect(uri, {
    dbName,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("✅ Connected");
  console.log("DB name:", mongoose.connection.name);

  // 1) Build an in-memory set of existing catalog keys so this is idempotent
  // Key = brandLC|nameLC|itemTypeLC
  const existing = await CatalogItem.find(
    {},
    { name: 1, brandLC: 1, itemType: 1 }
  ).lean();

  const existingKeys = new Set(
    existing.map((d) => `${lc(d.brandLC)}|${lc(d.name)}|${lc(d.itemType)}`)
  );

  // 2) Query GlobalItems to import
  const q = {};
  if (owner) q.owner = new mongoose.Types.ObjectId(owner);

  if (!includeLinked) {
    q.$or = [{ productId: { $exists: false } }, { productId: null }];
  }

  let cursor = GlobalItem.find(q).sort({ updatedAt: -1 });
  if (limit > 0) cursor = cursor.limit(limit);

  const globals = await cursor.lean();

  let scanned = 0;
  let skippedMissingName = 0;
  let skippedDupeKey = 0;

  const toInsert = [];

  for (const g of globals) {
    scanned += 1;

    const name = normStr(g.name);
    if (!name) {
      skippedMissingName += 1;
      continue;
    }

    const brand = normStr(g.brand) || undefined;
    const brandLC = brand ? lc(brand) : undefined;

    const itemType = normStr(g.itemType) || undefined;

    // Your temporary rule: CatalogItem.category is string, use itemType for now
    const category = itemType || "uncategorized";

    // weight -> weightGrams (assume your global weight is already grams)
    const w = g.weight;
    const weightGrams =
      w === undefined || w === null || w === ""
        ? undefined
        : Number.isFinite(Number(w))
        ? Math.round(Number(w))
        : undefined;

    const key = `${lc(brandLC)}|${lc(name)}|${lc(itemType)}`;

    // Skip if already exists (idempotent, and protects against later manual adds)
    if (existingKeys.has(key)) {
      skippedDupeKey += 1;
      continue;
    }

    const doc = {
      name,
      brand,
      brandLC,
      itemType,
      category,
      weightGrams,
      createdBy,
      isActive: false,
    };

    toInsert.push(doc);
    existingKeys.add(key); // also prevents dupes inside this run
  }

  console.log("\n---- Preview ----");
  console.log("dryRun:", dryRun);
  console.log("includeLinked:", includeLinked);
  console.log("owner filter:", owner || "(none)");
  console.log("limit:", limit || "(none)");
  console.log("scanned globalitems:", scanned);
  console.log("to create catalogitems:", toInsert.length);
  console.log("skipped missing name:", skippedMissingName);
  console.log("skipped existing key:", skippedDupeKey);

  console.log("\nSample (up to 5) docs to insert:");
  console.log(
    toInsert.slice(0, 5).map((d) => ({
      name: d.name,
      brand: d.brand,
      category: d.category,
      itemType: d.itemType,
      weightGrams: d.weightGrams,
      createdBy: String(d.createdBy),
      isActive: d.isActive,
    }))
  );

  if (dryRun) {
    console.log("\n✅ Dry-run complete. No writes performed.");
    await mongoose.disconnect();
    return;
  }

  if (!toInsert.length) {
    console.log("\nNothing to insert.");
    await mongoose.disconnect();
    return;
  }

  // Create minimal CatalogItems
  const created = await CatalogItem.insertMany(toInsert, { ordered: false });

  console.log(`\n✅ Inserted CatalogItems: ${created.length}`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error("❌ Script failed:", e);
  process.exit(1);
});
