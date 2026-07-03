/**
 * type-big-agnes.js
 *
 * Big Agnes model names ("Copper Spur UL2", "Anthracite 20°") don't contain the
 * category word, and the feed product_type ("TENTS"/"BAGS") doesn't match the
 * name-based inferItemType classifier — so most items imported untyped. This is a
 * brand-specific, AUTHORITATIVE typing pass keyed on the known BA product lines.
 * It sets itemType + derives category/subcategory from the locked taxonomy, using
 * collection.updateOne (NOT .save() — the pre-save hook re-normalizes and would
 * wipe fields on a projected doc; see gotcha_select_save_wipes_fields).
 *
 * DRY-RUN by default; pass --commit to write. Local DB only unless --db/--confirm.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const DB = flag("--db", null) || process.env.MONGO_DB_NAME || "treklist_local";
if (COMMIT && DB !== "treklist_local" && flag("--confirm", null) !== DB) {
  console.error(`Refusing to --commit to non-local DB "${DB}". Add --confirm ${DB}.`);
  process.exit(1);
}

// Ordered rules; first match wins. Comprehensive over ALL Big Agnes items so the
// pass is idempotent and also CORRECTS earlier mis-types (e.g. "Rapide SL
// Insulated Tent Floor Pad" was caught as a tent by the bare \btent\b rule).
function typeFor(name) {
  const n = String(name);
  if (/footprint|ground ?sheet/i.test(n)) return "Ground Sheet";
  if (/chair/i.test(n)) return "Other"; // no furniture itemType; matches existing chairs
  if (/\bpillow\b/i.test(n)) return "Pillow";
  if (/liner/i.test(n)) return "Sleeping Bag Liner";
  if (/\bquilt\b/i.test(n)) return "Quilt";
  if (/biofoam|foam/i.test(n)) return "Foam Sleeping Pad";
  if (/rapide|zoom|divide|circle back|campmeister deluxe insulated|floor pad|\bpad\b/i.test(n))
    return "Inflatable Sleeping Pad";
  if (/sweetwater|causeway/i.test(n)) return "Backpack";
  if (/anthracite|greystone|torchlight|sidewinder|lost ranger|rabbit ears|king solomon|fly creek ul 25/i.test(n))
    return "Sleeping Bag";
  return "Backpacking Tent"; // remaining BA items are tents/bivies
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const CatalogItem = require("../models/catalogItem");
  const col = CatalogItem.collection;
  const items = await CatalogItem.find({ brandLC: "big agnes", itemGroupId: /^bigagnes-/ })
    .select("name itemType category subcategory").lean();

  const changes = [];
  for (const it of items) {
    const itemType = typeFor(it.name);
    const { category = null, subcategory = null } = categoryForItemType(itemType, it.name);
    if (it.itemType === itemType && it.category === category && it.subcategory === subcategory) continue;
    changes.push({ _id: it._id, name: it.name, from: it.itemType || "—", itemType, category, subcategory });
  }

  const byType = {};
  changes.forEach((c) => (byType[c.itemType] = (byType[c.itemType] || 0) + 1));
  console.log(`\nBig Agnes items: ${items.length} | changes: ${changes.length}`);
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(3)}  → ${t}`));
  console.log("\nSample corrections (re-typed):");
  changes.filter((c) => c.from !== "—").slice(0, 10).forEach((c) => console.log(`  "${c.name}": ${c.from} → ${c.itemType}`));

  if (COMMIT) {
    for (const c of changes) {
      await col.updateOne(
        { _id: c._id },
        { $set: { itemType: c.itemType, category: c.category, subcategory: c.subcategory } },
      );
    }
    console.log(`\n✓ Updated ${changes.length} items in ${DB}.`);
  } else {
    console.log("\n(dry-run — pass --commit to write)");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
