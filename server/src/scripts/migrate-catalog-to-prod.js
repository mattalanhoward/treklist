// server/src/scripts/migrate-catalog-to-prod.js
// =============================================================================
// CATALOG MIGRATION — treklist_local  ->  prod treklist  (ARCHIVE-AND-RE-ADD)
// =============================================================================
// Moves the curated catalog from the LOCAL working DB into PROD, touching ONLY
// the `catalogitems` and `merchantoffers` collections. It NEVER opens
// gearitems / globalitems / users / gearlists for writing — those are user data
// and must not change. (The --verify path READS gearitems/globalitems, read-only,
// to prove user lists still resolve; it never writes.)
//
// WHY "archive-and-re-add" instead of drop/replace:
//   User gear items reference catalog items by _id (gearItem.productId,
//   globalItem.productId). Deleting a prod catalog item would orphan that
//   reference and break a user's saved gear. So we ARCHIVE (isActive:false) —
//   never delete — every existing prod item, then re-add the curated set on top.
//   Items that were curated-away simply stay archived (resolvable, just hidden).
//
// _id OVERLAP:
//   Many curated local docs ORIGINATED from prod and share prod's _id. Re-adding
//   by _id (replaceOne upsert) overwrites the prod doc IN PLACE — same _id, so
//   every gear reference keeps resolving. Local-only docs (new curations) insert
//   fresh. Prod-only docs (removed during curation) stay archived from Phase A.
//
// RAW DRIVER ONLY:
//   Uses the native mongodb driver (MongoClient) — NOT Mongoose models — so the
//   CatalogItem pre-save / pre-update hooks NEVER run. Those hooks re-normalize
//   every field from the doc and will silently blank anything not present
//   (data-loss incident 2026-06-29, see memory gotcha_select_save_wipes_fields).
//   All writes are replaceOne / updateMany / deleteMany / bulkWrite.
//
// TWO SYNC MODES:
//   * FULL SYNC (default): the archive-and-re-add above. Wholesale replacement.
//   * SCOPED BRAND SYNC (--brand "<Brand>", repeatable): skips Phase A entirely
//     (no archive-all) and upserts ONLY that brand's catalogitems + their offers,
//     same replaceOne-by-_id + delete-stale-before-upsert semantics, scoped to the
//     brand's productIds. This is the routine day-to-day path once a full sync has
//     seeded prod — it touches nothing outside the named brand(s).
//
// CLOBBER GUARD (full syncs only):
//   Every successful FULL --commit stamps a single meta doc
//   (`_catalogSyncMeta` in the dest db) with { lastSyncAt }. Before any later FULL
//   commit, the script checks the dest for catalogitems/merchantoffers edited in
//   prod (updatedAt > lastSyncAt) that a full sync would overwrite, and ABORTS with
//   a list unless --force-clobber is passed. This mechanically enforces "local is
//   the source of truth — prod edits get flagged, not silently reverted." Brand
//   syncs are intentionally exempt (scoped, deliberate) and do NOT move lastSyncAt,
//   so the full-sync baseline keeps catching every un-reconciled prod edit.
//
// SAFETY:
//   * DRY RUN BY DEFAULT. Writes only with --commit.
//   * Source AND dest DB names are REQUIRED, explicit (no defaults) — because the
//     MONGO_URI's default db path IS prod (`treklist`) and both DBs live on the
//     SAME Atlas cluster. A missing name must never silently fall through to prod.
//   * Writing (--commit) to a non-local dest requires --confirm-dest <destDb> to
//     match, so a prod write can never happen by a stray flag.
//   * Idempotent: safe to re-run from the top after a partial failure.
//   * Writes are confined to `catalogitems` + `merchantoffers` (data) plus the
//     `_catalogSyncMeta` bookkeeping doc on a full commit. Nothing else, ever.
//
// USAGE
//   cd server
//   # DRY RUN (prints planned counts, writes nothing):
//   node src/scripts/migrate-catalog-to-prod.js \
//     --uri "$CLUSTER_URI" --source-db treklist_local --dest-db <PROD_DB>
//
//   # COMMIT (writes catalogitems + merchantoffers in --dest-db only):
//   node src/scripts/migrate-catalog-to-prod.js \
//     --uri "$CLUSTER_URI" --source-db treklist_local --dest-db <PROD_DB> \
//     --commit --confirm-dest <PROD_DB> [--force-clobber]
//
//   # SCOPED BRAND SYNC (upserts only the named brand(s); no archive-all):
//   node src/scripts/migrate-catalog-to-prod.js \
//     --uri "$CLUSTER_URI" --source-db treklist_local --dest-db <PROD_DB> \
//     --brand "Zpacks" --brand "Hyperlite Mountain Gear" \
//     --commit --confirm-dest <PROD_DB>
//
//   # VERIFY (read-only; per-category counts, offer/image spot-checks, list render):
//   node src/scripts/migrate-catalog-to-prod.js \
//     --uri "$CLUSTER_URI" --source-db treklist_local --dest-db <PROD_DB> \
//     --verify [--list <gearListId>] [--sample 8]
//
// See CATALOG_PROD_MIGRATION_RUNBOOK.md for the full step-by-step checklist,
// backup/restore commands, dress rehearsal and rollback.
// =============================================================================

require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

// -----------------------------------------------------------------------------
// ARG PARSING
// -----------------------------------------------------------------------------
function argVal(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
// Repeatable flag: collect every `--name <value>` occurrence (e.g. multiple --brand).
function argVals(name) {
  const out = [];
  process.argv.forEach((a, i) => {
    if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

const COMMIT = hasFlag("--commit");
const DRY_RUN = !COMMIT; // --dry-run is the default; --commit is the only way to write
const VERIFY = hasFlag("--verify");

// Scoped brand sync: one or more --brand "<Brand>" ⇒ skip Phase A, sync only those.
const BRANDS = argVals("--brand");
const BRAND_MODE = BRANDS.length > 0;
// Full-sync clobber-guard override.
const FORCE_CLOBBER = hasFlag("--force-clobber");
// Where the clobber-guard baseline lives, in the DEST db.
const SYNC_META_COLL = "_catalogSyncMeta";
const SYNC_META_ID = "catalog-sync";

const URI = argVal("--uri") || process.env.MONGO_URI;
// Separate source/dest URIs are supported for the rehearsal (both DBs restored
// onto a local mongod). Default: both use --uri.
const SRC_URI = argVal("--source-uri") || URI;
const DST_URI = argVal("--dest-uri") || URI;

const SOURCE_DB = argVal("--source-db");
const DEST_DB = argVal("--dest-db");
const CONFIRM_DEST = argVal("--confirm-dest");
const LIST_ID = argVal("--list");
const SAMPLE = parseInt(argVal("--sample") || "8", 10);

const LOCAL_DBS = new Set(["treklist_local"]);
const BATCH = 500;

// -----------------------------------------------------------------------------
// GUARDS
// -----------------------------------------------------------------------------
function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!URI) die("No Mongo URI (pass --uri or set MONGO_URI).");
if (!SOURCE_DB) die("--source-db is REQUIRED (e.g. treklist_local). No default.");
if (!DEST_DB) die("--dest-db is REQUIRED (e.g. the prod db). No default.");
if (SOURCE_DB === DEST_DB) die("--source-db and --dest-db must differ.");

// Writing to a non-local dest requires an explicit typed confirmation.
if (COMMIT && !LOCAL_DBS.has(DEST_DB) && CONFIRM_DEST !== DEST_DB) {
  die(
    `Refusing to --commit to non-local dest "${DEST_DB}".\n` +
      `  Re-run with:  --dest-db ${DEST_DB} --commit --confirm-dest ${DEST_DB}`,
  );
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
const idStr = (id) => (id instanceof ObjectId ? id.toHexString() : String(id));

async function loadIds(coll, filter = {}) {
  const docs = await coll.find(filter, { projection: { _id: 1 } }).toArray();
  return docs.map((d) => d._id);
}

// per-category active-count map: { "Shelter": 123, ... }
async function categoryCounts(coll) {
  const rows = await coll
    .aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const map = {};
  for (const r of rows) map[r._id || "(no category)"] = r.n;
  return map;
}

// =============================================================================
// MAIN
// =============================================================================
(async () => {
  const srcClient = new MongoClient(SRC_URI);
  const dstClient = SRC_URI === DST_URI ? srcClient : new MongoClient(DST_URI);
  await srcClient.connect();
  if (dstClient !== srcClient) await dstClient.connect();

  const srcDb = srcClient.db(SOURCE_DB);
  const dstDb = dstClient.db(DEST_DB);

  // The ONLY collections this script ever writes to:
  const srcCat = srcDb.collection("catalogitems");
  const srcOff = srcDb.collection("merchantoffers");
  const dstCat = dstDb.collection("catalogitems");
  const dstOff = dstDb.collection("merchantoffers");

  const mode = VERIFY
    ? "VERIFY — read-only"
    : BRAND_MODE
      ? `SCOPED BRAND SYNC${COMMIT ? " — WILL WRITE" : " — DRY RUN"}`
      : COMMIT
        ? "FULL COMMIT — WILL WRITE"
        : "FULL DRY RUN — no writes";
  console.log("=".repeat(74));
  console.log(`CATALOG MIGRATION  (${mode})`);
  console.log(`  source (read) : ${SOURCE_DB}`);
  console.log(`  dest   (write): ${DEST_DB}  ${LOCAL_DBS.has(DEST_DB) ? "(local)" : "(NON-LOCAL)"}`);
  if (BRAND_MODE) console.log(`  brand scope   : ${BRANDS.map((b) => `"${b}"`).join(", ")}`);
  console.log(
    `  writes ONLY  : catalogitems, merchantoffers${
      BRAND_MODE ? "" : " (+ _catalogSyncMeta baseline)"
    }  (never gear/global/users/lists)`,
  );
  console.log("=".repeat(74));

  try {
    if (VERIFY) {
      await runVerify({ srcCat, dstCat, dstOff, dstDb });
    } else if (BRAND_MODE) {
      await runBrandSync({ srcCat, srcOff, dstCat, dstOff });
    } else {
      await runMigration({ srcCat, srcOff, dstCat, dstOff, dstDb });
    }
  } finally {
    await srcClient.close();
    if (dstClient !== srcClient) await dstClient.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// =============================================================================
// MIGRATION
// =============================================================================
async function runMigration({ srcCat, srcOff, dstCat, dstOff, dstDb }) {
  const srcCatCount = await srcCat.countDocuments({});
  const srcCatActive = await srcCat.countDocuments({ isActive: true });
  const dstCatCount = await dstCat.countDocuments({});
  const dstCatActive = await dstCat.countDocuments({ isActive: true });
  console.log(
    `\nSource catalog: ${srcCatCount} docs (${srcCatActive} active).` +
      `\nDest   catalog: ${dstCatCount} docs (${dstCatActive} active).`,
  );

  // ---- load id sets we need for planning + collision-safe offer handling ----
  const localCatIds = await loadIds(srcCat); // every curated item (active + any archived)
  const localCatIdSet = new Set(localCatIds.map(idStr));
  const localOfferIds = await loadIds(srcOff);
  const localOfferIdSet = new Set(localOfferIds.map(idStr));

  // -------------------------------------------------------------------------
  // CLOBBER GUARD — before any writes, flag prod-side edits a full sync would
  // revert. Baseline = _catalogSyncMeta.lastSyncAt (stamped by the last full
  // commit). Any dest catalogitem re-added here (_id ∈ source set) or offer for a
  // re-added item that was edited in prod AFTER that baseline would be overwritten
  // by Phase B/C. "Local is the source of truth" ⇒ ABORT and make the operator
  // reconcile into local, unless --force-clobber. Read-only; runs in dry run too.
  // -------------------------------------------------------------------------
  const metaColl = dstDb.collection(SYNC_META_COLL);
  const meta = await metaColl.findOne({ _id: SYNC_META_ID });
  const lastSyncAt = meta && meta.lastSyncAt;
  console.log(`\n[GUARD] full-sync clobber guard`);
  if (!lastSyncAt) {
    console.log(`    no prior full-sync baseline (_catalogSyncMeta) — nothing to guard.`);
  } else {
    console.log(`    last full sync baseline: ${new Date(lastSyncAt).toISOString()}`);
    const clobberCat = [];
    for (const c of chunk(localCatIds, 1000)) {
      const rows = await dstCat
        .find(
          { _id: { $in: c }, updatedAt: { $gt: lastSyncAt } },
          { projection: { brand: 1, name: 1, updatedAt: 1 } },
        )
        .toArray();
      clobberCat.push(...rows);
    }
    // Offers for re-added items get delete-before-upsert'd in Phase C, so a prod
    // edit to any of them would be reverted too.
    const clobberOff = [];
    for (const c of chunk(localCatIds, 1000)) {
      const rows = await dstOff
        .find(
          { productId: { $in: c }, updatedAt: { $gt: lastSyncAt } },
          { projection: { productId: 1, merchantName: 1, updatedAt: 1 } },
        )
        .toArray();
      clobberOff.push(...rows);
    }
    const total = clobberCat.length + clobberOff.length;
    if (!total) {
      console.log(`    no prod-side edits since baseline — safe to overwrite.`);
    } else {
      console.log(
        `    ⚠ ${total} dest doc(s) edited in prod SINCE the baseline would be overwritten:`,
      );
      for (const d of clobberCat) {
        console.log(
          `      catalog  ${(d.brand || "—")} · ${d.name} · ${new Date(d.updatedAt).toISOString()}`,
        );
      }
      for (const d of clobberOff) {
        console.log(
          `      offer    product ${idStr(d.productId)} · ${d.merchantName || "?"} · ${new Date(
            d.updatedAt,
          ).toISOString()}`,
        );
      }
      if (COMMIT && !FORCE_CLOBBER) {
        die(
          `Refusing to overwrite ${total} prod-edited doc(s) (local is the source of truth).\n` +
            `  Reconcile these edits INTO local first, then re-run —\n` +
            `  or pass --force-clobber to overwrite them anyway.`,
        );
      } else if (COMMIT) {
        console.log(`    --force-clobber set: proceeding despite ${total} prod edit(s).`);
      } else {
        console.log(`    (DRY RUN: a --commit here without --force-clobber would ABORT.)`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // PHASE A — archive every existing prod catalog item (isActive:false)
  // -------------------------------------------------------------------------
  const willArchive = await dstCat.countDocuments({ isActive: { $ne: false } });
  console.log(`\n[A] Archive existing prod catalog items (isActive -> false)`);
  console.log(`    currently non-archived in dest: ${willArchive}`);
  if (COMMIT) {
    const r = await dstCat.updateMany(
      { isActive: { $ne: false } },
      { $set: { isActive: false } },
    );
    console.log(`    archived: matched ${r.matchedCount}, modified ${r.modifiedCount}`);
  }

  // -------------------------------------------------------------------------
  // PHASE B — re-add curated catalog items (replaceOne upsert by _id)
  // -------------------------------------------------------------------------
  // Overlap = local _ids already present in dest (originated from prod) -> replaced
  // in place. Non-overlap = new inserts. Both keep the local _id, so references hold.
  let overlap = 0;
  for (const c of chunk(localCatIds, 1000)) {
    overlap += await dstCat.countDocuments({ _id: { $in: c } });
  }
  const inserts = localCatIds.length - overlap;
  console.log(`\n[B] Re-add curated catalog items (replaceOne upsert by _id)`);
  console.log(`    curated items: ${localCatIds.length}`);
  console.log(`    _id overlap with prod (replace in place): ${overlap}`);
  console.log(`    new inserts: ${inserts}`);
  if (COMMIT) {
    let ops = [];
    let done = 0;
    const flush = async () => {
      if (!ops.length) return;
      await dstCat.bulkWrite(ops, { ordered: false });
      done += ops.length;
      ops = [];
      process.stdout.write(`\r    written: ${done}/${localCatIds.length}`);
    };
    const cursor = srcCat.find({});
    for await (const doc of cursor) {
      ops.push({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      });
      if (ops.length >= BATCH) await flush();
    }
    await flush();
    process.stdout.write("\n");
    const nowActive = await dstCat.countDocuments({ isActive: true });
    console.log(`    dest active catalog items now: ${nowActive}`);
  }

  // -------------------------------------------------------------------------
  // PHASE C — migrate merchantoffers
  // -------------------------------------------------------------------------
  // Offers are catalog-derived, not user data. For every RE-ADDED item we make
  // dest offers exactly mirror local: delete dest offers for those productIds
  // that aren't in the local offer set (avoids unique-index collisions when a
  // curated offer got a fresh _id), then upsert every local offer by _id.
  // Offers for archived-only items (productId NOT re-added) are LEFT ALONE so a
  // user's owned gear on a discontinued item keeps its buy-link.
  console.log(`\n[C] Migrate merchantoffers`);
  console.log(`    curated offers: ${localOfferIds.length}`);

  // Which dest offers belong to re-added items and must be cleared?
  const toDelete = [];
  for (const c of chunk(localCatIds, 1000)) {
    const destOffers = await dstOff
      .find({ productId: { $in: c } }, { projection: { _id: 1 } })
      .toArray();
    for (const o of destOffers) {
      if (!localOfferIdSet.has(idStr(o._id))) toDelete.push(o._id);
    }
  }
  console.log(`    stale dest offers to delete (re-added items only): ${toDelete.length}`);
  console.log(`    dest offers for archived-only items: LEFT UNTOUCHED`);
  if (COMMIT) {
    let del = 0;
    for (const c of chunk(toDelete, 1000)) {
      const r = await dstOff.deleteMany({ _id: { $in: c } });
      del += r.deletedCount;
    }
    console.log(`    deleted stale offers: ${del}`);

    let ops = [];
    let done = 0;
    const flush = async () => {
      if (!ops.length) return;
      await dstOff.bulkWrite(ops, { ordered: false });
      done += ops.length;
      ops = [];
      process.stdout.write(`\r    upserted offers: ${done}/${localOfferIds.length}`);
    };
    const cursor = srcOff.find({});
    for await (const doc of cursor) {
      ops.push({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      });
      if (ops.length >= BATCH) await flush();
    }
    await flush();
    process.stdout.write("\n");
    const nowOffers = await dstOff.countDocuments({});
    console.log(`    dest merchantoffers total now: ${nowOffers}`);
  }

  // -------------------------------------------------------------------------
  // BASELINE — stamp the clobber-guard meta doc AFTER a successful full commit.
  // Only full syncs move this baseline; brand syncs intentionally do not, so the
  // guard keeps catching every un-reconciled prod edit until the next full sync.
  // -------------------------------------------------------------------------
  if (COMMIT) {
    const now = new Date();
    await metaColl.updateOne(
      { _id: SYNC_META_ID },
      { $set: { lastSyncAt: now, mode: "full", updatedAt: now } },
      { upsert: true },
    );
    console.log(`\n[BASELINE] _catalogSyncMeta.lastSyncAt = ${now.toISOString()}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY / next step
  // -------------------------------------------------------------------------
  console.log("\n" + "-".repeat(74));
  if (COMMIT) {
    console.log("✓ Migration COMMITTED to catalogitems + merchantoffers.");
    console.log("  NEXT: run itemType normalization on the same dest DB:");
    console.log(
      `    node src/scripts/normalize-itemtypes.js --db ${DEST_DB}                 # preview`,
    );
    console.log(
      `    node src/scripts/normalize-itemtypes.js --db ${DEST_DB} --commit --confirm ${DEST_DB}`,
    );
    console.log("  THEN: re-run this script with --verify.");
  } else {
    console.log("DRY RUN complete — nothing written. Re-run with --commit to apply.");
  }
}

// =============================================================================
// SCOPED BRAND SYNC
// =============================================================================
// Routine day-to-day path once a full sync has seeded prod. Skips Phase A (no
// archive-all) and, for each --brand, upserts ONLY that brand's catalogitems and
// their offers using the SAME replaceOne-by-_id + delete-stale-before-upsert
// semantics as the full sync, scoped to the brand's productIds. It does NOT move
// the clobber-guard baseline (a full sync owns that). Nothing outside the named
// brand(s) is touched — untouched brands, archived items, and unrelated offers all
// stay exactly as they are in prod.
async function runBrandSync({ srcCat, srcOff, dstCat, dstOff }) {
  console.log(`\nPhase A (archive-all) is SKIPPED in brand mode.`);
  let grandCat = 0;
  let grandOff = 0;
  let grandDel = 0;

  for (const brand of BRANDS) {
    console.log("\n" + "-".repeat(74));
    console.log(`BRAND: "${brand}"`);

    // Brand's curated catalog items (exact match on `brand`).
    const brandCatIds = await loadIds(srcCat, { brand });
    if (!brandCatIds.length) {
      console.log(`    ⚠ no source catalogitems with brand exactly "${brand}" — skipping.`);
      continue;
    }

    // Plan: overlap (replace in place) vs new inserts.
    let overlap = 0;
    for (const c of chunk(brandCatIds, 1000)) {
      overlap += await dstCat.countDocuments({ _id: { $in: c } });
    }
    const inserts = brandCatIds.length - overlap;
    console.log(`[B] catalog items: ${brandCatIds.length}`);
    console.log(`    _id overlap with dest (replace in place): ${overlap}`);
    console.log(`    new inserts: ${inserts}`);

    // Brand's curated offers = source offers whose productId is one of this brand's
    // items. Scope the stale-offer delete to exactly these productIds.
    const brandOffers = [];
    for (const c of chunk(brandCatIds, 1000)) {
      const offs = await srcOff.find({ productId: { $in: c } }).toArray();
      brandOffers.push(...offs);
    }
    const brandOfferIdSet = new Set(brandOffers.map((o) => idStr(o._id)));

    const toDelete = [];
    for (const c of chunk(brandCatIds, 1000)) {
      const destOffers = await dstOff
        .find({ productId: { $in: c } }, { projection: { _id: 1 } })
        .toArray();
      for (const o of destOffers) {
        if (!brandOfferIdSet.has(idStr(o._id))) toDelete.push(o._id);
      }
    }
    console.log(`[C] offers: ${brandOffers.length}`);
    console.log(`    stale dest offers to delete (this brand's productIds only): ${toDelete.length}`);

    grandCat += brandCatIds.length;
    grandOff += brandOffers.length;
    grandDel += toDelete.length;

    if (!COMMIT) continue;

    // ---- write: replaceOne-upsert catalog items by _id ----
    const catDocs = await srcCat.find({ brand }).toArray();
    for (const c of chunk(catDocs, BATCH)) {
      await dstCat.bulkWrite(
        c.map((doc) => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
        { ordered: false },
      );
    }
    console.log(`    upserted catalog items: ${catDocs.length}`);

    // ---- write: delete stale offers, then upsert this brand's offers by _id ----
    let del = 0;
    for (const c of chunk(toDelete, 1000)) {
      const r = await dstOff.deleteMany({ _id: { $in: c } });
      del += r.deletedCount;
    }
    for (const c of chunk(brandOffers, BATCH)) {
      await dstOff.bulkWrite(
        c.map((doc) => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
        { ordered: false },
      );
    }
    console.log(`    deleted stale offers: ${del}, upserted offers: ${brandOffers.length}`);
  }

  console.log("\n" + "-".repeat(74));
  console.log(
    `Brand(s): ${BRANDS.length}   planned catalog upserts: ${grandCat}   ` +
      `offer upserts: ${grandOff}   stale-offer deletes: ${grandDel}`,
  );
  if (COMMIT) {
    console.log("✓ Brand sync COMMITTED (catalogitems + merchantoffers, scoped).");
    console.log("  (Full-sync baseline _catalogSyncMeta.lastSyncAt intentionally NOT moved.)");
    console.log("  THEN: re-run with --verify to confirm counts/refs.");
  } else {
    console.log("DRY RUN complete — nothing written. Re-run with --commit to apply.");
  }
}

// =============================================================================
// VERIFY (read-only)
// =============================================================================
async function runVerify({ srcCat, dstCat, dstOff, dstDb }) {
  console.log("\n[V1] Per-category ACTIVE counts: source vs dest");
  const srcCounts = await categoryCounts(srcCat);
  const dstCounts = await categoryCounts(dstCat);
  const cats = [...new Set([...Object.keys(srcCounts), ...Object.keys(dstCounts)])].sort();
  let mismatches = 0;
  for (const cat of cats) {
    const s = srcCounts[cat] || 0;
    const d = dstCounts[cat] || 0;
    const flag = s === d ? "ok" : "**MISMATCH**";
    if (s !== d) mismatches++;
    console.log(`     ${cat.padEnd(28)} src ${String(s).padStart(5)}   dest ${String(d).padStart(5)}   ${flag}`);
  }
  const srcTotal = Object.values(srcCounts).reduce((a, b) => a + b, 0);
  const dstTotal = Object.values(dstCounts).reduce((a, b) => a + b, 0);
  console.log(`     ${"TOTAL active".padEnd(28)} src ${String(srcTotal).padStart(5)}   dest ${String(dstTotal).padStart(5)}   ${srcTotal === dstTotal ? "ok" : "**MISMATCH**"}`);
  console.log(`     category mismatches: ${mismatches}`);

  console.log("\n[V2] Active dest items WITHOUT any merchant offer (should be ~0)");
  const activeIds = await loadIds(dstCat, { isActive: true });
  const withOffer = new Set();
  for (const c of chunk(activeIds, 1000)) {
    const offs = await dstOff
      .find({ productId: { $in: c } }, { projection: { productId: 1 } })
      .toArray();
    for (const o of offs) if (o.productId) withOffer.add(idStr(o.productId));
  }
  const noOffer = activeIds.filter((id) => !withOffer.has(idStr(id)));
  console.log(`     active items: ${activeIds.length}, with >=1 offer: ${withOffer.size}, WITHOUT: ${noOffer.length}`);
  if (noOffer.length) {
    const sample = await dstCat
      .find({ _id: { $in: noOffer.slice(0, SAMPLE) } }, { projection: { brand: 1, name: 1 } })
      .toArray();
    for (const d of sample) console.log(`       - ${(d.brand || "—")} ${d.name}`);
  }

  console.log(`\n[V3] Image + offer spot-check (${SAMPLE} random active items)`);
  const spot = await dstCat
    .aggregate([{ $match: { isActive: true } }, { $sample: { size: SAMPLE } }])
    .toArray();
  for (const it of spot) {
    const img = (it.imageUrls && it.imageUrls[0]) || "(NO IMAGE)";
    const offer = await dstOff.findOne({ productId: it._id }, { projection: { deepLink: 1, merchantName: 1 } });
    console.log(`     ${(it.brand || "—")} ${it.name}`);
    console.log(`        img:   ${String(img).slice(0, 90)}`);
    console.log(`        offer: ${offer ? `${offer.merchantName || "?"} ${String(offer.deepLink).slice(0, 70)}` : "(NO OFFER)"}`);
  }

  console.log("\n[V4] Referential integrity — user gear still resolves (read-only)");
  // gearitems.productId and globalitems.productId must still point at a catalog
  // doc (active OR archived). Archive-not-delete guarantees this.
  const gearItems = dstDb.collection("gearitems");
  const globalItems = dstDb.collection("globalitems");
  for (const [label, coll] of [["gearitems", gearItems], ["globalitems", globalItems]]) {
    const refs = await coll
      .find({ productId: { $exists: true, $ne: null } }, { projection: { productId: 1 } })
      .toArray();
    const refIds = [...new Set(refs.map((r) => idStr(r.productId)))];
    const present = new Set();
    for (const c of chunk(refIds.map((s) => new ObjectId(s)), 1000)) {
      const found = await dstCat.find({ _id: { $in: c } }, { projection: { _id: 1 } }).toArray();
      for (const f of found) present.add(idStr(f._id));
    }
    const dangling = refIds.filter((id) => !present.has(id));
    console.log(`     ${label}: ${refs.length} refs, ${refIds.length} distinct productIds, DANGLING: ${dangling.length}`);
    if (dangling.length) console.log(`       first dangling: ${dangling.slice(0, 5).join(", ")}`);
  }

  if (LIST_ID) {
    console.log(`\n[V5] Render one real user list: ${LIST_ID}`);
    const gearItems = dstDb.collection("gearitems");
    let listOid;
    try {
      listOid = new ObjectId(LIST_ID);
    } catch {
      console.log("     (invalid ObjectId, skipping)");
      return;
    }
    const items = await gearItems.find({ gearList: listOid }).toArray();
    console.log(`     gear items in list: ${items.length}`);
    let ok = 0;
    for (const gi of items) {
      let cat = null;
      if (gi.productId) cat = await dstCat.findOne({ _id: gi.productId }, { projection: { name: 1, isActive: 1, weightGrams: 1 } });
      const offer = gi.productId ? await dstOff.findOne({ productId: gi.productId }, { projection: { deepLink: 1 } }) : null;
      const resolves = !gi.productId || !!cat;
      if (resolves) ok++;
      console.log(
        `       ${resolves ? "ok " : "** "}${cat ? cat.name : "(custom/no-catalog)"}` +
          `${cat && cat.isActive === false ? " [archived]" : ""}` +
          `${offer ? " · has-offer" : ""}`,
      );
    }
    console.log(`     resolved: ${ok}/${items.length}`);
  }

  console.log("\n" + "-".repeat(74));
  console.log("Verify complete (no writes performed).");
}
