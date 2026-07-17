/**
 * sync-brands-to-prod.js — copy freshly-curated NEW brands from treklist_local
 * to a target DB (default prod TrekList) as clean INSERTS (items + direct offers).
 *
 * For brands that do NOT yet exist in prod (Aarn, Macpac — verified 0 / 3-preexist),
 * this is a pure ADD, not the archive-and-readd dance. Each active local item is
 * inserted into prod with a FRESH prod _id (local/prod _ids differ by design), all
 * curation fields preserved (itemType/category/attributes/variants/weight/images/
 * description), plus ALL of its MerchantOffers re-pointed to the new prod _id —
 * any network (direct/amazon/awin), preserving amazon `externalProductId` (ASIN).
 *
 * SAFETY:
 *   - name+brand DEDUPE against prod — never inserts a duplicate of an item prod
 *     already has (e.g. the 3 pre-existing manual Macpac items).
 *   - raw collection ops (NOT the mongoose model) so the pre-save normalize hook
 *     can't touch anything — see [[gotcha_select_save_wipes_fields]].
 *   - DRY-RUN by default; refuses --commit to a non-local DB without --confirm.
 *   - Take a mongodump of prod catalogitems+merchantoffers FIRST.
 *
 * Dry-run against prod (read-only):
 *   node src/scripts/sync-brands-to-prod.js --db TrekList
 * Apply to prod:
 *   node src/scripts/sync-brands-to-prod.js --db TrekList --commit --confirm TrekList
 *
 * --brands defaults to "aarn,macpac".
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
const BRANDS = flag("--brands", "aarn,macpac").split(",").map((b) => b.trim()).filter(Boolean);
if (COMMIT && TARGET_DB !== "treklist_local" && flag("--confirm") !== TARGET_DB) {
  console.error(`\nRefusing to --commit to non-local DB "${TARGET_DB}".\nRe-run with:  --db ${TARGET_DB} --commit --confirm ${TARGET_DB}\n`);
  process.exit(1);
}

// strip mongoose/local bookkeeping so prod generates its own
const cleanVariant = (v) => ({
  key: v.key,
  options: v.options || {},
  ...(v.weightGrams != null ? { weightGrams: v.weightGrams } : {}),
  ...(v.attributes ? { attributes: v.attributes } : {}),
  ...(v.imageUrls ? { imageUrls: v.imageUrls } : {}),
  ...(v.deepLink ? { deepLink: v.deepLink } : {}),
  ...(v.sku ? { sku: v.sku } : {}),
  ...(v.description ? { description: v.description } : {}),
});
const cleanItem = (d) => {
  const { _id, __v, createdAt, updatedAt, ...rest } = d;
  const out = { ...rest };
  if (out.variantAxes) out.variantAxes = out.variantAxes.map((a) => ({ name: a.name, values: a.values }));
  if (out.variants) out.variants = out.variants.map(cleanVariant);
  return out;
};

(async () => {
  const srcC = mongoose.createConnection(process.env.MONGO_URI, { dbName: "treklist_local" });
  const dstC = mongoose.createConnection(process.env.MONGO_URI, { dbName: TARGET_DB });
  await srcC.asPromise();
  await dstC.asPromise();
  const srcCat = srcC.db.collection("catalogitems");
  const srcOff = srcC.db.collection("merchantoffers");
  const dstCat = dstC.db.collection("catalogitems");
  const dstOff = dstC.db.collection("merchantoffers");

  console.log(`${COMMIT ? "APPLY" : "DRY-RUN"} → target DB "${TARGET_DB}" (source treklist_local). Brands: ${BRANDS.join(", ")}\n`);

  let totalInsert = 0, totalSkip = 0, totalOffers = 0, totalNoOffer = 0;
  for (const brand of BRANDS) {
    const rx = new RegExp(brand, "i");
    const items = await srcCat.find({ brand: rx, isActive: true }).toArray();
    let ins = 0, skip = 0, offs = 0, noOff = 0;
    for (const it of items) {
      const exists = await dstCat.findOne({ brand: rx, name: it.name }, { projection: { _id: 1 } });
      if (exists) { skip++; continue; }
      // copy ALL of the item's offers, preserving network + any amazon ASIN
      const localOffers = await srcOff.find({ productId: it._id }).toArray();
      const doc = cleanItem(it);
      const newId = new mongoose.Types.ObjectId();
      doc._id = newId;
      doc.createdAt = new Date();
      doc.updatedAt = new Date();
      if (COMMIT) await dstCat.insertOne(doc);
      ins++;
      for (const lo of localOffers) {
        const offer = {
          network: lo.network,
          region: lo.region || "global",
          merchantId: lo.merchantId,
          merchantName: lo.merchantName,
          productId: newId,
          deepLink: lo.deepLink,
          priority: lo.priority ?? 0,
          ...(lo.externalProductId ? { externalProductId: lo.externalProductId } : {}),
          ...(lo.itemGroupId ? { itemGroupId: lo.itemGroupId } : {}),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        if (COMMIT) await dstOff.insertOne(offer);
        offs++;
      }
      if (!localOffers.length) {
        noOff++;
        console.log(`   !! ${it.name}: no local offer to copy`);
      }
    }
    console.log(`  ${brand}: ${ins} to insert | ${skip} already in prod | ${offs} offers${noOff ? ` | ${noOff} MISSING offer` : ""} (local active: ${items.length})`);
    totalInsert += ins; totalSkip += skip; totalOffers += offs; totalNoOffer += noOff;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${totalInsert} items + ${totalOffers} offers to insert | ${totalSkip} already in prod${totalNoOffer ? ` | ${totalNoOffer} missing offers` : ""}`);
  await srcC.close();
  await dstC.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
