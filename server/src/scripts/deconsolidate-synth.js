/**
 * deconsolidate-synth.js — SYNTHESIZE split products for "selector-page" brands
 * (Nemo, Sea to Summit, Zenbivy) that sell one product page with a temp/size
 * selector, so there are no per-value siblings or per-value URLs. Per the locked
 * standard ([[catalog-variant-standard]]) we still split by the primary spec: the
 * primary value moves into the product identity + attributes (so it's filterable),
 * the fit axis (Length/Size) stays a variant, and every split product shares the
 * brand's single page as its buy-link.
 *
 * Reuses the parent doc for the first primary value; CREATES new CatalogItems (+
 * offers cloned to the same deepLink) for the rest. New itemGroupId = "<parent>-<pv>".
 *
 *   node src/scripts/deconsolidate-synth.js --brand <brandLC> [--commit]
 * Local DB only.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const flag = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const COMMIT = process.argv.includes("--commit");
const BRAND = (flag("--brand", "") || "").toLowerCase();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// --primary <axis> restricts splitting to ONE axis (e.g. Katabatic: only "Temperature",
// since its "Fill" is an overfill option to KEEP, not a warmth spec).
const ONLY_AXIS = flag("--primary", null);
const PRIMARY = ONLY_AXIS
  ? new Set([ONLY_AXIS])
  : new Set(["Temperature", "Temp Rating", "Temp/Fill", "Rating/Fill", "Fill", "Volume", "R-Value", "Capacity"]);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// label used in the product NAME for a primary value
function pvLabel(axis, pv, itemType) {
  if (/temp\/fill|rating\/fill|^fill$/i.test(axis)) return String(pv).trim(); // Zenbivy: keep temp+fill ("25°F Down") to distinguish same-temp fills
  if (/temp/i.test(axis)) { const f = (String(pv).match(/-?\d+/) || [])[0]; return f != null ? `${f}°F` : String(pv); }
  if (/capacit/i.test(axis)) { const n = (String(pv).match(/[\d.]+/) || [])[0]; return n ? `${n}P` : String(pv).trim(); }
  if (/volume/i.test(axis)) {
    const s = String(pv).trim();
    // packs: number only ("Southwest 40", "Atmos AG 50"); bottles/reservoirs: keep unit ("2L", "350ml")
    if (/pack/i.test(itemType || "")) { const n = (s.match(/[\d.]+/) || [])[0]; return n || s; }
    return s;
  }
  if (/configuration/i.test(axis)) { return /^standard$/i.test(String(pv).trim()) ? "" : String(pv).trim(); } // Standard = base name
  return String(pv).trim();
}
// structured attributes the primary value contributes (so the split product filters)
function pvAttrs(axis, pv) {
  if (/temp/i.test(axis)) {
    const f = (String(pv).match(/-?\d+/) || [])[0];
    if (f == null) return {};
    const F = parseInt(f, 10);
    return { tempRatingF: F, tempRatingC: Math.round((F - 32) * 5 / 9) };
  }
  if (/volume/i.test(axis)) {
    const s = String(pv); const n = (s.match(/[\d.]+/) || [])[0];
    if (!n) return {};
    return { volumeLiters: /ml/i.test(s) ? parseFloat(n) / 1000 : parseFloat(n) };
  }
  if (/r-?value/i.test(axis)) { const r = (String(pv).match(/[\d.]+/) || [])[0]; return r ? { rValue: parseFloat(r) } : {}; }
  if (/capacit/i.test(axis)) { return { capacity: String(pv).trim() }; } // schema form e.g. "2-Person"
  if (/temp\/fill|rating\/fill/i.test(axis)) { // Zenbivy: pull temp out of "25°F Down"
    const f = (String(pv).match(/(-?\d+)\s*°?\s*F/i) || [])[1];
    if (f == null) return {}; const F = parseInt(f, 10); return { tempRatingF: F, tempRatingC: Math.round((F - 32) * 5 / 9) };
  }
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
  console.log(`${BRAND}: selector-page parents ${parents.length}\n`);

  let split = 0, created = 0;
  for (const P of parents) {
    const axes = P.variantAxes.map((a) => a.name);
    const primaryAxis = axes.find((a) => PRIMARY.has(a));
    const fitAxes = axes.filter((a) => a !== primaryAxis);
    const offer = await O.findOne({ productId: P._id }).lean();
    const baseName = P.name;

    // group variants by primary value, preserving axis order
    const order = (P.variantAxes.find((a) => a.name === primaryAxis)?.values) || [];
    const groups = new Map(order.map((v) => [v, []]));
    for (const v of P.variants) {
      const pv = v.options.get(primaryAxis);
      if (!groups.has(pv)) groups.set(pv, []);
      groups.get(pv).push(v);
    }

    console.log(`■ "${baseName}"  (${primaryAxis}${fitAxes.length ? " × " + fitAxes.join("×") : ""})  → ${groups.size} products`);
    let first = true;
    for (const [pv, vs] of groups) {
      if (!vs.length) continue;
      const fitVariants = fitAxes.length
        ? vs.map((v) => { const o = {}; fitAxes.forEach((a) => (o[a] = v.options.get(a)));
            return { key: fitAxes.map((a) => o[a]).join(" / "), options: o, weightGrams: v.weightGrams, sku: v.sku }; })
        : [];
      const keep = fitVariants.length > 1;
      // dedup: don't append a label already present in the base name (Zenbivy "Uninsulated")
      const lbl = pvLabel(primaryAxis, pv, P.itemType);
      const name = (lbl && !baseName.toLowerCase().includes(lbl.toLowerCase())) ? `${baseName} ${lbl}` : baseName;
      const attrs = { ...(P.attributes || {}), ...pvAttrs(primaryAxis, pv) };
      const weightGrams = fitVariants[0]?.weightGrams ?? vs[0].weightGrams;
      const pvLink = vs.map((v) => v.deepLink).find(Boolean); // per-value buy-link when present

      console.log(`   ${first ? "↩ parent →" : "＋ create"} "${name}"  ${keep ? `[${fitAxes.join("×")} ${fitVariants.length}]` : "(single)"}  ${weightGrams}g  +${Object.keys(pvAttrs(primaryAxis, pv)).join(",")}`);

      if (COMMIT) {
        if (first) {
          P.name = name;
          P.variantAxes = keep ? fitAxes.map((a) => ({ name: a, values: [...new Set(fitVariants.map((f) => f.options[a]))] })) : [];
          P.variants = keep ? fitVariants : [];
          P.defaultVariantKey = keep ? fitVariants[0]?.key : undefined;
          P.weightGrams = weightGrams;
          P.attributes = attrs;
          P.$locals.lenientAttributes = true;
          await P.save();
          if (offer && pvLink && pvLink !== offer.deepLink) await O.updateOne({ _id: offer._id }, { $set: { deepLink: pvLink } });
        } else {
          const doc = P.toObject();
          delete doc._id; delete doc.__v; delete doc.createdAt; delete doc.updatedAt;
          doc.name = name;
          doc.itemGroupId = `${P.itemGroupId || slug(baseName)}-${slug(pvLabel(primaryAxis, pv, P.itemType))}`;
          doc.variantAxes = keep ? fitAxes.map((a) => ({ name: a, values: [...new Set(fitVariants.map((f) => f.options[a]))] })) : [];
          doc.variants = keep ? fitVariants : [];
          doc.defaultVariantKey = keep ? fitVariants[0]?.key : undefined;
          doc.weightGrams = weightGrams;
          doc.attributes = attrs;
          const ci = new C(doc);
          ci.$locals.lenientAttributes = true;
          await ci.save();
          if (offer) {
            await O.create({ network: offer.network, region: offer.region, merchantId: offer.merchantId,
              merchantName: offer.merchantName, deepLink: pvLink || offer.deepLink, productId: ci._id,
              priority: offer.priority || 0, ...(offer.itemGroupId ? { itemGroupId: offer.itemGroupId } : {}) });
          }
          created++;
        }
      }
      first = false;
      split++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — products:${split}  new-created:${created}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
