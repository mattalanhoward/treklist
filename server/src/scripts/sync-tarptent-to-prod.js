/**
 * sync-tarptent-to-prod.js — mirror the Tarptent CURATION from treklist_local →
 * a target DB (default prod TrekList), BY _id (replaceOne upsert), items + offers.
 *
 * Why by-_id (migrate-catalog-to-prod precedent, NOT sync-brands' fresh-_id inserts):
 * prod already holds 8 Tarptent docs that ORIGINATED from local and share local's
 * _ids (the curated Rainbow, the old GGG items, Aeon Li). Matching by _id overwrites
 * those in place — so gear references keep resolving, the Rainbow weight fix lands on
 * the existing doc, and the 4 superseded GGG items flip to isActive:false on the exact
 * docs prod is serving (a name-based insert would instead leave the live GGG versions
 * up and double them). New tents (local-only _ids) insert fresh. Verified mapping
 * before writing: 32 insert, 7 update, 0 prod-only active Tarptent orphans.
 *
 * RAW DRIVER ONLY — replaceOne, never the mongoose model, so the CatalogItem pre-save
 * normalize hook can't blank fields (see gotcha_select_save_wipes_fields).
 *
 * SAFETY: DRY-RUN by default; --commit to a non-local DB requires --confirm <db>.
 *   Take a mongodump of prod catalogitems+merchantoffers FIRST (done:
 *   server/backups/dump-TrekList-PROD-*-pre-tarptent).
 *
 * Dry-run against prod (read-only):
 *   node src/scripts/sync-tarptent-to-prod.js --db TrekList
 * Apply to prod:
 *   node src/scripts/sync-tarptent-to-prod.js --db TrekList --commit --confirm TrekList
 */
require("dotenv").config();
const mongoose = require("mongoose");
const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TARGET_DB = flag("--db", "TrekList");
const COMMIT = args.includes("--commit");
if (COMMIT && TARGET_DB !== "treklist_local" && flag("--confirm") !== TARGET_DB) {
  console.error(`\nRefusing to --commit to non-local DB "${TARGET_DB}".\nRe-run with:  --db ${TARGET_DB} --commit --confirm ${TARGET_DB}\n`);
  process.exit(1);
}
const stripV = (d) => { const { __v, ...rest } = d; return rest; };

(async () => {
  const srcC = mongoose.createConnection(process.env.MONGO_URI, { dbName: "treklist_local" });
  const dstC = mongoose.createConnection(process.env.MONGO_URI, { dbName: TARGET_DB });
  await srcC.asPromise(); await dstC.asPromise();
  const srcI = srcC.db.collection("catalogitems"), dstI = dstC.db.collection("catalogitems");
  const srcO = srcC.db.collection("merchantoffers"), dstO = dstC.db.collection("merchantoffers");

  const items = await srcI.find({ brand: /tarptent/i }).toArray();
  console.log(`${COMMIT ? "APPLY" : "DRY-RUN"} → "${TARGET_DB}" (source treklist_local). Tarptent items: ${items.length}\n`);

  let iIns = 0, iUpd = 0, oIns = 0, oUpd = 0;
  for (const it of items) {
    const prev = await dstI.findOne({ _id: it._id }, { projection: { isActive: 1, weightGrams: 1, imageUrls: 1 } });
    if (prev) {
      const chg = [];
      if ((prev.isActive ?? true) !== (it.isActive ?? true)) chg.push(`active ${prev.isActive}→${it.isActive}`);
      if ((prev.weightGrams ?? null) !== (it.weightGrams ?? null)) chg.push(`wt ${prev.weightGrams ?? "null"}→${it.weightGrams ?? "null"}`);
      if ((prev.imageUrls || []).length !== (it.imageUrls || []).length) chg.push(`imgs ${(prev.imageUrls || []).length}→${(it.imageUrls || []).length}`);
      console.log(`  UPD ${it.name.padEnd(22)} ${chg.join("; ") || "(no change)"}`);
      iUpd++;
    } else {
      console.log(`  INS ${it.name.padEnd(22)} ${it.isActive ? "active" : "inactive"} ${it.weightGrams ?? "?"}g`);
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
