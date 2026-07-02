/**
 * curate-stragglers.js — 2026-07-02 cleanup sweep:
 *  A. MSR "Backpack" ×24 are all TENTS → retype Backpacking Tent; archive non-tent
 *     parts mis-typed as tents (ferrule kit / repair splints / gear shed); dedup all
 *     MSR Backpacking Tent exact-name dups (incl. pre-existing Access/Remote dups).
 *  B. Therm-a-Rest "Honcho Poncho" (mis-typed Rain Poncho) → insulated camp
 *     blanket-poncho → retype **Quilt**; archive Kids + Past-Season noise; dedup dups.
 *  C. No-category "Other" accessories → assign category/subcategory (itemType stays
 *     Other — no matching taxonomy type for trowels/pumps/whistles/cleats/booties).
 *  D. Sea to Summit "Carbon Neutral Order" = checkout line item, not a product → archive.
 *  E. Brand casing dup UGreen → Ugreen.
 *  F. Osprey Eja: drop the stray unmonetized bever.nl offer (keep the Amazon one).
 *
 *  ⚠ ALL retypes use updateOne $set (NOT .save() — projected .save() wipes unselected
 *  fields via the pre-save normalize hook; see gotcha_select_save_wipes_fields).
 *
 *   node src/scripts/curate-stragglers.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const rank = (a, b) => (b.imageUrls?.length || 0) - (a.imageUrls?.length || 0) || String(a._id).localeCompare(String(b._id));
const NON_TENT = /ferrule|repair splint|repair kit|gear shed/i; // parts/accessories mis-typed as Backpacking Tent

// name→category map (itemType left as Other — no matching taxonomy type)
const CAT_FIX = [
  [/zpacks/i, /down booties/i, "Footwear", "Unisex Footwear"],
  [/zpacks/i, /camp shoes/i, "Footwear", "Unisex Footwear"],
  [/zpacks/i, /pack cover/i, "Accessories & Tools", "Rain Gear"],
  [/zpacks/i, /titanium whistle/i, "Accessories & Tools", "Tools"],
  [/zpacks/i, /rain gaiters/i, "Accessories & Tools", null],
  [/zpacks/i, /foam sit pad/i, "Accessories & Tools", null],
  [/atom packs/i, /hipbelt pocket/i, "Backpacks & Bags", "Day Packs & Accessories"],
  [/vargo/i, /pocket cleats/i, "Accessories & Tools", "Micro Spikes"],
  [/vargo/i, /fire starter/i, "Accessories & Tools", "Fire"],
  [/vargo/i, /coffee filter/i, "Kitchen & Cooking", "Coffee"],
  [/vargo/i, /dig dig tool/i, "Health & Hygiene", "Toilet"],
  [/outdoor research/i, /crocodiles/i, "Accessories & Tools", null],
  [/cnoc/i, /mudpons/i, "Accessories & Tools", "Micro Spikes"], // was mis-cat'd Footwear
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const archive = async (id) => { if (COMMIT) await C.updateOne({ _id: id }, { $set: { isActive: false } }); };
  const retype = async (id, itemType, name) => {
    const { category, subcategory } = categoryForItemType(itemType, name);
    if (COMMIT) await C.updateOne({ _id: id }, { $set: { itemType, category, subcategory: subcategory || undefined } });
  };
  let nRetype = 0, nArch = 0, nCat = 0;

  // ---- A. MSR: Backpack → Backpacking Tent, then clean the whole MSR tent set ----
  const msrBP = await C.find({ brand: /msr/i, isActive: true, itemType: "Backpack" }).select("name").lean();
  for (const d of msrBP) { console.log(`  MSR retype→Tent: ${d.name}`); await retype(d._id, "Backpacking Tent", d.name); nRetype++; }

  // now all MSR tents in one place — archive non-tent parts, then dedup exact-name
  const msrTents = await C.find({ brand: /msr/i, isActive: true, itemType: "Backpacking Tent" }).select("name imageUrls").lean();
  const keepTents = [];
  for (const d of msrTents) {
    if (NON_TENT.test(d.name)) { console.log(`  MSR archive non-tent: ${d.name}`); await archive(d._id); nArch++; }
    else keepTents.push(d);
  }
  const tentGroups = {};
  keepTents.forEach((d) => (tentGroups[d.name] ||= []).push(d));
  for (const grp of Object.values(tentGroups)) {
    if (grp.length < 2) continue;
    grp.sort(rank);
    for (const l of grp.slice(1)) { console.log(`  MSR tent dup archive: ${l.name} (${String(l._id).slice(-6)})`); await archive(l._id); nArch++; }
  }

  // ---- B. TAR Honcho ----
  const tar = await C.find({ brand: /therm-a-rest/i, name: /poncho/i, isActive: true }).select("name imageUrls").lean();
  const ponchoGroups = {};
  for (const d of tar) {
    if (/kids/i.test(d.name)) { console.log(`  TAR archive (kids/past-season): ${d.name}`); await archive(d._id); nArch++; continue; }
    (ponchoGroups[d.name] ||= []).push(d);
  }
  for (const grp of Object.values(ponchoGroups)) {
    grp.sort(rank);
    const [keep, ...losers] = grp;
    for (const l of losers) { console.log(`  TAR dup archive: ${l.name} (${String(l._id).slice(-6)})`); await archive(l._id); nArch++; }
    console.log(`  TAR retype→Quilt: ${keep.name}`);
    await retype(keep._id, "Quilt", keep.name); nRetype++;
  }

  // ---- C. no-category accessories ----
  for (const [b, n, cat, sub] of CAT_FIX) {
    const rows = await C.find({ brand: b, name: n, isActive: true }).select("name brand category subcategory").lean();
    for (const r of rows) {
      console.log(`  cat-fix: ${r.brand || ""} ${r.name}  ${r.category || "-"}/${r.subcategory || "-"} → ${cat}/${sub || "-"}`);
      if (COMMIT) { await C.updateOne({ _id: r._id }, { $set: { category: cat, subcategory: sub || undefined } }); nCat++; }
    }
  }

  // ---- D. Sea to Summit non-product ----
  const cno = await C.findOne({ name: /carbon neutral order/i, isActive: true }).select("name");
  if (cno) { console.log(`  archive non-product: ${cno.name}`); await archive(cno._id); nArch++; }

  // ---- E. brand casing UGreen → Ugreen ----
  const uUp = await C.countDocuments({ brand: "UGreen" });
  if (uUp) { console.log(`  brand casing: UGreen → Ugreen (${uUp} docs)`); if (COMMIT) await C.updateMany({ brand: "UGreen" }, { $set: { brand: "Ugreen", brandLC: "ugreen" } }); }

  // ---- F. Eja stray offer ----
  const eja = await C.findOne({ name: /^eja$/i, brand: /osprey/i }).select("name");
  if (eja) {
    const stray = await O.find({ productId: eja._id, merchantId: "direct-bever" }).lean();
    for (const s of stray) { console.log(`  Eja drop stray offer: ${s.merchantId} ${s.externalProductId}`); if (COMMIT) await O.deleteOne({ _id: s._id }); }
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — retyped:${nRetype} archived:${nArch} cat-fixed:${nCat}`);
  await mongoose.disconnect();
})();
