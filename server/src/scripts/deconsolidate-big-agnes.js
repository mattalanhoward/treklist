/**
 * deconsolidate-big-agnes.js — reverse the primary-spec-as-variant consolidations
 * to the LOCKED REI standard ([[catalog-variant-standard]]): the primary spec
 * (Temperature / Capacity / Volume) becomes its OWN product; only fit axes (Size)
 * remain variants.
 *
 * Mechanic (verified): each consolidated parent IS the default primary value's
 * original item (renamed + matrix-ified); the other primary values are PRISTINE
 * archived siblings (offers deleted). We link each primary value to its real
 * product via the variant.deepLink → feed productId (no name guessing), then:
 *   - archived sibling  → un-archive + restore its direct offer
 *   - the parent (default value) → revert to a single-primary product (real feed
 *     name, drop the primary axis, keep only its Size fit-variants)
 *
 * DRY-RUN by default; --commit writes. Local DB only.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const PRIMARY = new Set(["Temperature", "Capacity", "Volume"]);
const handleOf = (url) => { const m = String(url || "").match(/\/products\/([^/?#]+)/); return m ? m[1] : null; };
// feed titles keep colorway suffixes we stripped during color-collapse — clean them.
const cleanTitle = (t) => String(t).replace(/\s*-\s*(Vetiver|Warm Olive|Alpenglow)\s*$/i, "").trim();

async function feedMaps() {
  const byHandle = {};
  for (let page = 1; page <= 3; page++) {
    const { stdout } = await execFileP("curl", ["-s", "--max-time", "30", "-A", "Mozilla/5.0",
      `https://www.bigagnes.com/products.json?limit=250&page=${page}`], { maxBuffer: 50 * 1024 * 1024 });
    const products = (JSON.parse(stdout).products) || [];
    if (!products.length) break;
    for (const p of products) byHandle[p.handle] = { id: String(p.id), title: p.title };
  }
  return byHandle;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const feed = await feedMaps();

  const parents = await C.find({
    brandLC: "big agnes", isActive: { $ne: false }, "variants.0": { $exists: true },
    "variantAxes.name": { $in: [...PRIMARY] },
  });
  console.log(`Big Agnes consolidated parents: ${parents.length}\n`);

  let reverted = 0, unarchived = 0, offers = 0, warn = 0;
  for (const P of parents) {
    const axes = P.variantAxes.map((a) => a.name);
    const primaryAxis = axes.find((a) => PRIMARY.has(a));
    const fitAxes = axes.filter((a) => a !== primaryAxis);

    // group this parent's variants by primary value
    const groups = new Map();
    for (const v of P.variants) {
      const pv = v.options.get(primaryAxis);
      if (!groups.has(pv)) groups.set(pv, []);
      groups.get(pv).push(v);
    }

    console.log(`■ "${P.name}"  (${primaryAxis}${fitAxes.length ? " × " + fitAxes.join("×") : ""})  → ${groups.size} products`);

    for (const [pv, vs] of groups) {
      const deepLink = vs.find((v) => v.deepLink)?.deepLink;
      const handle = handleOf(deepLink);
      const feedRec = handle ? feed[handle] : null;
      if (!feedRec) { console.log(`   ⚠ ${pv}: no feed match for ${handle || deepLink}`); warn++; continue; }
      const igid = `bigagnes-${feedRec.id}`;
      const target = await C.findOne({ itemGroupId: igid });
      if (!target) { console.log(`   ⚠ ${pv}: no catalog item for ${igid}`); warn++; continue; }

      // strip the primary axis → fit-only variants (empty if no fit axis)
      const fitVariants = fitAxes.length
        ? vs.map((v) => {
            const opts = {}; fitAxes.forEach((a) => (opts[a] = v.options.get(a)));
            return { key: fitAxes.map((a) => opts[a]).join(" / "), options: opts,
              weightGrams: v.weightGrams, imageUrls: v.imageUrls, deepLink: v.deepLink, sku: v.sku };
          })
        : [];

      // a lone fit value (e.g. a single-size bag mapped to "Regular") is not a
      // real variant axis — collapse to a plain single-weight product.
      const keepVariants = fitVariants.length > 1;
      const title = cleanTitle(feedRec.title);
      const isParent = String(target._id) === String(P._id);
      if (isParent) {
        // revert the parent to its single-primary product
        console.log(`   ↩ revert parent → "${title}"  ${keepVariants ? `[Size ${fitVariants.length}]` : "(single)"}`);
        if (COMMIT) {
          P.name = title;
          P.variantAxes = keepVariants ? fitAxes.map((a) => ({ name: a, values: [...new Set(fitVariants.map((fv) => fv.options[a]))] })) : [];
          P.variants = keepVariants ? fitVariants : [];
          P.defaultVariantKey = keepVariants ? fitVariants[0]?.key : undefined;
          P.weightGrams = fitVariants[0]?.weightGrams ?? P.weightGrams;
          P.$locals.lenientAttributes = true;
          await P.save();
        }
        reverted++;
      } else {
        // un-archive the pristine sibling + restore its direct offer
        console.log(`   ✚ un-archive "${target.name}"  + offer`);
        if (COMMIT) {
          await C.updateOne({ _id: target._id }, { $set: { isActive: true } });
          await O.updateOne(
            { network: "direct", region: "global", merchantId: "bigagnes", productId: target._id },
            { $set: { merchantName: "Big Agnes", deepLink }, $setOnInsert: { priority: 0 } },
            { upsert: true },
          );
        }
        unarchived++; offers++;
      }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — reverted parents:${reverted}  un-archived:${unarchived}  offers:${offers}  warnings:${warn}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
