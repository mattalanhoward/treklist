/**
 * deconsolidate-brand.js — generalized reversal of primary-spec-as-variant
 * consolidations to the LOCKED REI standard ([[catalog-variant-standard]]), for
 * brands where the consolidation ARCHIVED pristine per-value siblings (un-archive
 * mechanic; NOT the synthesize case). Generalizes deconsolidate-big-agnes.js.
 *
 * Each primary value is linked to its real product via the variant.deepLink →
 * Shopify feed productId (accurate names, no guessing). Sibling → un-archive +
 * restore its direct offer (metadata CLONED from the parent's own offer, so no
 * per-brand merchant hardcoding). Parent → revert to its single-primary product.
 *
 *   node src/scripts/deconsolidate-brand.js --brand <key> [--commit]
 * Local DB only. Brand registry below (domain = Shopify store for name lookup).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);

const flag = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const COMMIT = process.argv.includes("--commit");
const BRAND = flag("--brand", "");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// primary axes that must become product identity; everything else is a fit variant.
const PRIMARY = new Set(["Temperature", "Capacity", "Volume", "R-Value", "Temp Rating", "Fill Weight"]);
const handleOf = (url) => { const m = String(url || "").match(/\/products\/([^/?#]+)/); return m ? m[1] : null; };

const REGISTRY = {
  "big agnes": { domain: "www.bigagnes.com", color: /\s*-\s*(Vetiver|Warm Olive|Alpenglow)\s*$/i },
  "therm-a-rest": { domain: "www.cascadedesigns.com" },
  "hyperlite mountain gear": { domain: "www.hyperlitemountaingear.com" },
  "hyberg": { domain: "hyberg.de" },
};

async function feedByHandle(domain) {
  const byHandle = {};
  for (let page = 1; page <= 6; page++) {
    let stdout;
    try {
      ({ stdout } = await execFileP("curl", ["-s", "--max-time", "30", "-A", "Mozilla/5.0",
        `https://${domain}/products.json?limit=250&page=${page}`], { maxBuffer: 80 * 1024 * 1024 }));
    } catch { break; }
    let products; try { products = (JSON.parse(stdout).products) || []; } catch { break; }
    if (!products.length) break;
    for (const p of products) byHandle[p.handle] = { id: String(p.id), title: p.title };
    if (products.length < 250) break;
  }
  return byHandle;
}

(async () => {
  const cfg = REGISTRY[BRAND];
  if (!cfg) { console.error(`Unknown brand "${BRAND}". Known: ${Object.keys(REGISTRY).join(", ")}`); process.exit(1); }
  const cleanTitle = (t) => (cfg.color ? String(t).replace(cfg.color, "").trim() : String(t).trim());

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const feed = await feedByHandle(cfg.domain);
  console.log(`${BRAND}: feed products ${Object.keys(feed).length}`);

  const parents = await C.find({
    brandLC: BRAND, isActive: { $ne: false }, "variants.0": { $exists: true },
    "variantAxes.name": { $in: [...PRIMARY] },
  });
  console.log(`consolidated parents: ${parents.length}\n`);

  let reverted = 0, unarchived = 0, warn = 0;
  for (const P of parents) {
    const axes = P.variantAxes.map((a) => a.name);
    const primaryAxis = axes.find((a) => PRIMARY.has(a));
    const fitAxes = axes.filter((a) => a !== primaryAxis);
    const parentOffer = await O.findOne({ productId: P._id }).lean();

    const groups = new Map();
    for (const v of P.variants) {
      const pv = v.options.get(primaryAxis);
      if (!groups.has(pv)) groups.set(pv, []);
      groups.get(pv).push(v);
    }
    console.log(`■ "${P.name}"  (${primaryAxis}${fitAxes.length ? " × " + fitAxes.join("×") : ""})  → ${groups.size} products`);

    for (const [pv, vs] of groups) {
      const deepLink = vs.find((v) => v.deepLink)?.deepLink;
      const feedRec = deepLink ? feed[handleOf(deepLink)] : null;
      if (!feedRec) { console.log(`   ⚠ ${pv}: no feed match (${handleOf(deepLink) || deepLink || "no deepLink"})`); warn++; continue; }
      // itemGroupId is "<domainslug>-<productId>"; match the feed productId suffix.
      const target = await C.findOne({ brandLC: BRAND, itemGroupId: new RegExp(`-${feedRec.id}$`) });
      if (!target) { console.log(`   ⚠ ${pv}: no catalog item for feed id ${feedRec.id}`); warn++; continue; }

      const fitVariants = fitAxes.length
        ? vs.map((v) => { const o = {}; fitAxes.forEach((a) => (o[a] = v.options.get(a)));
            return { key: fitAxes.map((a) => o[a]).join(" / "), options: o, weightGrams: v.weightGrams,
              imageUrls: v.imageUrls, deepLink: v.deepLink, sku: v.sku }; })
        : [];
      const keep = fitVariants.length > 1;
      const title = cleanTitle(feedRec.title);

      if (String(target._id) === String(P._id)) {
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
      } else {
        console.log(`   ✚ un-archive "${target.name}"  + offer`);
        if (COMMIT) {
          await C.updateOne({ _id: target._id }, { $set: { isActive: true } });
          await O.updateOne(
            { network: parentOffer?.network || "direct", region: parentOffer?.region || "global",
              merchantId: parentOffer?.merchantId || BRAND, productId: target._id },
            { $set: { merchantName: parentOffer?.merchantName || P.brand, deepLink }, $setOnInsert: { priority: 0 } },
            { upsert: true },
          );
        }
        unarchived++;
      }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — reverted:${reverted}  un-archived:${unarchived}  warnings:${warn}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
