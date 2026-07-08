/**
 * qa-msr-fix.js — MSR QA fixes on the Cascade Designs combined store.
 * (1) Re-point offers whose deepLink is a region-gated `-eu` handle (404 for US
 *     visitors) to the same-title NON-eu handle from the live feed.
 * (2) Archive the -eu / duplicate-listing stove twins (DragonFly, WhisperLite
 *     Universal — 0 refs each).
 * (3) Backfill tent/stove weights from the US PDP "Minimum Weight: x lb (y kg)"
 *     (fallback "Weight:") — feed grams are 0 or packaged.
 * Dry-run default; --commit. Local-only.
 */
require("dotenv").config();
const { execFileSync } = require("child_process");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");
const feed = require("/private/tmp/claude-501/-Users-matthewhoward-Projects-treklist/56f16699-c5e8-4d31-82ea-607ff541d297/scratchpad/msr-feed.json");

const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const norm = (s) => String(s).replace(/[™®]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const byTitle = {};
feed.forEach((p) => { (byTitle[norm(p.title)] = byTitle[norm(p.title)] || []).push(p.handle); });

function usHandleFor(title, currentHandle) {
  const hs = byTitle[norm(title)] || [];
  const nonEu = hs.filter((h) => !/-eu$/.test(h));
  if (!nonEu.length) return null;
  // prefer a non-eu handle different from current; else the first
  return nonEu.find((h) => h !== currentHandle) || nonEu[0];
}

function fetchWeight(handle) {
  const html = execFileSync("curl", ["-sL", "-A", UA, "--max-time", "30",
    `https://cascadedesigns.com/products/${handle}`], { maxBuffer: 32 * 1024 * 1024 }).toString();
  const txt = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  let m = txt.match(/Minimum Weight:?[^()]{0,40}\((\d+(?:\.\d+)?)\s*(k?g)\)/);
  if (!m) m = txt.match(/(?<!Packaged |Packed |Fill )Weight:?\s[^()]{0,40}\((\d+(?:\.\d+)?)\s*(k?g)\)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] === "kg" ? 1000 : 1));
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const items = await CatalogItem.find({ brandLC: "msr", isActive: { $ne: false } }).lean();

  // (2) stove dups: archive the -eu DragonFly and the "whisperlite-universal-stove" double listing
  const dupArchive = [];
  for (const it of items) {
    const o = await MerchantOffer.findOne({ productId: it._id, network: "direct" }).lean();
    const h = o && (o.deepLink.match(/\/products\/([a-z0-9-]+)/) || [])[1];
    if (h === "dragonfly-stove-eu" || h === "whisperlite-universal-stove") dupArchive.push({ it, h });
  }
  for (const { it, h } of dupArchive) {
    console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ARCHIVE dup ${it.name} (${h})`);
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: it._id }, { $set: { isActive: false } });
  }
  const archivedIds = new Set(dupArchive.map((d) => String(d.it._id)));

  for (const it of items) {
    if (archivedIds.has(String(it._id))) continue;
    const o = await MerchantOffer.findOne({ productId: it._id, network: "direct" }).lean();
    if (!o) continue;
    let handle = (o.deepLink.match(/\/products\/([a-z0-9-]+)/) || [])[1];

    // (1) dead -eu link → US twin
    if (/-eu$/.test(handle)) {
      const us = usHandleFor(it.name, handle);
      if (us) {
        console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} RELINK ${it.name}: ${handle} -> ${us}`);
        if (COMMIT) await MerchantOffer.updateMany({ productId: it._id, network: "direct" }, { $set: { deepLink: `https://cascadedesigns.com/products/${us}` } });
        handle = us;
      } else console.error("NO US TWIN", it.name, handle);
    }

    // (3) weight backfill
    const hasWeight = it.weightGrams || (it.variants || []).some((v) => v.weightGrams);
    if (!hasWeight) {
      let g = null;
      try { g = fetchWeight(handle); } catch (e) { /* fetch fail */ }
      if (g) {
        console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} WEIGHT ${it.name}: ${g} g (min weight, ${handle})`);
        if (COMMIT) await CatalogItem.collection.updateOne({ _id: it._id }, { $set: { weightGrams: g } });
      } else console.error("NO WEIGHT FOUND", it.name, handle);
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  await mongoose.disconnect();
})();
