/**
 * qa-zpacks-variant-names.js — shorten verbose Zpacks pack sizing variant values
 * ("Short (17-20 inches)" → "S", "Extra Large (38-44 inches)" → "XL",
 *  "Padded Belt - Medium (30-38 inches)" → "Padded Belt M") to match the catalog's
 * S/M/L torso-size style (Osprey/Durston). Updates variantAxes values, variant
 * keys/options, defaultVariantKey AND GlobalItem.variantKey refs.
 * Dry-run default; --commit. Local-only.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const GlobalItem = require("../models/globalItem");
const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const SIZE_WORD = { "Extra Small": "XS", Small: "S", Medium: "M", Large: "L", "Extra Large": "XL", Short: "S", Tall: "L" };
function shorten(val) {
  let v = String(val).replace(/\s*\([^)]*\)/g, "").trim(); // drop "(24-30 inches)"
  if (SIZE_WORD[v]) return SIZE_WORD[v]; // bare size word
  // "Padded Belt - Medium" → "Padded Belt M"
  const m = v.match(/^(.*?)[\s-]+(Extra Small|Extra Large|Small|Medium|Large|Short|Tall)$/);
  if (m) return `${m[1].replace(/[\s-]+$/, "")} ${SIZE_WORD[m[2]]}`;
  return v;
}
const asObj = (o) => (o instanceof Map ? Object.fromEntries(o) : o || {});

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const packs = await CatalogItem.find({
    brandLC: "zpacks", isActive: { $ne: false },
    "variants.0": { $exists: true },
  }).lean();
  for (const p of packs) {
    if (!(p.variants || []).some((v) => /\(.*inches.*\)/i.test(v.key))) continue;
    const keyMap = {};
    const variants = p.variants.map((v) => {
      const opts = asObj(v.options);
      const newOpts = {};
      Object.entries(opts).forEach(([ax, val]) => (newOpts[ax] = shorten(val)));
      const newKey = Object.values(newOpts).join(" / ");
      keyMap[v.key] = newKey;
      return { ...v, key: newKey, options: newOpts };
    });
    const axes = (p.variantAxes || []).map((a) => ({ ...a, values: a.values.map(shorten) }));
    const def = keyMap[p.defaultVariantKey] || p.defaultVariantKey;
    console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ${p.name}`);
    console.log(`   ${p.variants[0].key} -> ${variants[0].key} (… ${variants.length} variants), default -> ${def}`);
    if (new Set(variants.map((v) => v.key)).size !== variants.length) { console.error("   KEY COLLISION — skipped"); continue; }
    if (COMMIT) {
      await CatalogItem.collection.updateOne({ _id: p._id }, { $set: { variants, variantAxes: axes, defaultVariantKey: def } });
      for (const [oldK, newK] of Object.entries(keyMap)) {
        if (oldK === newK) continue;
        const r = await GlobalItem.collection.updateMany({ productId: p._id, variantKey: oldK }, { $set: { variantKey: newK } });
        if (r.modifiedCount) console.log(`   ref variantKey "${oldK}" -> "${newK}" ×${r.modifiedCount}`);
      }
    }
  }
  await mongoose.disconnect();
})();
