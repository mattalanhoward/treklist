/**
 * deconsolidate-reuse.js — for brands whose consolidation MERGED per-value products
 * into a new parent (Volume/Capacity × fit) while leaving the original per-value
 * items archived-but-stale (they kept their name + offer but lost the fit variants):
 * HMG packs, Osprey. Reversal = un-archive each per-value sibling, restore its fit
 * variants (Torso/Size) FROM the parent matrix, add the primary attribute, and
 * archive the merged parent. See [[catalog-variant-standard]].
 *
 *   node src/scripts/deconsolidate-reuse.js --brand <brandLC> [--commit]
 * Local DB only.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const flag = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const COMMIT = process.argv.includes("--commit");
const BRAND = (flag("--brand", "") || "").toLowerCase();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const PRIMARY = new Set(["Volume", "Capacity", "Temperature", "Temp Rating", "R-Value", "Fill", "Fill Weight"]);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const num = (pv) => { const m = String(pv).match(/-?\d+(\.\d+)?/); return m ? m[0] : null; };
function pvAttrs(axis, pv) {
  if (/volume/i.test(axis)) { const v = num(pv); return v ? { volumeLiters: parseInt(v, 10) } : {}; }
  if (/capacit/i.test(axis)) return { capacity: String(pv).trim() };
  if (/temp/i.test(axis)) { const f = num(pv); if (f == null) return {}; const F = +f; return { tempRatingF: F, tempRatingC: Math.round((F - 32) * 5 / 9) }; }
  if (/r-?value/i.test(axis)) { const r = num(pv); return r ? { rValue: +r } : {}; }
  return {};
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const parents = await C.find({
    brandLC: BRAND, isActive: { $ne: false }, "variants.0": { $exists: true },
    "variantAxes.name": { $in: [...PRIMARY] },
  });
  console.log(`${BRAND}: merged parents ${parents.length}\n`);

  let reused = 0, missing = 0, archivedParents = 0;
  for (const P of parents) {
    const axes = P.variantAxes.map((a) => a.name);
    const primaryAxis = axes.find((a) => PRIMARY.has(a));
    const fitAxes = axes.filter((a) => a !== primaryAxis);
    const base = P.name;

    const groups = new Map();
    for (const v of P.variants) { const pv = v.options.get(primaryAxis); (groups.get(pv) || groups.set(pv, []).get(pv)).push(v); }
    console.log(`■ "${base}"  (${primaryAxis}${fitAxes.length ? " × " + fitAxes.join("×") : ""})  → ${groups.size} products`);

    let allMatched = true;
    for (const [pv, vs] of groups) {
      const n = num(pv);
      const sib = await C.findOne({ brandLC: BRAND, name: new RegExp(`^${esc(base)}\\s*${esc(n)}\\b`) });
      const fitVariants = fitAxes.length
        ? vs.map((v) => { const o = {}; fitAxes.forEach((a) => (o[a] = v.options.get(a)));
            return { key: fitAxes.map((a) => o[a]).join(" / "), options: o, weightGrams: v.weightGrams, sku: v.sku }; })
        : [];
      const keep = fitVariants.length > 1;
      if (!sib) { console.log(`   ⚠ ${pv}: no sibling "${base} ${n}" — would need synth`); missing++; allMatched = false; continue; }
      console.log(`   ✚ reuse "${sib.name}"  ${keep ? `[${fitAxes.join("×")} ${fitVariants.length}]` : "(single)"}  ${fitVariants[0]?.weightGrams ?? vs[0].weightGrams}g`);
      if (COMMIT) {
        sib.isActive = true;
        sib.variantAxes = keep ? fitAxes.map((a) => ({ name: a, values: [...new Set(fitVariants.map((f) => f.options[a]))] })) : [];
        sib.variants = keep ? fitVariants : [];
        sib.defaultVariantKey = keep ? fitVariants[0]?.key : undefined;
        sib.weightGrams = fitVariants[0]?.weightGrams ?? vs[0].weightGrams;
        sib.attributes = { ...(sib.attributes || {}), ...pvAttrs(primaryAxis, pv) };
        sib.$locals.lenientAttributes = true;
        await sib.save();
      }
      reused++;
    }
    // archive the merged parent only if every value was resolved to a sibling
    if (allMatched) { console.log(`   ✗ archive merged parent "${base}"`); if (COMMIT) { await C.updateOne({ _id: P._id }, { $set: { isActive: false } }); await O.deleteMany({ productId: P._id }); } archivedParents++; }
    else console.log(`   … parent kept (unmatched values)`);
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — reused siblings:${reused}  parents archived:${archivedParents}  missing:${missing}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
