/**
 * qa-osprey-images.js — give each remaining Osprey split sibling its OWN images
 * (+ per-volume ASIN deepLink) by scraping the Amazon PDP of the hand-captured
 * per-volume ASINs in build-asin-ledger.js EXTRA_ASINS. The sibling that owns the
 * canonical (currently shared) ASIN keeps the existing images.
 *
 * Safety: title-guard per item (skip if the PDP title doesn't contain the expected
 * tokens), skip on empty gallery. Dry-run default; --commit to write. Local-only.
 */
require("dotenv").config();
const { execFileSync } = require("child_process");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// [active item name, ASIN, title-guard regex]
const TARGETS = [
  ["Eja 38", "B0DS6LX8WC", /eja\s*38/i],
  ["Eja 58", "B09JXSNYGW", /eja\s*58/i],
  ["Exos 38", "B0DS6JGQLJ", /exos\s*38/i],
  ["Exos 58", "B0DS6MSDF2", /exos\s*58/i],
  ["Stratos 34", "B09JXJDNGD", /stratos\s*34/i],
  ["Stratos 44", "B09JY5VYPZ", /stratos\s*44/i],
  ["Sirrus 44", "B0G6G8S24G", /sirrus\s*44/i],
  ["Hikelite 26", "B0FGXZ57PD", /hikelite\s*26/i],
  ["Aura AG 65", "B09JXJVDRT", /aura\s*ag\s*65/i],
  ["Aura AG LT 50", "B0BKQGL3BY", /aura\s*ag\s*lt\s*50/i],
  ["Tempest Velocity 30", "B0CGQ5NGL1", /tempest\s*velocity\s*30/i],
];

function fetchPdp(asin) {
  return execFileSync("curl", ["-s", "-L", "-A", UA,
    "-H", "Accept: text/html", "-H", "Accept-Language: en-US,en;q=0.9",
    "--max-time", "30", `https://www.amazon.com/dp/${asin}`], { maxBuffer: 32 * 1024 * 1024 }).toString();
}

function gallery(html) {
  // hiRes ids from the colorImages/imageGalleryData block, in page order
  const ids = [];
  const re = /"hiRes":"https:\/\/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9+._-]+?)\._[^"]*\.jpg"/g;
  let m; while ((m = re.exec(html))) if (!ids.includes(m[1])) ids.push(m[1]);
  if (!ids.length) { // fall back to "large" entries
    const re2 = /"large":"https:\/\/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9+._-]+?)\._[^"]*\.jpg"/g;
    while ((m = re2.exec(html))) if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids.slice(0, 8).map((id) => `https://m.media-amazon.com/images/I/${id}._SL500_.jpg`);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  for (const [name, asin, guard] of TARGETS) {
    const item = await CatalogItem.findOne({ brandLC: "osprey", name, isActive: { $ne: false } }).lean();
    if (!item) { console.error("MISSING item", name); continue; }
    let html;
    try { html = fetchPdp(asin); } catch (e) { console.error("FETCH FAIL", name, asin, e.message); continue; }
    const title = (html.match(/<title>([^<]*)/) || [])[1] || "";
    if (!guard.test(title)) { console.error("TITLE GUARD FAIL", name, asin, "->", title.slice(0, 90)); continue; }
    const imgs = gallery(html);
    if (imgs.length < 2) { console.error("GALLERY EMPTY", name, asin); continue; }
    const deepLink = `https://www.amazon.com/dp/${asin}?tag=treklistapp-20`;
    console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ${name} <- ${asin} (${imgs.length} imgs, img0 ${imgs[0].slice(-24)}) | "${title.slice(12, 70)}"`);
    if (COMMIT) {
      await CatalogItem.collection.updateOne({ _id: item._id }, { $set: { imageUrls: imgs } });
      await MerchantOffer.updateMany({ productId: item._id, network: "amazon" }, { $set: { deepLink } });
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  await mongoose.disconnect();
})();
