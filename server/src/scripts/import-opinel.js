/**
 * import-opinel.js — add the 6 relevant Opinel folding knives (No.06–No.12) from the
 * US distributor opinel-usa.com (open Shopify). Each = one "No.0X Folding Knife" item
 * with a Steel[Carbon/Stainless] variant (No.09 = Carbon only — no plain stainless).
 * itemType Pocket Knife (empty attr schema → no attributes). Direct opinel-usa.com offers.
 *
 * ⚠ WEIGHTLESS on purpose: feed weights are placeholders (uniform 57g carbon / 43-85g
 * stainless across sizes — a No.06 ≠ a No.12). User enters real per-variant weights in
 * the new admin variant editor. Replaces the 1 hand-entered Amazon Opinel (N°06 Stainless).
 *
 *   node src/scripts/import-opinel.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const NUMS = ["06", "07", "08", "09", "10", "12"];
const DEFAULT_STEEL = "Stainless"; // rust-resistant, better for wet/outdoor

(async () => {
  let feed = [];
  for (const pg of [1, 2]) {
    const r = await fetch(`https://www.opinel-usa.com/products.json?limit=250&page=${pg}`, { headers: { "User-Agent": UA } });
    feed = feed.concat((await r.json()).products || []);
  }
  const find = (num, steel) => feed.find((p) => new RegExp(`^No\\.0?${num.replace(/^0/, "")} ${steel} Steel Folding Knife$`, "i").test(p.title));

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const { category, subcategory } = categoryForItemType("Pocket Knife", "Opinel No.08 Folding Knife");
  let created = 0;

  for (const num of NUMS) {
    const name = `No.${num} Folding Knife`;
    if (await C.findOne({ name, brand: /opinel/i }).lean()) { console.log(`${name}: exists — skip`); continue; }
    const steels = [];
    for (const s of ["Carbon", "Stainless"]) { const p = find(num, s); if (p) steels.push({ steel: s, p }); }
    if (!steels.length) { console.log(`  ! ${name}: no feed products`); continue; }

    const def = steels.find((x) => x.steel === DEFAULT_STEEL) || steels[0];
    const multi = steels.length > 1;
    const variantAxes = multi ? [{ name: "Steel", values: steels.map((x) => x.steel) }] : [];
    const variants = multi ? steels.map((x) => ({ key: x.steel, options: { Steel: x.steel }, weightGrams: undefined })) : [];
    const imgs = [...new Set(steels.flatMap((x) => (x.p.images || []).map((i) => i.src)))].slice(0, 8);

    console.log(`${name.padEnd(20)} Steel[${steels.map((x) => x.steel).join("/")}]  default:${def.steel}  imgs:${imgs.length}  (weightless)`);
    if (COMMIT) {
      const doc = new C({
        name, brand: "Opinel", itemType: "Pocket Knife", category, subcategory,
        description: (def.p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
        imageUrls: imgs, createdBy: ADMIN_ID, isActive: true,
        ...(multi ? { variantAxes, variants, defaultVariantKey: def.steel } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-opinel", merchantName: "Opinel", productId: doc._id, deepLink: `https://www.opinel-usa.com/products/${def.p.handle}`, priority: 0 });
      created++;
    }
  }
  // replace the hand-entered Amazon Opinel (N°06 Stainless)
  const old = await C.findOne({ brand: /opinel/i, name: /N°?0?6 Stainless/i, isActive: true, canonicalAsin: { $ne: null } });
  if (old) { console.log(`replace: archive hand-made "${old.name}" (${old.canonicalAsin})`); if (COMMIT) await C.updateOne({ _id: old._id }, { $set: { isActive: false } }); }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${created}`);
  await mongoose.disconnect();
})();
