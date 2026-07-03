/**
 * cumulus-consolidate.js — combine Cumulus fill-weight families into variant items
 * (user, 2026-07-03, "like Zpacks/Exped"): Neo Quilt / The Quilt / Aerial / Vencer each
 * come in fill weights (the number = grams of down = warmth). → Fill Weight axis, one
 * card each. Per-variant weight + attrs (temp) + images + deepLink (each fill is its own
 * GGG/Farlite page). Parent = lightest fill (base attrs valid). Singletons untouched.
 *
 *   node src/scripts/cumulus-consolidate.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const num = (n) => { const m = String(n).match(/\b(\d+)\b/); return m ? +m[1] : 0; };

const FAMS = [
  { parent: "Neo Quilt", type: "Quilt", match: /^Neo Quilt \d/ },
  { parent: "The Quilt", type: "Quilt", match: /^The Quilt \d/ },
  { parent: "Aerial", type: "Sleeping Bag", match: /^Aerial \d/ },
  { parent: "Vencer", type: "Sleeping Bag", match: /^Vencer \d/ },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let done = 0, archived = 0;

  for (const f of FAMS) {
    const members = await C.find({ brand: /^cumulus$/i, isActive: true, itemType: f.type, name: f.match }).lean();
    if (members.length < 2) { console.log(`  skip ${f.parent} (${members.length})`); continue; }
    const offers = await O.find({ productId: { $in: members.map((m) => m._id) } }).select("productId deepLink").lean();
    const linkOf = new Map(offers.map((o) => [String(o.productId), o.deepLink]));

    const variants = members
      .map((m) => ({ doc: m, fill: num(m.name), key: `${num(m.name)} g`, wt: m.weightGrams, attrs: m.attributes || {}, imgs: m.imageUrls || [], link: linkOf.get(String(m._id)) }))
      .sort((a, b) => a.fill - b.fill); // display: light→heavy fill
    const parentRow = variants[0]; // lightest fill = base
    const parent = await C.findById(parentRow.doc._id);

    console.log(`\n■ ${f.parent}  ← ${variants.length} fills: ${variants.map((v) => v.key).join(", ")}`);
    if (!COMMIT) continue;

    parent.name = f.parent;
    parent.variantAxes = [{ name: "Fill Weight", values: variants.map((v) => v.key) }];
    parent.variants = variants.map((v) => ({
      key: v.key, options: { "Fill Weight": v.key }, weightGrams: v.wt, attributes: v.attrs,
      imageUrls: v.imgs.length ? v.imgs : undefined, deepLink: v.link || undefined,
    }));
    parent.defaultVariantKey = parentRow.key;
    parent.weightGrams = parentRow.wt;
    parent.attributes = parentRow.attrs;
    parent.$locals.lenientAttributes = true;
    await parent.save();

    for (const v of variants.slice(1)) {
      await C.updateOne({ _id: v.doc._id }, { $set: { isActive: false } });
      await O.deleteMany({ productId: v.doc._id });
      archived++;
    }
    done++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — families:${done || FAMS.length} archived:${archived}`);
  await mongoose.disconnect();
})();
