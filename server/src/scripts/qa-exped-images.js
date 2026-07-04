/**
 * qa-exped-images.js — Exped shared-image fix. Exped is JS-rendered (no feed);
 * each product's page embeds its gallery as
 *   exped.rokka.io/fe_nuxt_crop_product/variables-w-400-h-400/<hash>/<file>
 * (375px renders on the page are RELATED products — ignored). This script finds
 * active Exped items whose imageUrls[0] is shared with a sibling, fetches each
 * item's own deepLink page, and rebuilds imageUrls from the page gallery rewritten
 * to the catalog's w-933-h-933 style. Dry-run default; --commit. Local-only.
 */
require("dotenv").config();
const { execFileSync } = require("child_process");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function pageGallery(url) {
  const html = execFileSync("curl", ["-sL", "-A", UA, "--max-time", "30", url], { maxBuffer: 32 * 1024 * 1024 }).toString();
  const re = /https:\/\/exped\.rokka\.io\/fe_nuxt_crop_product\/variables-w-400-h-400\/([a-f0-9]+)\/([^"'\s)]+)/g;
  const out = []; const seen = new Set();
  let m; while ((m = re.exec(html))) {
    const key = m[1];
    if (seen.has(key)) continue; seen.add(key);
    out.push(`https://exped.rokka.io/fe_nuxt_crop_product/variables-w-933-h-933/${m[1]}/${m[2]}`);
  }
  return out.slice(0, 6);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const items = await CatalogItem.find({ brandLC: "exped", isActive: { $ne: false } }).select("name imageUrls").lean();
  const byImg = {};
  items.forEach((i) => { const k = (i.imageUrls || [])[0]; if (k) (byImg[k] = byImg[k] || []).push(i); });
  const targets = Object.values(byImg).filter((v) => v.length > 1).flat();
  console.log(`${targets.length} items in shared-image groups`);

  for (const it of targets) {
    const o = await MerchantOffer.findOne({ productId: it._id, network: "direct" }).lean();
    if (!o) { console.error("NOOFFER", it.name); continue; }
    let urls;
    try { urls = pageGallery(o.deepLink); } catch (e) { console.error("FETCH FAIL", it.name, e.message); continue; }
    if (!urls.length) { console.error("NO GALLERY", it.name, o.deepLink); continue; }
    const cur0 = (it.imageUrls || [])[0] || "";
    const sameFile = cur0.split("/").pop() === urls[0].split("/").pop() && cur0.includes(urls[0].split("/")[5] || "@");
    console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ${it.name}: img0 ${cur0.split("/").pop().slice(0, 40)} -> ${urls[0].split("/").pop().slice(0, 40)}${sameFile ? " (SAME FILE — brand reuse)" : ""}`);
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: it._id }, { $set: { imageUrls: urls } });
    await new Promise((r) => setTimeout(r, 600));
  }
  await mongoose.disconnect();
})();
