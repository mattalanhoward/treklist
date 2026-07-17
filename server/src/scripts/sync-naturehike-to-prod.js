/**
 * sync-naturehike-to-prod.js — targeted re-sync of the Naturehike CURATION from
 * treklist_local → a target DB (default prod TrekList), matched by NAME.
 *
 * Context: the Naturehike brand was pushed to prod from a prior chat, but AFTER
 * that push a final round of base-vs-variant weight fixes landed locally (~9
 * items: Gale Terk PRO 500/1000→197/234, First Snow 380/398/412→135/140/145,
 * Ti Cup 600→45/64/79/95/54, CW700 modeled, etc.). Local is strictly ahead —
 * prod got its Naturehike FROM local, so there are no prod-only Naturehike edits
 * to preserve. This syncs only the CURATION fields, matched by name (local/prod
 * _ids differ; name-match verified 95/95). Everything else on prod is untouched.
 *
 * Synced fields: isActive, weightGrams, variantAxes, variants, defaultVariantKey,
 * attributes. (Images/offers/name/category not touched — they already match.)
 *
 * DRY-RUN by default. To apply to prod:
 *   node src/scripts/sync-naturehike-to-prod.js --db TrekList --commit --confirm TrekList
 * Dry-run against prod (read-only, shows the diff):
 *   node src/scripts/sync-naturehike-to-prod.js --db TrekList
 */
require("dotenv").config();
const mongoose = require("mongoose");
const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const TARGET_DB = flag("--db", "TrekList");
const COMMIT = args.includes("--commit");
const LOCAL = new Set(["treklist_local"]);
if (COMMIT && !LOCAL.has(TARGET_DB) && flag("--confirm") !== TARGET_DB) {
  console.error(`\nRefusing to --commit to non-local DB "${TARGET_DB}".\nRe-run with:  --db ${TARGET_DB} --commit --confirm ${TARGET_DB}\n`);
  process.exit(1);
}

// normalize for content comparison (ignore mongoose subdoc _ids)
const normVariants = (v) =>
  JSON.stringify(
    (v || []).map((x) => ({ key: x.key, weightGrams: x.weightGrams ?? null, options: x.options || {}, attributes: x.attributes || {} }))
  );
const normAxes = (a) => JSON.stringify((a || []).map((x) => ({ name: x.name, values: x.values })));
const normAttrs = (a) => JSON.stringify(a || {});

(async () => {
  const srcC = mongoose.createConnection(process.env.MONGO_URI, { dbName: "treklist_local" });
  const dstC = mongoose.createConnection(process.env.MONGO_URI, { dbName: TARGET_DB });
  await srcC.asPromise();
  await dstC.asPromise();
  const src = srcC.db.collection("catalogitems");
  const dst = dstC.db.collection("catalogitems");

  const locals = await src.find({ brand: /naturehike/i }).project({ name: 1, isActive: 1, weightGrams: 1, variantAxes: 1, variants: 1, defaultVariantKey: 1, attributes: 1 }).toArray();
  let changed = 0,
    missing = 0,
    same = 0;
  console.log(`${COMMIT ? "APPLY" : "DRY-RUN"} → target DB "${TARGET_DB}" (source treklist_local). Naturehike items: ${locals.length}\n`);

  for (const l of locals) {
    const p = await dst.findOne({ brand: /naturehike/i, name: l.name });
    if (!p) {
      missing++;
      console.log(`  !! NO PROD MATCH: ${l.name}`);
      continue;
    }
    const diffs = [];
    if ((p.isActive ?? true) !== (l.isActive ?? true)) diffs.push(`isActive ${p.isActive}→${l.isActive}`);
    if ((p.weightGrams ?? null) !== (l.weightGrams ?? null)) diffs.push(`weight ${p.weightGrams ?? "null"}→${l.weightGrams ?? "null"}`);
    if (normVariants(p.variants) !== normVariants(l.variants)) diffs.push(`variants [${(p.variants || []).map((x) => x.weightGrams ?? "-").join(",")}]→[${(l.variants || []).map((x) => x.weightGrams ?? "-").join(",")}]`);
    if (normAxes(p.variantAxes) !== normAxes(l.variantAxes)) diffs.push("variantAxes");
    if ((p.defaultVariantKey ?? null) !== (l.defaultVariantKey ?? null)) diffs.push(`default ${p.defaultVariantKey ?? "null"}→${l.defaultVariantKey ?? "null"}`);
    if (normAttrs(p.attributes) !== normAttrs(l.attributes)) diffs.push("attributes");
    if (!diffs.length) {
      same++;
      continue;
    }
    changed++;
    console.log(`  • ${l.name.slice(0, 44)}`);
    for (const d of diffs) console.log(`       ${d}`);
    if (COMMIT) {
      await dst.updateOne(
        { _id: p._id },
        {
          $set: {
            isActive: l.isActive ?? true,
            ...(l.weightGrams != null ? { weightGrams: l.weightGrams } : {}),
            variantAxes: l.variantAxes || [],
            variants: (l.variants || []).map((x) => ({ key: x.key, options: x.options || {}, ...(x.weightGrams != null ? { weightGrams: x.weightGrams } : {}), ...(x.attributes ? { attributes: x.attributes } : {}), ...(x.imageUrls ? { imageUrls: x.imageUrls } : {}), ...(x.deepLink ? { deepLink: x.deepLink } : {}) })),
            defaultVariantKey: l.defaultVariantKey ?? null,
            attributes: l.attributes || {},
          },
          ...(l.weightGrams == null ? { $unset: { weightGrams: "" } } : {}),
        }
      );
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${changed} to update | ${same} already in sync | ${missing} no-match (of ${locals.length})`);
  await srcC.close();
  await dstC.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
