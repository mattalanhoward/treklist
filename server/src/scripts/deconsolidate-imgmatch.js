/**
 * deconsolidate-imgmatch.js — reverse primary-spec-as-variant consolidations for
 * brands that carry per-variant images but have NO usable feed (Cumulus/EE/Exped).
 * Links each primary value to its real item by imageUrls[0] (copied into the
 * variant at consolidation time), un-archives the sibling + restores its offer
 * (deepLink from the variant, metadata cloned from the parent's offer), and reverts
 * the parent to its single-primary product (name reconstructed by swapping the
 * primary number into a sibling's name). See [[catalog-variant-standard]].
 *
 *   node src/scripts/deconsolidate-imgmatch.js --brand <brandLC> [--commit]
 * Local DB only.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const flag = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const COMMIT = process.argv.includes("--commit");
const BRAND = (flag("--brand", "") || "").toLowerCase();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const HANDLE_NAME = process.argv.includes("--handle-name"); // derive parent name from its deepLink slug
const PRIMARY = new Set(["Temperature", "Capacity", "Volume", "R-Value", "Temp Rating", "Fill Weight", "Fill"]);
const primNum = (pv) => { const m = String(pv).match(/-?\d+/); return m ? m[0] : null; };
// e.g. "www.exped.com/.../orion-ii-ul" → "Orion II UL"; "deepsleep-0c-30f" → "Deepsleep 0C 30F"
const nameFromHandle = (url) => {
  const seg = String(url || "").split(/[/?#]/).filter(Boolean).pop() || "";
  return seg.split("-").filter(Boolean).map((w) => {
    if (/^(i{1,3}|iv|vi{0,3}|ix|xi{0,3})$/i.test(w)) return w.toUpperCase();      // roman numerals
    if (/^(ul|xp|hl|dcf|sl)$/i.test(w)) return w.toUpperCase();                    // known acronyms
    if (/^-?\d+(c|f)$/i.test(w)) return w.toUpperCase();                           // temp tokens 0c/30f
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const parents = await C.find({
    brandLC: BRAND, isActive: { $ne: false }, "variants.0": { $exists: true },
    "variantAxes.name": { $in: [...PRIMARY] },
  });
  console.log(`${BRAND}: consolidated parents ${parents.length}\n`);

  let reverted = 0, unarchived = 0, warn = 0;
  for (const P of parents) {
    const axes = P.variantAxes.map((a) => a.name);
    const primaryAxis = axes.find((a) => PRIMARY.has(a));
    const fitAxes = axes.filter((a) => a !== primaryAxis);
    const parentOffer = await O.findOne({ productId: P._id }).lean();

    // group variants by primary value, resolve each to its real item by image
    const groups = new Map();
    for (const v of P.variants) {
      const pv = v.options.get(primaryAxis);
      if (!groups.has(pv)) groups.set(pv, []);
      groups.get(pv).push(v);
    }
    const rows = [];
    for (const [pv, vs] of groups) {
      const img = vs.map((v) => (v.imageUrls || [])[0]).find(Boolean);
      const deepLink = vs.find((v) => v.deepLink)?.deepLink;
      let cands = img ? await C.find({ brandLC: BRAND, imageUrls: img }).select("name isActive itemGroupId weightGrams").lean() : [];
      // fallback: when images are shared/absent, match by this pv's (distinct) weight
      if (cands.length !== 1) {
        const wt = vs.map((v) => v.weightGrams).find(Boolean);
        if (wt) cands = await C.find({ brandLC: BRAND, weightGrams: wt }).select("name isActive itemGroupId weightGrams").lean();
      }
      rows.push({ pv, vs, deepLink, target: cands, img });
    }
    // detect parent row (the one whose image resolves to P itself)
    const parentRow = rows.find((r) => r.target.some((t) => String(t._id) === String(P._id)));
    const siblingRow = rows.find((r) => r !== parentRow && r.target.length === 1);

    console.log(`■ "${P.name}"  (${primaryAxis}${fitAxes.length ? " × " + fitAxes.join("×") : ""})  → ${rows.length} products`);

    for (const r of rows) {
      const isParent = r === parentRow;
      // build fit-only variants for this pv
      const fitVariants = fitAxes.length
        ? r.vs.map((v) => { const o = {}; fitAxes.forEach((a) => (o[a] = v.options.get(a)));
            return { key: fitAxes.map((a) => o[a]).join(" / "), options: o, weightGrams: v.weightGrams,
              imageUrls: v.imageUrls, deepLink: v.deepLink, sku: v.sku }; })
        : [];
      const keep = fitVariants.length > 1;

      if (isParent) {
        // name the reverted parent: from its own deepLink slug (authoritative) when
        // --handle-name, else reconstruct from a sibling by swapping the primary number
        let title = P.name;
        if (HANDLE_NAME && r.deepLink) {
          title = nameFromHandle(r.deepLink);
        } else if (siblingRow && siblingRow.target[0]) {
          const sName = siblingRow.target[0].name, sNum = primNum(siblingRow.pv), dNum = primNum(r.pv);
          title = (sNum && dNum && sName.includes(sNum)) ? sName.replace(sNum, dNum) : `${P.name} ${dNum || ""}`.trim();
        }
        console.log(`   ↩ revert parent → "${title}"  ${keep ? `[${fitAxes.join("×")} ${fitVariants.length}]` : "(single)"}`);
        if (COMMIT) {
          P.name = title;
          P.variantAxes = keep ? fitAxes.map((a) => ({ name: a, values: [...new Set(fitVariants.map((f) => f.options[a]))] })) : [];
          P.variants = keep ? fitVariants : [];
          P.defaultVariantKey = keep ? fitVariants[0]?.key : undefined;
          P.weightGrams = fitVariants[0]?.weightGrams ?? P.weightGrams;
          P.$locals.lenientAttributes = true;
          await P.save();
        }
        reverted++;
      } else if (r.target.length === 1) {
        const sib = r.target[0];
        console.log(`   ✚ un-archive "${sib.name}"  + offer`);
        if (COMMIT) {
          await C.updateOne({ _id: sib._id }, { $set: { isActive: true } });
          await O.updateOne(
            { network: parentOffer?.network || "direct", region: parentOffer?.region || "global",
              merchantId: parentOffer?.merchantId || BRAND, productId: sib._id },
            { $set: { merchantName: parentOffer?.merchantName || P.brand, deepLink: r.deepLink }, $setOnInsert: { priority: 0 } },
            { upsert: true },
          );
        }
        unarchived++;
      } else {
        console.log(`   ⚠ ${r.pv}: ${r.target.length} image matches — needs manual review`);
        warn++;
      }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — reverted:${reverted}  un-archived:${unarchived}  warnings:${warn}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
