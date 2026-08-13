/**
 * strip-brand-descriptions.js
 *
 * Removes verbatim BRAND marketing copy from the catalog, keeping only text we
 * authored ourselves or that came from an affiliate feed we have a relationship
 * with (Awin). Decision: user, 2026-08-11 — "remove all descriptions unless they
 * come from AWIN or Amazon", applied with STRICT provenance (exempt only where
 * the text actually originated in the feed, not merely where an offer exists).
 *
 * KEEP
 *   - keep:awin   item has an Awin offer. The Decathlon importer takes its text
 *                 straight from the Awin CSV (`reconcile-decathlon-batch3.js`
 *                 sets `description = clean(fr[idx.description])`), so this text
 *                 IS feed-origin.
 *   - keep:ours   text we wrote: a literal in one of our curation scripts, or a
 *                 brand whose descriptions are template-synthesized from spec
 *                 fields (MEC/Macpac `describe()`), which no literal match can see.
 *
 * STRIP (everything else) — but ALWAYS preserve weight/size precision notes.
 *   Those notes are ours and are a standing accuracy rule (memory
 *   `feedback_flat_weight_disclosure`): "198 g is for size Medium" must survive,
 *   or a stripped item silently starts looking more precise than it is.
 *
 * ⚠ AMAZON IS NOT EXEMPT HERE — see AMAZON note below. `--keep-amazon` flips it.
 *
 * Covers item-level `description` AND per-variant `variants[].description`.
 * Writes every original to a gitignored sidecar in server/backups/ first, so the
 * whole run is reversible with `--restore <sidecar.json>`.
 *
 * Uses `collection.updateOne` only — never `.save()` on a projected doc
 * (memory `gotcha_select_save_wipes_fields`).
 *
 * DRY-RUN by default. --commit writes. --db/--confirm guard non-local DBs.
 *   node src/scripts/strip-brand-descriptions.js
 *   node src/scripts/strip-brand-descriptions.js --commit
 *   node src/scripts/strip-brand-descriptions.js --db TrekList --commit --confirm TrekList
 *   node src/scripts/strip-brand-descriptions.js --restore server/backups/<file>.json --commit
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const COMMIT = args.includes("--commit");
const KEEP_AMAZON = args.includes("--keep-amazon");
const RESTORE = flag("--restore", null);
const DB = flag("--db", null) || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && flag("--confirm", null) !== DB) {
  console.error(`\nRefusing to --commit to non-local DB "${DB}".\nRe-run with:  --db ${DB} --commit --confirm ${DB}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// AMAZON
// ---------------------------------------------------------------------------
// The rule as stated exempts Amazon, but neither reading of "came from Amazon"
// survives contact with the data:
//   1. Most Amazon-offer items carry BRAND-site copy that we scraped and later
//      attached an ASIN to (e.g. every Osprey pack's text is osprey.com's), so
//      it never came from Amazon at all.
//   2. Text that genuinely came from the Amazon Product Advertising API may not
//      be stored permanently — see the comment on `description` in
//      models/catalogItem.js: "Do NOT store Amazon text permanently (Amazon API
//      ToS)". Amazon's cache window is ~24h.
// Both paths lead to "strip", so Amazon-offer items are treated like any other.
// Pass --keep-amazon to exempt them anyway.

// Brands whose descriptions are template-synthesized from spec fields by our own
// scripts (`function describe(...)`), so they can never match a literal lookup.
// Verified by reading the scripts: create-mec-apparel.js, curate-macpac.js.
const OURS_BRANDS = new Set(["MEC", "Macpac"]);

// Weight / size precision notes — ours, and must survive stripping.
const NOTE_RX = new RegExp(
  [
    "listed weights? (is|are)",                                  // "Listed weight is per pair."
    "weight (is|per pair|per single|not published)",             // "Weight is for the reference size (Size M)"
    "weights? (are|may|can) (approximate|vary)",                 // "All weights are approximate…"
    "weights? made vary",                                        // Nashville's typo, verbatim in the data
    "weight \\((based on size|manufacturer)",                    // FarPointe gsm breakdowns
    "specs? based on",                                           // Durston "* Specs based on average size medium."
    "(dimensions and weight|weight, volume and dimensions)[^.]{0,60}(vary|tolerance)",
    "torso sizes?:",                                             // per-torso weight tables
    "your configuration may vary",
    "reference[- ]size",
    "sample size",
    "a pair ~",
    "does not publish",
  ].join("|"),
  "i"
);

const SCRIPTS_DIR = __dirname;
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const snip = (s) => norm(s).toLowerCase().slice(0, 60);

// Blob of our own script SOURCES (.js only — cached feed .json files in this
// directory are brand copy and must never count as "ours").
function loadScriptBlob() {
  let blob = "";
  for (const f of fs.readdirSync(SCRIPTS_DIR)) {
    if (!f.endsWith(".js")) continue;
    blob += "\n" + fs.readFileSync(path.join(SCRIPTS_DIR, f), "utf8");
  }
  return blob
    .replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, " ")
    .replace(/\s+/g, " ").toLowerCase();
}

// Split into segments (paragraphs, then sentences) and keep only the notes.
function preservedNotes(text) {
  const segs = String(text || "")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z*•])/)
    .map(norm)
    .filter(Boolean);
  const kept = segs.filter((s) => NOTE_RX.test(s) && s.length <= 220);
  return kept.join(" ").trim();
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = mongoose.connection.collection("catalogitems");
  const O = mongoose.connection.collection("merchantoffers");

  if (RESTORE) return restore(C);

  const blob = loadScriptBlob();
  const awinIds = new Set((await O.distinct("productId", { network: "awin" })).map(String));
  const amazonIds = new Set((await O.distinct("productId", { network: "amazon" })).map(String));

  const items = await C.find(
    { $or: [{ description: { $nin: [null, ""] } }, { "variants.description": { $nin: [null, ""] } }] },
    { projection: { name: 1, brand: 1, isActive: 1, description: 1, "variants.key": 1, "variants.description": 1 } }
  ).toArray();

  const stats = {};
  const bump = (k) => { stats[k] = (stats[k] || 0) + 1; };
  const byBrand = {};
  const sidecar = [];
  const ops = [];

  for (const it of items) {
    const id = String(it._id);
    const brand = it.brand || "(none)";
    let verdict;
    if (awinIds.has(id)) verdict = "keep:awin";
    else if (KEEP_AMAZON && amazonIds.has(id)) verdict = "keep:amazon";
    else if (OURS_BRANDS.has(brand)) verdict = "keep:ours(synth)";
    else if (it.description && blob.includes(snip(it.description))) verdict = "keep:ours(literal)";
    else verdict = "strip";

    bump(verdict);
    if (verdict !== "strip") continue;

    const $set = {};
    const $unset = {};
    let notesKept = 0;

    if (norm(it.description)) {
      const notes = preservedNotes(it.description);
      if (notes) { $set.description = notes; notesKept++; }
      else $unset.description = "";
    }
    (it.variants || []).forEach((v, i) => {
      if (!norm(v.description)) return;
      const notes = preservedNotes(v.description);
      if (notes) { $set[`variants.${i}.description`] = notes; notesKept++; }
      else $unset[`variants.${i}.description`] = "";
    });
    if (!Object.keys($set).length && !Object.keys($unset).length) continue;

    sidecar.push({
      _id: id, name: it.name, brand, isActive: it.isActive,
      description: it.description,
      variants: (it.variants || []).map((v) => ({ key: v.key, description: v.description })).filter((v) => v.description),
    });
    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    ops.push({ _id: it._id, update });

    byBrand[brand] = byBrand[brand] || { stripped: 0, notesKept: 0 };
    byBrand[brand].stripped++;
    byBrand[brand].notesKept += notesKept;
  }

  // ---- report
  console.log(`\nDB: ${DB}   items with any description: ${items.length}`);
  console.log("\nCLASSIFICATION");
  for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${String(v).padStart(5)}`);
  }
  const totalNotes = Object.values(byBrand).reduce((s, v) => s + v.notesKept, 0);
  console.log(`\nTO STRIP: ${ops.length} items   (weight/size notes preserved on ${totalNotes} fields)`);
  console.log("\nTOP BRANDS STRIPPED");
  for (const [b, v] of Object.entries(byBrand).sort((a, b2) => b2[1].stripped - a[1].stripped).slice(0, 20)) {
    console.log(`  ${b.padEnd(28)} ${String(v.stripped).padStart(4)}  (notes kept: ${v.notesKept})`);
  }

  if (!COMMIT) {
    console.log("\nSAMPLE (first 5 with a preserved note):");
    for (const s of sidecar.filter((x) => preservedNotes(x.description)).slice(0, 5)) {
      console.log(`  ${s.brand} — ${s.name}`);
      console.log(`    before: "${norm(s.description).slice(0, 90)}…"`);
      console.log(`    after:  "${preservedNotes(s.description)}"`);
    }
    console.log("\nDRY RUN — nothing written. Re-run with --commit.\n");
    return;
  }

  // ---- sidecar backup (gitignored) BEFORE any write
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const dir = path.join(__dirname, "../../backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `descriptions-${DB}-${ts}-pre-strip.json`);
  fs.writeFileSync(file, JSON.stringify(sidecar, null, 1));
  console.log(`\nSidecar written: ${file} (${sidecar.length} items)`);

  let n = 0;
  for (const op of ops) {
    await C.updateOne({ _id: op._id }, op.update);
    if (++n % 500 === 0) console.log(`  …${n}/${ops.length}`);
  }
  console.log(`\n✅ Stripped ${n} items. Restore with:\n   node src/scripts/strip-brand-descriptions.js --restore ${file} --commit\n`);
}

async function restore(C) {
  const rows = JSON.parse(fs.readFileSync(RESTORE, "utf8"));
  console.log(`Restoring ${rows.length} descriptions from ${RESTORE}${COMMIT ? "" : " (DRY RUN)"}`);
  if (!COMMIT) return;
  let n = 0;
  for (const r of rows) {
    const $set = {};
    if (r.description) $set.description = r.description;
    const doc = await C.findOne({ _id: new mongoose.Types.ObjectId(r._id) }, { projection: { "variants.key": 1 } });
    for (const v of r.variants || []) {
      const i = (doc?.variants || []).findIndex((x) => x.key === v.key);
      if (i !== -1) $set[`variants.${i}.description`] = v.description;
    }
    if (Object.keys($set).length) { await C.updateOne({ _id: new mongoose.Types.ObjectId(r._id) }, { $set }); n++; }
  }
  console.log(`✅ Restored ${n} items.`);
}

main()
  .catch((e) => { console.error("ERR", e.stack); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
