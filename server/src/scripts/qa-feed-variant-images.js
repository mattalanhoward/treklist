/**
 * qa-feed-variant-images.js — fix the #1 re-split defect: split siblings sharing
 * the parent's imageUrls[0]. For selector-page brands the Shopify feed carries
 * per-variant featured images (image.variant_ids / variant.featured_image); this
 * script matches each active item's PRIMARY spec (capacity "2P" / temp "15°F" /
 * volume "50L" in the item name) to the feed variant and rebuilds imageUrls as:
 *   [matched variant's featured image, ...generic product images]
 * excluding images that belong to OTHER variants.
 *
 *   node src/scripts/qa-feed-variant-images.js --brand nemo --feed <cached-feed.json> [--commit]
 *
 * --by-handle mode: when each split sibling has its OWN product page (Big Agnes
 * bags/footprints), skip variant matching and simply sync imageUrls from the item's
 * own feed product (only when img0 differs from the feed's first image).
 *
 * Feed file = JSON array of Shopify products (products.json pages merged).
 * Items are matched to products by the offer deepLink handle. Items without a
 * primary spec in the name, or whose product has no per-variant images, are
 * skipped (reported). Dry-run default. Local-only.
 */
require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const flag = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const COMMIT = process.argv.includes("--commit");
const BRAND = flag("--brand", null);
const FEED = flag("--feed", null);
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
if (!BRAND || !FEED) { console.error("--brand and --feed required"); process.exit(1); }

const feed = JSON.parse(fs.readFileSync(FEED, "utf8"));
const byHandle = {};
feed.forEach((p) => (byHandle[p.handle] = p));

function primarySpec(name) {
  let m = name.match(/\b(\d+)\s*P\b/i); if (m) return { kind: "capacity", val: m[1] };
  m = name.match(/(-?\d+)\s*°/); if (m) return { kind: "temp", val: m[1] };
  m = name.match(/\b(\d+)\s*L\b/); if (m) return { kind: "volume", val: m[1] };
  return null;
}

function variantMatches(title, spec) {
  const t = String(title);
  if (spec.kind === "capacity")
    return new RegExp(`(^|[^0-9])${spec.val}\\s*-?\\s*(P\\b|Person)`, "i").test(t);
  if (spec.kind === "temp") // "15℉ / Regular", "15°F", dual-rated "10/20℉"
    return new RegExp(`(^|[^0-9-])${spec.val.replace("-", "\\-")}\\s*(℉|°\\s*F|F\\b|°|/\\d+\\s*(℉|°|F))`).test(t);
  if (spec.kind === "volume")
    return new RegExp(`(^|[^0-9])${spec.val}\\s*(L\\b|Liter)`, "i").test(t);
  return false;
}

const stripQ = (u) => String(u).split("?")[0];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const items = await CatalogItem.find({ brandLC: BRAND, isActive: { $ne: false } }).select("name imageUrls").lean();
  const offers = await MerchantOffer.find({ productId: { $in: items.map((i) => i._id) }, network: "direct" }).lean();
  const linkByProd = {};
  offers.forEach((o) => { if (!linkByProd[o.productId]) linkByProd[o.productId] = o.deepLink; });

  let fixed = 0, skipped = [];
  for (const it of items) {
    const link = linkByProd[it._id] || "";
    const handle = (link.match(/\/products\/([a-z0-9-]+)/) || [])[1];
    const prod = handle && byHandle[handle];
    if (!prod) { skipped.push(`${it.name} — no feed product (handle ${handle || "?"})`); continue; }

    if (process.argv.includes("--by-handle")) {
      const urls = (prod.images || []).map((im) => im.src).slice(0, 8);
      if (!urls.length) { skipped.push(`${it.name} — feed product has no images`); continue; }
      const cur0 = stripQ((it.imageUrls || [])[0] || "");
      if (cur0 === stripQ(urls[0])) continue;
      console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ${it.name} img0 ${cur0.split("/").pop()} -> ${stripQ(urls[0]).split("/").pop()} (${urls.length} imgs) [${handle}]`);
      fixed++;
      if (COMMIT) await CatalogItem.collection.updateOne({ _id: it._id }, { $set: { imageUrls: urls } });
      continue;
    }

    const spec = primarySpec(it.name);
    if (!spec) { skipped.push(`${it.name} — no primary spec in name`); continue; }

    let vars = prod.variants.filter((v) => variantMatches(v.title, spec));
    const reg = vars.filter((v) => /regular/i.test(v.title));
    if (reg.length) vars = [...reg, ...vars.filter((v) => !reg.includes(v))];
    if (!vars.length) { skipped.push(`${it.name} — no variant matches ${spec.kind}:${spec.val} in ${prod.handle}`); continue; }
    const varIds = new Set(vars.map((v) => v.id));
    const otherVarIds = new Set(prod.variants.filter((v) => !varIds.has(v.id)).map((v) => v.id));

    // featured image for the matched variant(s)
    let featured = null;
    for (const v of vars) if (v.featured_image && v.featured_image.src) { featured = v.featured_image.src; break; }
    if (!featured) {
      const img = (prod.images || []).find((im) => (im.variant_ids || []).some((id) => varIds.has(id)));
      if (img) featured = img.src;
    }
    if (!featured) { skipped.push(`${it.name} — no per-variant image in ${prod.handle}`); continue; }

    const generic = (prod.images || [])
      .filter((im) => !(im.variant_ids || []).length || (im.variant_ids || []).some((id) => varIds.has(id)))
      .map((im) => im.src);
    const urls = [featured, ...generic].filter((u, i, a) => a.findIndex((x) => stripQ(x) === stripQ(u)) === i).slice(0, 8);

    const cur0 = stripQ((it.imageUrls || [])[0] || "");
    if (cur0 === stripQ(featured) && (it.imageUrls || []).length >= Math.min(urls.length, 2)) continue; // already correct
    console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ${it.name} (${spec.kind}:${spec.val}) img0 ${cur0.split("/").pop()} -> ${stripQ(featured).split("/").pop()} (${urls.length} imgs)`);
    fixed++;
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: it._id }, { $set: { imageUrls: urls } });
  }
  console.log(`\n${fixed} to fix; ${skipped.length} skipped:`);
  skipped.forEach((s) => console.log("  SKIP", s));
  await mongoose.disconnect();
})();
