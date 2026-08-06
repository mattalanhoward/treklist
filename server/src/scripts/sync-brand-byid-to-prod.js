/**
 * sync-brand-byid-to-prod.js — mirror ONE brand's full curation from treklist_local →
 * a target DB (default prod TrekList) BY _id (replaceOne upsert), items + offers.
 * Generalized from sync-tarptent-to-prod.js (--brand flag).
 *
 * Use this (not sync-brands-to-prod's fresh-_id inserts) when prod already holds docs
 * for the brand that share local _ids — so updates/archives land on the exact live
 * docs (gear refs preserved) and only genuinely-new local docs insert. Handles
 * archived items (isActive:false lands too), re-modeled items (variants/attrs), and
 * new items in one pass.
 *
 * RAW driver replaceOne only (never the mongoose model → no pre-save normalize wipe).
 * DRY-RUN by default; --commit to a non-local DB requires --confirm <db>. Take a
 * mongodump of prod FIRST.
 *
 * Dry-run:  node src/scripts/sync-brand-byid-to-prod.js --brand neve --db TrekList
 * Apply:    node src/scripts/sync-brand-byid-to-prod.js --brand neve --db TrekList --commit --confirm TrekList
 */
require("dotenv").config();
const mongoose = require("mongoose");
const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BRAND = flag("--brand");
const TARGET_DB = flag("--db", "TrekList");
const COMMIT = args.includes("--commit");
if (!BRAND) { console.error("--brand <name> required (matched case-insensitively against catalogitems.brand)"); process.exit(1); }
if (COMMIT && TARGET_DB !== "treklist_local" && flag("--confirm") !== TARGET_DB) {
  console.error(`\nRefusing to --commit to non-local DB "${TARGET_DB}".\nRe-run with:  --brand ${BRAND} --db ${TARGET_DB} --commit --confirm ${TARGET_DB}\n`);
  process.exit(1);
}
const stripV = (d) => { const { __v, ...rest } = d; return rest; };
const rx = new RegExp(BRAND, "i");

(async () => {
  const srcC = mongoose.createConnection(process.env.MONGO_URI, { dbName: "treklist_local" });
  const dstC = mongoose.createConnection(process.env.MONGO_URI, { dbName: TARGET_DB });
  await srcC.asPromise(); await dstC.asPromise();
  const srcI = srcC.db.collection("catalogitems"), dstI = dstC.db.collection("catalogitems");
  const srcO = srcC.db.collection("merchantoffers"), dstO = dstC.db.collection("merchantoffers");

  const items = await srcI.find({ brand: rx }).toArray();
  console.log(`${COMMIT ? "APPLY" : "DRY-RUN"} → "${TARGET_DB}" (source treklist_local). Brand /${BRAND}/i: ${items.length} items\n`);

  let iIns = 0, iUpd = 0, oIns = 0, oUpd = 0;
  for (const it of items) {
    const prev = await dstI.findOne({ _id: it._id }, { projection: { isActive: 1, weightGrams: 1, variantAxes: 1 } });
    if (prev) {
      const chg = [];
      if ((prev.isActive ?? true) !== (it.isActive ?? true)) chg.push(`active ${prev.isActive}→${it.isActive}`);
      if ((prev.weightGrams ?? null) !== (it.weightGrams ?? null)) chg.push(`wt ${prev.weightGrams ?? "null"}→${it.weightGrams ?? "null"}`);
      if ((prev.variantAxes || []).length !== (it.variantAxes || []).length) chg.push(`axes ${(prev.variantAxes || []).length}→${(it.variantAxes || []).length}`);
      console.log(`  UPD ${it.name.padEnd(26)} ${chg.join("; ") || "(no tracked change)"}`);
      iUpd++;
    } else {
      console.log(`  INS ${it.name.padEnd(26)} ${it.isActive ? "active" : "inactive"}`);
      iIns++;
    }
    if (COMMIT) await dstI.replaceOne({ _id: it._id }, stripV(it), { upsert: true });
    const offers = await srcO.find({ productId: it._id }).toArray();
    for (const o of offers) {
      const po = await dstO.findOne({ _id: o._id }, { projection: { _id: 1 } });
      if (po) oUpd++; else oIns++;
      if (COMMIT) await dstO.replaceOne({ _id: o._id }, stripV(o), { upsert: true });
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: items ${iIns} insert / ${iUpd} update | offers ${oIns} insert / ${oUpd} update`);
  await srcC.close(); await dstC.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
