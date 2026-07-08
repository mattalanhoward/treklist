/**
 * big-agnes-consolidate.js — combine Big Agnes tent/pack model families into a
 * single variant item, keyed by Capacity (tents) or Volume (packs). Unlike Exped,
 * BA's axis comes from the NAME (BA items have no capacity attribute), and BA bags
 * & pads are intentionally NOT consolidated (user 2026-07-03: keep them separate per
 * temp/size — they already carry their own Size variants).
 *
 * Each variant keeps its OWN weight, images, and deepLink (its product page), so a
 * user who selects e.g. "Copper Spur UL — 3P" is routed to the UL3 page. Parent =
 * the representative member (2-person tent if present, else lightest; packs = the
 * largest volume). Non-parent members are archived (isActive:false) and their
 * offers deleted; the parent keeps one MerchantOffer (which has no variantKey — the
 * click resolver overrides it with the selected variant.deepLink).
 *
 *   node src/scripts/big-agnes-consolidate.js [--commit]     (local DB only)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const num = (n) => { const m = String(n).match(/(\d+(?:\.\d)?)/); return m ? parseFloat(m[1]) : 0; };
const capP = (n) => { const m = String(n).match(/(\d+(?:\.\d)?)/); const xl = /\bXL\b/i.test(n) ? " XL" : ""; return m ? `${m[1]}P${xl}` : String(n); };
const volL = (n) => { const m = String(n).match(/(\d+)\s*L/i); return m ? `${m[1]}L` : String(n); };

const TENT = "Backpacking Tent";
const FAMS = [
  { parent: "Copper Spur UL", type: TENT, match: /^Copper Spur UL\d+( XL)?$/, axis: ["Capacity", capP] },
  { parent: "Copper Spur UL mtnGLO", type: TENT, match: /^Copper Spur UL\d+ mtnGLO/, axis: ["Capacity", capP] },
  { parent: "Tiger Wall UL", type: TENT, match: /^Tiger Wall UL\d+$/, axis: ["Capacity", capP] },
  { parent: "Tiger Wall Platinum", type: TENT, match: /^Tiger Wall \d+ Platinum$/, axis: ["Capacity", capP] },
  { parent: "Fly Creek UL", type: TENT, match: /^Fly Creek UL\d+$/, axis: ["Capacity", capP] },
  { parent: "Blacktail", type: TENT, match: /^Blacktail \d+$/, axis: ["Capacity", capP] },
  { parent: "Blacktail Hotel", type: TENT, match: /^Blacktail Hotel \d+$/, axis: ["Capacity", capP] },
  { parent: "Crag Lake SL", type: TENT, match: /^Crag Lake SL\d+$/, axis: ["Capacity", capP] },
  { parent: "Salt Creek", type: TENT, match: /^Salt Creek \d+$/, axis: ["Capacity", capP] },
  { parent: "C Bar", type: TENT, match: /^C Bar \d+$/, axis: ["Capacity", capP] },
  { parent: "Sarvis VST", type: TENT, match: /^Sarvis VST \d+$/, axis: ["Capacity", capP] },
  { parent: "String Ridge VST", type: TENT, match: /^String Ridge VST [\d.]+$/, axis: ["Capacity", capP] },
  { parent: "Battle Mountain", type: TENT, match: /^Battle Mountain \d+$/, axis: ["Capacity", capP] },
  { parent: "Sweetwater UL", type: "Backpack", match: /^Sweetwater UL \d+L$/, kind: "volume", axis: ["Volume", volL] },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let famDone = 0, archived = 0;

  for (const f of FAMS) {
    const [axisName, axisFn] = f.axis;
    const members = await C.find({ brandLC: "big agnes", isActive: true, itemType: f.type, name: f.match }).lean();
    if (members.length < 2) { console.log(`  skip ${f.parent} (${members.length} member)`); continue; }

    const offers = await O.find({ productId: { $in: members.map((m) => m._id) } }).select("productId deepLink").lean();
    const linkOf = new Map(offers.map((o) => [String(o.productId), o.deepLink]));

    const variants = members
      .map((m) => ({ doc: m, key: axisFn(m.name), wt: m.weightGrams, imgs: m.imageUrls || [], link: linkOf.get(String(m._id)) }))
      .sort((a, b) => num(a.doc.name) - num(b.doc.name));

    // parent = largest volume (packs) / 2-person tent if present, else smallest
    const parentRow =
      f.kind === "volume"
        ? variants.reduce((mx, v) => (num(v.doc.name) >= num(mx.doc.name) ? v : mx), variants[0])
        : variants.find((v) => v.key === "2P") || variants[0];

    console.log(`\n■ ${f.parent}  ← ${variants.length} variants (parent: ${parentRow.key})`);
    variants.forEach((v) => console.log(`   ${String(v.key).padEnd(10)} ${v.wt ?? "-"}g  ${v.link ? "→ link" : "(no link)"}`));
    if (!COMMIT) continue;

    const parent = await C.findById(parentRow.doc._id);
    parent.name = f.parent;
    parent.variantAxes = [{ name: axisName, values: variants.map((v) => v.key) }];
    parent.variants = variants.map((v) => ({
      key: v.key,
      options: { [axisName]: v.key },
      weightGrams: v.wt,
      imageUrls: v.imgs.length ? v.imgs : undefined,
      deepLink: v.link || undefined,
    }));
    parent.defaultVariantKey = parentRow.key;
    parent.weightGrams = parentRow.wt;
    parent.$locals.lenientAttributes = true;
    await parent.save();

    const keepId = String(parentRow.doc._id);
    for (const v of variants) {
      if (String(v.doc._id) === keepId) continue;
      await C.updateOne({ _id: v.doc._id }, { $set: { isActive: false } });
      await O.deleteMany({ productId: v.doc._id });
      archived++;
    }
    famDone++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — families:${famDone} archived:${archived}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
