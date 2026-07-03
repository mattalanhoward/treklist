/**
 * exped-consolidate.js — combine Exped model families into single variant items
 * (user, 2026-07-02, "like Zpacks/HMG"): sleeping bags → Temperature axis, tents →
 * Capacity (× Fabric), pads → R-Value (shape split into separate parents). Each
 * variant keeps its own weight + attributes (already filled). Parent = the default
 * member (renamed); others archived + their offers deleted. Parent keeps ONE offer
 * (MerchantOffer has no variantKey — same tradeoff as HMG/Zpacks).
 *
 * ⚠ Ultra bags: the feed had duplicate metric ("0C 30F") + degree ("0°") slugs → keep
 * the metric-named per temp, archive the degree dups; the unique -20° becomes a variant.
 *
 *   node src/scripts/exped-consolidate.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const fabricOf = (n) => /\bUL\b/.test(n) ? "UL" : /XP/i.test(n) ? "XP Extreme" : /Extreme/i.test(n) ? "Extreme" : "Standard";
const tempKey = (a) => `${a.tempRatingC}°C / ${a.tempRatingF}°F`;
const rKey = (a) => `${a.rValue}R`;

// each family: parent name, itemType, name-match, axis builder(s), default picker
const FAMS = [
  // ---- sleeping bags: Temperature ----
  { parent: "Comfort Sleeping Bag", type: "Sleeping Bag", match: /^Comfort /, axes: [["Temperature", tempKey]] },
  { parent: "Deepsleep Sleeping Bag", type: "Sleeping Bag", match: /^Deepsleep /, axes: [["Temperature", tempKey]] },
  { parent: "Dura Sleeping Bag", type: "Sleeping Bag", match: /^Dura /, axes: [["Temperature", tempKey]] },
  { parent: "Terra Sleeping Bag", type: "Sleeping Bag", match: /^Terra /, axes: [["Temperature", tempKey]] },
  { parent: "Ultra Sleeping Bag", type: "Sleeping Bag", match: /^Ultra /, need: (a) => a.tempRatingC != null, axes: [["Temperature", tempKey]],
    dedupeKey: (a) => String(a.tempRatingC), dedupePreferName: /C\b/ }, // metric "0C 30F" over degree "0°"
  // ---- tents: Capacity (× Fabric) ----
  { parent: "Cassira", type: "Backpacking Tent", match: /^Cassira /, axes: [["Capacity", (a) => a.capacity]] },
  { parent: "Lyra", type: "Backpacking Tent", match: /^Lyra /, axes: [["Capacity", (a) => a.capacity]] },
  { parent: "Outer Space", type: "Backpacking Tent", match: /^Outer Space /, axes: [["Capacity", (a) => a.capacity]] },
  { parent: "Vega", type: "Backpacking Tent", match: /^Vega /, axes: [["Capacity", (a) => a.capacity]] },
  { parent: "Orion", type: "Backpacking Tent", match: /^Orion /, axes: [["Capacity", (a) => a.capacity], ["Fabric", (a, n) => fabricOf(n)]] },
  { parent: "Venus", type: "Backpacking Tent", match: /^Venus /, axes: [["Capacity", (a) => a.capacity], ["Fabric", (a, n) => fabricOf(n)]] },
  { parent: "Ceres", type: "Backpacking Tent", match: /^Ceres /, axes: [["Capacity", (a) => a.capacity], ["Fabric", (a, n) => fabricOf(n)]] },
  // ---- pads: R-Value (shape split) ----
  { parent: "Ultra Mat", type: "Inflatable Sleeping Pad", match: /^Ultra \d.*R$/, axes: [["R-Value", rKey]] },
  { parent: "Ultra Mummy Mat", type: "Inflatable Sleeping Pad", match: /^Ultra .*Mummy$/, axes: [["R-Value", rKey]] },
  { parent: "Ultra Duo Mat", type: "Inflatable Sleeping Pad", match: /^Ultra .*Duo$/, axes: [["R-Value", rKey]] },
  { parent: "Dura Mat", type: "Inflatable Sleeping Pad", match: /^Dura \d.*R$/, axes: [["R-Value", rKey]] },
  { parent: "SIM Mat", type: "Inflatable Sleeping Pad", match: /^SIM \d/, axes: [["R-Value", rKey]] },
  { parent: "SIM Ultra Mat", type: "Inflatable Sleeping Pad", match: /^SIM Ultra /, axes: [["R-Value", rKey]] },
  { parent: "SIM Comfort Mat", type: "Inflatable Sleeping Pad", match: /^SIM Comfort \d/, axes: [["R-Value", rKey]] },
  { parent: "SIM Comfort Duo Mat", type: "Inflatable Sleeping Pad", match: /^SIM Comfort Duo /, axes: [["R-Value", rKey]] },
  { parent: "Versa Mat", type: "Inflatable Sleeping Pad", match: /^Versa \d.*R$/, axes: [["R-Value", rKey]] },
  { parent: "Flex Mat", type: "Inflatable Sleeping Pad", match: /^Flex \d.*R$/, axes: [["R-Value", rKey]] },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let famDone = 0, archived = 0;

  for (const f of FAMS) {
    let members = await C.find({ brand: /^exped$/i, isActive: true, itemType: f.type, name: f.match }).lean();
    if (f.need) members = members.filter((m) => f.need(m.attributes || {}));
    if (members.length < 2) { console.log(`  skip ${f.parent} (${members.length} member)`); continue; }

    // per-member buy-link (each variant routes to its own product page)
    const memberOffers = await O.find({ productId: { $in: members.map((m) => m._id) } }).select("productId deepLink").lean();
    const linkOf = new Map(memberOffers.map((o) => [String(o.productId), o.deepLink]));

    // build variant rows; dedupe by axis-key (prefer name matching dedupePreferName)
    const rows = [];
    for (const m of members) {
      const opts = {}; f.axes.forEach(([ax, fn]) => (opts[ax] = fn(m.attributes || {}, m.name)));
      const key = f.axes.map(([ax]) => opts[ax]).join(" / ");
      const dkey = f.dedupeKey ? f.dedupeKey(m.attributes || {}) : key;
      const dup = rows.find((r) => !r.archiveOnly && r.dkey === dkey);
      if (dup) { // keep the preferred-named one, archive the other
        const preferNew = f.dedupePreferName && f.dedupePreferName.test(m.name) && !f.dedupePreferName.test(dup.doc.name);
        if (preferNew) { rows.push({ archiveOnly: dup.doc }); Object.assign(dup, { key, opts, dkey, doc: m, wt: m.weightGrams, attrs: m.attributes || {}, imgs: m.imageUrls || [], link: linkOf.get(String(m._id)) }); }
        else rows.push({ archiveOnly: m });
        continue;
      }
      rows.push({ key, dkey, opts, doc: m, wt: m.weightGrams, attrs: m.attributes || {}, imgs: m.imageUrls || [], link: linkOf.get(String(m._id)) });
    }
    const variants = rows.filter((r) => !r.archiveOnly);
    variants.sort((a, b) => (a.wt || 0) - (b.wt || 0));
    const parentRow = variants[0];
    const parent = await C.findById(parentRow.doc._id);

    console.log(`\n■ ${f.parent}  ← ${variants.length} variants${rows.length > variants.length ? " (+" + (rows.length - variants.length) + " dup archived)" : ""}`);
    variants.forEach((v) => console.log(`   ${v.key.padEnd(24)} ${v.wt ?? "-"}g`));
    if (!COMMIT) { rows.filter(r => r.archiveOnly).forEach(r => archived++); continue; }

    parent.name = f.parent;
    parent.variantAxes = f.axes.map(([ax]) => ({ name: ax, values: [...new Set(variants.map((v) => v.opts[ax]))] }));
    parent.variants = variants.map((v) => ({ key: v.key, options: v.opts, weightGrams: v.wt, attributes: v.attrs, imageUrls: v.imgs && v.imgs.length ? v.imgs : undefined, deepLink: v.link || undefined }));
    parent.defaultVariantKey = parentRow.key;
    parent.weightGrams = parentRow.wt;
    parent.attributes = parentRow.attrs;
    parent.$locals.lenientAttributes = true;
    await parent.save();

    // archive the non-parent members + dup losers, delete their offers
    const toArchive = [...variants.slice(1).map((v) => v.doc._id), ...rows.filter((r) => r.archiveOnly).map((r) => r.archiveOnly._id)];
    for (const id of toArchive) { await C.updateOne({ _id: id }, { $set: { isActive: false } }); await O.deleteMany({ productId: id }); archived++; }
    famDone++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — families:${famDone || FAMS.length} archived:${archived}`);
  await mongoose.disconnect();
})();
