/**
 * backfill-descriptions.js
 *
 * Re-fetches each feed and updates ONLY the `description` field on the items we
 * imported from it (itemGroupId "<slug>-<id>"), so the fuller 2000-char text
 * (with the trailing Specs/weight tables) replaces the old 600-char truncation.
 *
 * SURGICAL: touches description only — never weight/variants/offers/itemType —
 * so manually-curated variants & weights are safe. Only lengthens (never shortens
 * or clobbers a longer existing description). Curated non-feed items are untouched.
 *
 * DRY-RUN by default. --commit writes. --db/--confirm guard.
 *   node src/scripts/backfill-descriptions.js
 *   node src/scripts/backfill-descriptions.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const COMMIT = args.includes("--commit");
const DB = flag("--db", null) || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && flag("--confirm", null) !== DB) {
  console.error(`\nRefusing to --commit to non-local DB "${DB}".\nRe-run with:  --db ${DB} --commit --confirm ${DB}\n`);
  process.exit(1);
}

// The feeds we imported, keyed by their itemGroupId slug.
const FEEDS = [
  { slug: "zpacks", domain: "zpacks.com", platform: "shopify" },
  { slug: "garagegrowngear", domain: "garagegrowngear.com", platform: "shopify" },
  { slug: "durstongear", domain: "durstongear.com", platform: "shopify" },
  { slug: "hyberg", domain: "hyberg.de", platform: "shopify" },
  { slug: "atelierlonguedistance", domain: "atelierlonguedistance.fr", platform: "woo" },
  { slug: "atompacks", domain: "atompacks.co.uk", platform: "shopify" },
];

function htmlToText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
async function curlJson(url) {
  const { stdout } = await execFileP("curl",
    ["-s", "--max-time", "30", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", url],
    { maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(stdout);
}

// id -> full description, for one feed
async function feedDescriptions(feed) {
  const map = new Map();
  if (feed.platform === "woo") {
    for (let page = 1; page <= 60; page++) {
      const arr = await curlJson(`https://${feed.domain}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
      if (!Array.isArray(arr) || !arr.length) break;
      for (const p of arr) map.set(`${feed.slug}-${p.id}`, htmlToText(p.short_description || p.description).slice(0, 2000));
      if (arr.length < 100) break;
    }
  } else {
    for (let page = 1; page <= 40; page++) {
      const data = await curlJson(`https://${feed.domain}/products.json?limit=250&page=${page}`);
      const products = (data && data.products) || [];
      if (!products.length) break;
      for (const p of products) map.set(`${feed.slug}-${p.id}`, htmlToText(p.body_html).slice(0, 2000));
      if (products.length < 250) break;
    }
  }
  return map;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");
  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"}  DB: ${mongoose.connection.name}\n`);

  let grandUpdated = 0;
  for (const feed of FEEDS) {
    const items = await C.find({ itemGroupId: new RegExp("^" + feed.slug + "-") }).select("_id itemGroupId description").lean();
    if (!items.length) { console.log(`${feed.slug}: 0 catalog items — skip`); continue; }
    let map;
    try { map = await feedDescriptions(feed); }
    catch (e) { console.log(`${feed.slug}: fetch failed (${e.message}) — skip`); continue; }

    let updated = 0, longer = 0;
    for (const it of items) {
      const full = map.get(it.itemGroupId);
      if (!full) continue;
      const cur = it.description || "";
      if (full.length > cur.length) {                 // only lengthen
        longer++;
        if (COMMIT) await C.updateOne({ _id: it._id }, { $set: { description: full } });
      }
      updated++;
    }
    grandUpdated += longer;
    console.log(`${feed.slug.padEnd(22)} items=${items.length}  matched=${updated}  would-lengthen=${longer}`);
  }
  console.log(`\nTotal descriptions ${COMMIT ? "updated" : "to update"}: ${grandUpdated}`);
  if (!COMMIT) console.log("(DRY RUN — re-run with --commit.)");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
