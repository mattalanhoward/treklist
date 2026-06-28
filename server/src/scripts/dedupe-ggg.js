/**
 * dedupe-ggg.js
 *
 * Finds catalog items imported from a feed (default: garagegrowngear-) that
 * DUPLICATE an existing non-feed item of the same brand. The existing item is
 * the WINNER (it predates the feed and may be referenced by users); the feed
 * dup is removed after its buy-link offer + weight are transferred to the winner.
 *
 * Matching is within-brand on a normalized name (strip "by <brand>", brand
 * words, punctuation):
 *   EXACT  = normalized names equal           -> auto-handled on --commit
 *   FUZZY  = one token-set ⊂ the other, same numbers -> REPORTED for manual review
 *
 * DRY-RUN by default.
 *   node src/scripts/dedupe-ggg.js                # preview
 *   node src/scripts/dedupe-ggg.js --commit       # apply EXACT only
 *   node src/scripts/dedupe-ggg.js --commit --db TrekList --confirm TrekList
 */
require("dotenv").config();
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const COMMIT = args.includes("--commit");
const GROUP = flag("--group", "garagegrowngear-");
const DB = flag("--db", null) || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && flag("--confirm", null) !== DB) {
  console.error(`\nRefusing to --commit to non-local DB "${DB}".\nRe-run with:  --db ${DB} --commit --confirm ${DB}\n`);
  process.exit(1);
}

function norm(name, brandLC) {
  let s = String(name || "").toLowerCase().replace(/\s+by\s+.*$/, "");
  s = s.replace(/[^a-z0-9]+/g, " ").trim();
  for (const w of String(brandLC || "").split(/\s+/).filter(Boolean)) {
    s = s.replace(new RegExp(`\\b${w}\\b`, "g"), " ");
  }
  return s.replace(/\s+/g, " ").trim();
}
const tokens = (s) => new Set(s.split(" ").filter(Boolean));
const nums = (s) => (s.match(/\d+/g) || []).sort().join(",");
const isSubset = (a, b) => [...a].every((t) => b.has(t));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const groupRe = new RegExp("^" + GROUP);

  const feed = await C.find({ itemGroupId: groupRe, isActive: true }).select("name brand brandLC weightGrams").lean();
  const feedBrands = [...new Set(feed.map((f) => f.brandLC).filter(Boolean))];
  const existing = await C.find({ brandLC: { $in: feedBrands }, itemGroupId: { $not: groupRe }, isActive: true })
    .select("name brand brandLC weightGrams attributes").lean();

  const existByBrand = {};
  for (const e of existing) (existByBrand[e.brandLC] = existByBrand[e.brandLC] || []).push({ ...e, n: norm(e.name, e.brandLC) });

  const exact = [], fuzzy = [];
  for (const f of feed) {
    const cands = existByBrand[f.brandLC];
    if (!cands) continue;
    const fn = norm(f.name, f.brandLC), ft = tokens(fn), fnum = nums(fn);
    let matched = false;
    for (const e of cands) {
      if (e.n === fn && fn) { exact.push([f, e]); matched = true; break; }
    }
    if (matched) continue;
    for (const e of cands) {
      const et = tokens(e.n);
      if (fnum === nums(e.n) && ft.size && et.size && (isSubset(ft, et) || isSubset(et, ft))) {
        fuzzy.push([f, e]); break;
      }
    }
  }

  console.log("=".repeat(64));
  console.log(`DEDUPE ${GROUP}*  (${COMMIT ? "COMMIT" : "DRY RUN"})  DB: ${mongoose.connection.name}`);
  console.log(`feed items: ${feed.length} across ${feedBrands.length} brands also in catalog`);
  console.log("=".repeat(64));

  console.log(`\nEXACT dups (feed -> existing winner) [${exact.length}]:`);
  for (const [f, e] of exact) console.log(`  ✗ ${f.brand} — "${f.name.replace(/ by .*/, "")}"  ==>  keep "${e.name}"`);

  console.log(`\nFUZZY candidates — REVIEW, not auto-handled [${fuzzy.length}]:`);
  for (const [f, e] of fuzzy) console.log(`  ? ${f.brand} — "${f.name.replace(/ by .*/, "")}"  ~  "${e.name}"`);

  if (COMMIT && exact.length) {
    console.log(`\nApplying ${exact.length} exact merges...`);
    let moved = 0, weight = 0, del = 0;
    for (const [f, e] of exact) {
      const r = await O.updateMany({ productId: f._id }, { $set: { productId: e._id } });
      moved += r.modifiedCount || 0;
      if (e.weightGrams == null && f.weightGrams != null) {
        await C.updateOne({ _id: e._id }, { $set: { weightGrams: f.weightGrams } });
        weight++;
      }
      await C.deleteOne({ _id: f._id });
      del++;
    }
    console.log(`  offers repointed: ${moved} | weights filled: ${weight} | feed dups deleted: ${del}`);
  } else if (!COMMIT) {
    console.log(`\n(DRY RUN — nothing changed. --commit applies EXACT only; FUZZY stay for manual review.)`);
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
