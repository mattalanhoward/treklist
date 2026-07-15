/**
 * fix-smartwool-socks.js — rebuild the Smartwool sock lineup (2026-07-10 review §2.5).
 * The import-time collapse keyed on cushion words most titles don't carry, so 35 hike-crew
 * products merged into one item represented by a 3-Pack, gender hashed to W via tags, and
 * the actual models (e.g. Hike Light Cushion Crew) have no item.
 * Rebuild: ARCHIVE all current active Smartwool Hiking Socks, then import the CANONICAL
 * models from the live feed = titles that name a cushion level (zero/light/medium/full/
 * extra/maximum/targeted) or are liner/compression models; gender from the TITLE PREFIX
 * only; dedupe (gender|line|cushion|cut|intraknit) keeping the shortest (print-free) title;
 * kids/lifestyle dropped. Weightless + Size axis, like all Smartwool apparel.
 *
 *   node src/scripts/fix-smartwool-socks.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.smartwool.com/en-us/products.json?limit=250";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" };
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

const DROP = /everyday|cozy|lounge|cable|no\s?show|lifestyle|dress|barsleeve|sleeve|kids|junior|toddler|gift box|pack\b/i;
const CUSHION_RE = /(zero|light|medium|full|extra|maximum|targeted)[\s-]*cushion/i;
const genderOf = (t) => (/^women/i.test(t) ? "Womens" : /^men/i.test(t) ? "Mens" : "Unisex");
const tc = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
// cushion level from the title, else from the body prose ("…our Hike Light Cushion … Socks" /
// "light cushioning along the bottom")
function cushionOf(title, body) {
  const m = title.match(CUSHION_RE) || (body || "").match(CUSHION_RE);
  return m ? m[1].toLowerCase() : "";
}
function partsOf(p) {
  const t = p.title.toLowerCase();
  const body = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const line = (t.match(/trail run|run|hike|trek|ski|mountaineer|snowboard|performance|athletic|bike|cycl/) || [""])[0];
  const liner = /\bliner\b/.test(t) ? "liner" : "";
  const cushion = liner ? "" : cushionOf(p.title, body); // liners are inherently zero-cushion
  let cut = (t.match(/no.?show|micro|mini|low ankle|tall crew|mid crew|crew|knee|over the calf|otc|maxi|quarter|ankle|\blow\b/) || [""])[0];
  if (cut === "otc") cut = "over the calf";
  const compression = /compression/.test(t) ? "compression" : "";
  const ik = /intraknit/.test(t) ? "ik" : "";
  const ce = /classic edition/.test(t) ? "ce" : "";
  const sc = /second cut/.test(t) ? "sc" : "";
  // Smartwool convention: women's socks carry the "Women's" prefix; unprefixed sock
  // products sit under Men's on smartwool.com
  const gender = /^women/i.test(p.title) ? "Womens" : "Mens";
  return { gender, line, cushion, cut, liner, compression, ik, ce, sc };
}
const modelKey = (k) => [k.gender, k.line, k.cushion, k.cut, k.liner, k.compression, k.ik, k.ce, k.sc].join("|");
// canonical display name built from the model parts (Smartwool's own naming convention)
function canonicalName(k) {
  const bits = [];
  if (k.gender === "Womens") bits.push("Women's"); // men's stay unprefixed, matching the site's product names
  if (k.ik) bits.push("Intraknit™");
  bits.push(tc(k.line === "cycl" ? "cycling" : k.line));
  if (k.ce) bits.push("Classic Edition");
  if (k.sc) bits.push("Second Cut™");
  if (k.cushion) bits.push(tc(k.cushion) + " Cushion");
  if (k.liner) bits.push("Liner");
  if (k.compression) bits.push("Compression");
  if (k.cut && k.cut !== "liner") bits.push(tc(k.cut === "otc" ? "over the calf" : k.cut));
  bits.push("Socks");
  return bits.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchAll() {
  const out = [];
  for (let p = 1; p <= 6; p++) {
    let j = null;
    for (let t = 0; t < 3 && !j; t++) { try { const r = await fetch(`${FEED}&page=${p}`, { headers: UA }); if (r.ok) j = await r.json(); } catch (e) {} }
    if (!j || !j.products || !j.products.length) break;
    out.push(...j.products);
  }
  return out;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const GlobalItem = require("../models/globalItem");
  const GearItem = require("../models/gearItem");

  // 1. archive current sock set
  const cur = await C.find({ brand: "Smartwool", itemType: "Hiking Socks", isActive: true }).select("name").lean();
  console.log(`== archiving current ${cur.length} Smartwool sock items ==`);
  for (const it of cur) {
    const refs = (await GlobalItem.countDocuments({ productId: it._id })) + (await GearItem.countDocuments({ productId: it._id }));
    console.log(`  archive: ${it.name}${refs ? `  (${refs} refs — snapshot keeps working)` : ""}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { isActive: false } });
  }

  // 2. canonical models from the feed (cushion read from title OR body prose)
  const products = await fetchAll();
  const socks = products.filter((p) => /sock/i.test(p.product_type || "") && !DROP.test(p.title));
  const groups = {};
  for (const p of socks) {
    const parts = partsOf(p);
    if (!parts.line || !parts.cut) continue; // unclassifiable stragglers
    if (!parts.cushion && !parts.liner && !parts.compression) continue; // no model signal at all
    const key = modelKey(parts);
    (groups[key] = groups[key] || { parts, items: [] }).items.push(p);
  }

  console.log(`\n== importing ${Object.keys(groups).length} canonical models (from ${socks.length} feed socks) ==`);
  let created = 0;
  for (const [k, g] of Object.entries(groups).sort()) {
    const v = g.items;
    v.sort((a, b) => a.title.length - b.title.length); // shortest = least print-decorated
    const p = v[0];
    const name = canonicalName(g.parts);
    const gender = g.parts.gender;
    console.log(`  [x${String(v.length).padStart(2)}] "${name}"   (src: ${p.title.slice(0, 44)})`);
    if (!COMMIT) { created++; continue; }
    if (await C.findOne({ name, brand: "Smartwool", isActive: true }).select("_id").lean()) continue;
    const { category, subcategory } = categoryForItemType("Hiking Socks", gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : "");
    const images = (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 6);
    if (!images.length) continue;
    const sizeOpt = (p.options || []).find((o) => /size/i.test(o.name));
    let variantAxes, variants, defaultVariantKey;
    if (sizeOpt && sizeOpt.values.length > 1) {
      variantAxes = [{ name: "Size", values: sizeOpt.values }];
      variants = sizeOpt.values.map((s) => ({ key: s, options: { Size: s } }));
      defaultVariantKey = sizeOpt.values[0];
    }
    const doc = new C({
      name, brand: "Smartwool", itemType: "Hiking Socks",
      ...(category ? { category, subcategory } : {}),
      description: strip(p.body_html).slice(0, 1200),
      imageUrls: images, createdBy: ADMIN_ID, isActive: true,
      ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
      attributes: { gender, material: "Merino Wool" },
    });
    doc.$locals.lenientAttributes = true;
    try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
    await O.create({ network: "direct", region: "global", merchantId: "direct-smartwool", merchantName: "Smartwool", productId: doc._id, deepLink: `https://www.smartwool.com/en-us/p/${p.handle}`, priority: 0 });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} models`);
  await mongoose.disconnect();
})();
