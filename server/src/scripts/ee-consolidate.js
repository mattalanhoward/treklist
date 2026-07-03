/**
 * ee-consolidate.js — consolidate Enlightened Equipment temperature families into
 * variant items (user, 2026-07-03, like the other sleeping bags): Revelation APEX
 * (20/30/40F synthetic) + Enigma (20/30F down) → Temperature axis. Per-variant
 * weight/attrs/images/deepLink (each temp = its own Farlite page). Revelation 20F (down)
 * + Cloud 9 pillow stay singletons. Parent = lightest (warmest); base attrs valid.
 *
 *   node src/scripts/ee-consolidate.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const tempKey = (a) => `${a.tempRatingF}°F`;

const FAMS = [
  { parent: "Revelation APEX", match: /^Revelation APEX \d/ },
  { parent: "Enigma", match: /^Enigma \d/ },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let done = 0, archived = 0;

  for (const f of FAMS) {
    const members = await C.find({ brand: /^enlightened equipment$/i, isActive: true, itemType: "Quilt", name: f.match }).lean();
    if (members.length < 2) { console.log(`  skip ${f.parent} (${members.length})`); continue; }
    const offers = await O.find({ productId: { $in: members.map((m) => m._id) } }).select("productId deepLink").lean();
    const linkOf = new Map(offers.map((o) => [String(o.productId), o.deepLink]));

    const variants = members
      .map((m) => ({ doc: m, key: tempKey(m.attributes || {}), wt: m.weightGrams, attrs: m.attributes || {}, imgs: m.imageUrls || [], link: linkOf.get(String(m._id)) }))
      .sort((a, b) => (a.wt || 0) - (b.wt || 0)); // light→heavy (warm→cold)
    const parentRow = variants[0];
    const parent = await C.findById(parentRow.doc._id);

    console.log(`\n■ ${f.parent}  ← ${variants.map((v) => v.key).join(", ")}`);
    if (!COMMIT) continue;

    parent.name = f.parent;
    parent.variantAxes = [{ name: "Temperature", values: variants.map((v) => v.key) }];
    parent.variants = variants.map((v) => ({
      key: v.key, options: { Temperature: v.key }, weightGrams: v.wt, attributes: v.attrs,
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
