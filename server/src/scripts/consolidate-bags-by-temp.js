/**
 * consolidate-bags-by-temp.js
 *
 * Standardize "one model, several temperature ratings" sleeping bags/quilts onto a
 * single variant item keyed by Temperature (× Size where the source items already
 * carry a Size axis) — the majority pattern already used by Exped/EE/Nemo/Sea to
 * Summit/Zpacks/Zenbivy. Brands where each temperature is its OWN named model
 * (Western Mountaineering, Katabatic, Cumulus, SIMOND) are deliberately NOT here.
 *
 * Each variant keeps its own weight, images, sku and per-temp deepLink (its product
 * page — size doesn't change the URL for these brands). Parent = the ~20°F member
 * (renamed to the model line); other members archived (isActive:false) + offers
 * deleted. The parent keeps one MerchantOffer; the click resolver overrides it with
 * the selected variant.deepLink (MerchantOffer has no variantKey — known tradeoff).
 *
 *   node src/scripts/consolidate-bags-by-temp.js [--brand big-agnes|therm|hmg|all] [--commit]
 * Local DB only.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
const flag = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const ONLY = (flag("--brand", "all") || "all").toLowerCase();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// --- temperature extractors (return an "N°F" label) ---
const baTemp = (n) => { const m = String(n).match(/(-?\d+)\s*[°˚]?\s*$/); return m ? `${m[1]}°F` : null; };
const tarTemp = (n) => { const m = String(n).match(/(-?\d+)\s*F\b/i); return m ? `${m[1]}°F` : null; };
const hmgTemp = (n) => { const m = String(n).match(/(\d+)\s*-?\s*Degree/i); return m ? `${m[1]}°F` : null; };
const tNum = (t) => parseInt(String(t), 10);

const SIZE_RANK = { Small: 1, Short: 1, Petite: 1, Regular: 2, Wide: 3, "Wide Regular": 3, Long: 4, "Wide Long": 5, "Long Wide": 5 };
const sizeRank = (s) => SIZE_RANK[s] ?? 2;

// families: { brand(LC), parent, match, temp }
const FAMS = [
  // ---- Big Agnes (Temp × Size; women's are their own fit) ----
  { key: "big-agnes", brandLC: "big agnes", parent: "Anthracite", match: /^Anthracite \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Women's Anthracite", match: /^Women's Anthracite \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Greystone", match: /^Greystone \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Women's Greystone", match: /^Women's Greystone \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Torchlight EXP", match: /^Torchlight EXP \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Sidewinder", match: /^Sidewinder \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Lost Ranger 3N1", match: /^Lost Ranger 3N1 \d/, temp: baTemp },
  { key: "big-agnes", brandLC: "big agnes", parent: "Rabbit Ears", match: /^Rabbit Ears \d/, temp: baTemp },
  // ---- Therm-a-Rest ----
  { key: "therm", brandLC: "therm-a-rest", parent: "Questar™ Sleeping Bag", match: /^Questar/, temp: tarTemp },
  { key: "therm", brandLC: "therm-a-rest", parent: "Vesper™ Down Quilt", match: /^Vesper/, temp: tarTemp },
  { key: "therm", brandLC: "therm-a-rest", parent: "Hyperion™ Sleeping Bag", match: /^Hyperion/, temp: tarTemp },
  { key: "therm", brandLC: "therm-a-rest", parent: "Parsec™ Down Sleeping Bag", match: /^Parsec/, temp: tarTemp },
  { key: "therm", brandLC: "therm-a-rest", parent: "Corus™ Down Quilt", match: /^Corus/, temp: tarTemp },
  { key: "therm", brandLC: "therm-a-rest", parent: "Vela™ Double Quilt", match: /^Vela.* Double/, temp: tarTemp },
  { key: "therm", brandLC: "therm-a-rest", parent: "Boost 650™ Sleeping Bag", match: /^Boost 650/, temp: tarTemp },
  // ---- HMG ----
  { key: "hmg", brandLC: "hyperlite mountain gear", parent: "Ultralight Quilt", match: /-Degree.*Quilt/i, temp: hmgTemp },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let famDone = 0, archived = 0;

  for (const f of FAMS) {
    if (ONLY !== "all" && ONLY !== f.key) continue;
    const members = await C.find({
      brandLC: f.brandLC, isActive: { $ne: false },
      itemType: { $in: ["Sleeping Bag", "Quilt"] }, name: f.match,
    }).lean();
    if (members.length < 2) { console.log(`  skip ${f.parent} (${members.length} member)`); continue; }

    const offers = await O.find({ productId: { $in: members.map((m) => m._id) } }).select("productId deepLink").lean();
    const linkOf = new Map(offers.map((o) => [String(o.productId), o.deepLink]));

    // one row per member (temperature), each with its size sub-variants
    let rows = members.map((m) => ({
      doc: m, temp: f.temp(m.name), link: linkOf.get(String(m._id)),
      sizes: (m.variants || []).length
        ? m.variants.map((v) => ({ size: v.key, wt: v.weightGrams, sku: v.sku }))
        : [{ size: null, wt: m.weightGrams, sku: m.externalIds?.sku }],
      imgs: m.imageUrls || [],
    })).filter((r) => r.temp);

    // dedupe two members sharing a temperature (e.g. TAR Boost EU+US): keep the one
    // with more sizes, then a non-"-eu" link; archive the loser.
    const dupArchive = [];
    const byTemp = new Map();
    for (const r of rows) {
      const cur = byTemp.get(r.temp);
      if (!cur) { byTemp.set(r.temp, r); continue; }
      const better = (r.sizes.length !== cur.sizes.length)
        ? r.sizes.length > cur.sizes.length
        : (/-eu\b/i.test(cur.link || "") && !/-eu\b/i.test(r.link || ""));
      if (better) { dupArchive.push(cur.doc); byTemp.set(r.temp, r); } else dupArchive.push(r.doc);
    }
    rows = [...byTemp.values()].sort((a, b) => tNum(a.temp) - tNum(b.temp));
    if (rows.length < 2) { console.log(`  skip ${f.parent} (dedupe→${rows.length})`); continue; }

    const twoAxis = rows.some((r) => r.sizes.some((s) => s.size));
    const temps = rows.map((r) => r.temp);
    const sizes = twoAxis
      ? [...new Set(rows.flatMap((r) => r.sizes.map((s) => s.size || "Regular")))].sort((a, b) => sizeRank(a) - sizeRank(b))
      : [];

    // build variant list
    const variants = [];
    for (const r of rows) {
      for (const s of r.sizes) {
        const size = s.size || "Regular";
        const options = twoAxis ? { Temperature: r.temp, Size: size } : { Temperature: r.temp };
        variants.push({
          key: twoAxis ? `${r.temp} / ${size}` : r.temp,
          options, weightGrams: s.wt,
          imageUrls: r.imgs.length ? r.imgs : undefined,
          deepLink: r.link || undefined, sku: s.sku || undefined,
        });
      }
    }

    // parent = member closest to 20°F; default variant = its Regular (or first) size
    const parentRow = rows.reduce((best, r) =>
      Math.abs(tNum(r.temp) - 20) < Math.abs(tNum(best.temp) - 20) ? r : best, rows[0]);
    const defSize = twoAxis ? (parentRow.sizes.find((s) => (s.size || "Regular") === "Regular") || parentRow.sizes[0]) : parentRow.sizes[0];
    const defaultVariantKey = twoAxis ? `${parentRow.temp} / ${defSize.size || "Regular"}` : parentRow.temp;

    console.log(`\n■ ${f.parent}  ${twoAxis ? "[Temp × Size]" : "[Temp]"}  ← ${rows.length} temps, ${variants.length} variants${dupArchive.length ? ` (+${dupArchive.length} dup)` : ""}`);
    console.log(`   temps: ${temps.join(", ")}${twoAxis ? `  |  sizes: ${sizes.join(", ")}` : ""}  |  default: ${defaultVariantKey}`);
    variants.forEach((v) => console.log(`     ${v.key.padEnd(20)} ${v.weightGrams ?? "?"}g  ${v.deepLink ? "→" : "(no link)"}`));
    if (!COMMIT) { archived += dupArchive.length + (rows.length - 1); continue; }

    const parent = await C.findById(parentRow.doc._id);
    parent.name = f.parent;
    parent.variantAxes = twoAxis
      ? [{ name: "Temperature", values: temps }, { name: "Size", values: sizes }]
      : [{ name: "Temperature", values: temps }];
    parent.variants = variants;
    parent.defaultVariantKey = defaultVariantKey;
    parent.weightGrams = defSize.wt;
    parent.$locals.lenientAttributes = true;
    await parent.save();

    const keepId = String(parentRow.doc._id);
    const toArchive = [...rows.filter((r) => String(r.doc._id) !== keepId).map((r) => r.doc._id), ...dupArchive.map((d) => d._id)];
    for (const id of toArchive) { await C.updateOne({ _id: id }, { $set: { isActive: false } }); await O.deleteMany({ productId: id }); archived++; }
    famDone++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — families:${famDone} archived:${archived}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
