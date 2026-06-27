// server/src/scripts/normalize-itemtypes.js
// =============================================================================
// Normalize out-of-schema itemType strings -> schema enum values, IN PLACE.
// Preserves _ids. Only sets `itemType` (never touches attributes), so existing
// curated attributes are untouched and the update hook won't re-validate them.
//
// DRY-RUN by default (writes NOTHING). Pass --commit to write.
//   cd server
//   node src/scripts/normalize-itemtypes.js            # preview
//   node src/scripts/normalize-itemtypes.js --commit   # apply
//
// For each mapped doc it also reports whether the EXISTING attributes would
// validate against the NEW itemType (so you can see what still needs curation).
// Docs in the REVIEW list (currency / documents / generic "Water") are NOT
// touched — they look like non-product pollution and need a separate decision.
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const {
  isValidItemType,
  validateAttributes,
} = require("../config/attributeSchemas");

const COMMIT = process.argv.includes("--commit");

// -----------------------------------------------------------------------------
// DB TARGET + PRODUCTION GUARD
// -----------------------------------------------------------------------------
// Target DB: --db <name> overrides MONGO_DB_NAME (default = local).
// Writing (--commit) to any non-local DB requires `--confirm <dbName>` to match,
// so a prod write (TrekList) can never happen by a stray MONGO_DB_NAME.
function argVal(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const DB = argVal("--db") || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && argVal("--confirm") !== DB) {
  console.error(
    `\nRefusing to --commit to non-local DB "${DB}".\n` +
      `Re-run with:  --db ${DB} --commit --confirm ${DB}\n`,
  );
  process.exit(1);
}

// -----------------------------------------------------------------------------
// EXPLICIT MAP: legacy/descriptive itemType  ->  schema enum value
// -----------------------------------------------------------------------------
const ITEMTYPE_MAP = {
  // ---- Sleep ----
  "Ultralight Down Quilt": "Quilt",
  "Sleeping Bag (Down)": "Sleeping Bag",
  // ---- Cooking ----
  "Backpacking Pot (Titanium)": "Backpacking Pot",
  "Spoon (Long Handle, Titanium)": "Utensil",
  // ---- Power / charging ----
  "Portable Power Bank": "Power Bank",
  "Wall Charger": "Travel Charger",
  "Travel Adapter": "Travel Charger",
  // ---- Clothing ----
  "Hiking socks": "Hiking Socks",
  "LS Top": "Base Layer Top",
  "T-Shirt": "Base Layer Top", // Smartwool Merino 120 SS = base layer
  "Long Underwear": "Base Layer Bottom",
  "Down Jacket": "Insulated Jacket",
  "Down Jacket - Hoody": "Insulated Jacket",
  "Boxer Briefs": "Underwear",
  'Running Shorts 5"': "Hiking Shorts",
  'Running Shorts 7"': "Hiking Shorts",
  "Gloves-Fingerless": "Gloves (Insulated)",
  Bandana: "Hat/Headwear",
  "Pack Towel": "Travel Towel",
  // ---- Toiletries ----
  Deodorant: "Toiletry",
  "Lip Balm": "Toiletry",
  "Toothpaste (travel)": "Toiletry",
  Toothbrush: "Toiletry",
  "Wet Wipes": "Toiletry",
  "Toilet Paper": "Toiletry",
  "Hand Sanitizer": "Toiletry",
  Sunscreen: "Toiletry",
  "Liquid Soap (travel)": "Toiletry",
  // ---- Medication ----
  "Anti-Diarrheal": "Medication",
  "Pain Reliever": "Medication",
  // ---- Electronics (dedicated schema types added 2026-06-27) ----
  // NB: "Earbuds"/"Smartphone"/"Smartwatch" itemTypes are now valid schema
  // types themselves, so those docs need no remap (skipped as already-valid).
  "USB-C to USB-C Cable (1FT)": "Charging Cable",
  "USB-C to Lightning (1FT)": "Charging Cable",
  // ---- Dry bags (dedicated schema type added 2026-06-27) ----
  "Dry Bag (3L)": "Dry Bag / Stuff Sack",
  "Dry Bag (5L)": "Dry Bag / Stuff Sack",
  "Dry Bag (8L)": "Dry Bag / Stuff Sack",
  "Dry Bag (13L)": "Dry Bag / Stuff Sack",
  "Dry Bag (20L)": "Dry Bag / Stuff Sack",
  // ---- Personal items (kept; mapped to existing generic types) ----
  Passport: "Document",
  "Credit Card": "Wallet",
  "Debit Card": "Wallet",
  Cash: "Wallet",
  "US Dollar": "Wallet",
  Pounds: "Wallet",
  "Canadian Dollar": "Wallet",
  Various: "Wallet", // brand "Various" / name "Cash"
  Water: "Other",
  // ---- Misc gear with no dedicated schema -> Other ----
  Trowel: "Other",
  "Pillow Case": "Other",
  "Smartphone Tripod + Phone Mount": "Other",
  "Electric Air Pump": "Other",
  "Storage Bags (Zip)": "Other",
  "Earplugs (silicone)": "Other",
  "AAA Alkaline Batteries": "Other",
  Lighter: "Other",
};

// Nothing held back any more — every out-of-schema itemType is mapped.
const REVIEW = new Set([]);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");

  console.log("=".repeat(72));
  console.log(
    `itemType NORMALIZATION  (${COMMIT ? "COMMIT — WILL WRITE" : "DRY RUN — no writes"})`,
  );
  console.log(`DB: ${mongoose.connection.name}`);
  console.log("=".repeat(72));

  // Sanity: every map target must be a real schema type.
  const badTargets = [...new Set(Object.values(ITEMTYPE_MAP))].filter(
    (t) => !isValidItemType(t),
  );
  if (badTargets.length) {
    console.error("Map targets not in schema:", badTargets);
    process.exit(1);
  }

  const items = await C.find({}).lean();
  const toMap = [];
  const reviewDocs = [];
  const unhandled = [];

  for (const it of items) {
    const t = it.itemType;
    if (t == null || isValidItemType(t)) continue;
    if (ITEMTYPE_MAP[t]) toMap.push(it);
    else if (REVIEW.has(t)) reviewDocs.push(it);
    else unhandled.push(it);
  }

  // ---- Preview mapped changes, grouped by old->new, with post-map validation
  const groups = new Map();
  for (const it of toMap) {
    const key = `${it.itemType} -> ${ITEMTYPE_MAP[it.itemType]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  console.log(`\nMAPPED (${toMap.length} docs):`);
  let willValidate = 0,
    willStillFail = 0;
  for (const [key, docs] of [...groups.entries()].sort()) {
    const newType = ITEMTYPE_MAP[docs[0].itemType];
    console.log(`\n  ${key}   [${docs.length}]`);
    for (const d of docs) {
      const a =
        d.attributes instanceof Map
          ? Object.fromEntries(d.attributes)
          : d.attributes || {};
      const { valid, errors } = validateAttributes(newType, a);
      if (valid) willValidate++;
      else willStillFail++;
      const status = valid
        ? "OK"
        : `needs: ${errors.slice(0, 3).join("; ")}`;
      console.log(`      ${d.name.padEnd(48)} attrs:${Object.keys(a).length}  ${status}`);
    }
  }

  console.log(
    `\n  After mapping: ${willValidate} validate clean, ${willStillFail} still need attribute curation.`,
  );

  // ---- Review / unhandled
  console.log(`\nREVIEW — NOT touched (likely non-product) (${reviewDocs.length} docs):`);
  for (const d of reviewDocs) {
    console.log(
      `  ${d._id}  ${(d.brand || "—").padEnd(10)} ${JSON.stringify(d.itemType)}  ${d.name}`,
    );
  }
  if (unhandled.length) {
    console.log(`\nUNHANDLED (no map, not in REVIEW) (${unhandled.length}):`);
    for (const d of unhandled)
      console.log(`  ${JSON.stringify(d.itemType)}  ${d.name}`);
  }

  // ---- Commit
  if (COMMIT) {
    console.log(`\nWriting ${toMap.length} updates...`);
    let n = 0;
    for (const it of toMap) {
      await C.updateOne(
        { _id: it._id },
        { $set: { itemType: ITEMTYPE_MAP[it.itemType] } },
      );
      n++;
    }
    console.log(`Updated ${n} docs.`);
  } else {
    console.log(`\n(DRY RUN — nothing written. Re-run with --commit to apply.)`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
