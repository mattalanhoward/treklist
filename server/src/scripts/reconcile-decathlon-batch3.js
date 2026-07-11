/**
 * reconcile-decathlon-batch3.js — reconcile the batch-3 store-photo specs (footwear,
 * jackets, pants, merino base layers, new tents) against the existing catalog.
 *
 * Context: the earlier bulk Awin ingest already created most Decathlon house-brand models
 * (often WEIGHTLESS, under messy feed names) with offers keyed on aw_product_id — so an
 * article-code check can't see them. This script matches store entries to existing items by
 * a brand+gender+model SIGNATURE, then:
 *   - BACKFILL: existing item is weightless (or clearly wrong) -> set the store weight
 *     (footwear DOUBLED to pair per the 2026-07-10 decision, with a disclosure line).
 *   - CREATE: no existing match + a live feed row -> create it (weight where the board had one).
 *   - REVIEW: ambiguous signature (0 or >1 candidates) -> reported, never auto-written.
 * House brands only (Quechua/Forclaz/Simond); third-party resold shoes/tents skipped.
 *
 *   node src/scripts/reconcile-decathlon-batch3.js [--commit] [--csv <path>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const zlib = require("zlib");
const fs = require("fs");
const { categoryForItemType } = require("../config/inferItemType");
const STORE = require("./decathlon-store-specs.json");
const COMMIT = process.argv.includes("--commit");
const CSV_ARG = (() => { const i = process.argv.indexOf("--csv"); return i > -1 ? process.argv[i + 1] : null; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";

const SECTIONS = ["trekkingBootsWomens", "lightHikingShoesWomens", "walkingShoesWomens", "walkingShoesMens",
  "mountainHikingShoesWomens_noWeightBoard", "mountainHikingShoesMens_noWeightBoard",
  "rainJacketsWomens", "rainJacketsMens", "baseLayerTeesSimond_noWeightBoard",
  "pantsMens", "convertiblePantsMens", "tents"];
const FOOTWEAR = new Set(["Hiking Boots", "Hiking Shoes"]);
const HOUSE = /^(Quechua|Forclaz|Simond)$/i;
// bad store SKUs whose feed row is the wrong product (verified in dry-run)
const EXCLUDE_SKU = new Set(["8931365"]); // "NH500 Low (Men's)" board code -> feed "Adult Football Boots"
// explicit weight-bug corrections (existing item, matched by name regex within brand) —
// for cases the weightless-only backfill guard skips.
const WEIGHT_FIX = [{ brand: "Simond", re: /Ultralight Tunnel Tent MT900/i, grams: 1650, was: 165 }];

// ---------- signature ----------
function familyToken(s) {
  const n = s.toLowerCase();
  let m = n.match(/\b(mt|mh|nh)\s*-?\s*(\d{2,4})/); if (m) return m[1] + m[2];
  if (/arpenaz\s*(revival|500)?/.test(n) && /revival/.test(n)) return "arpenazrevival";
  if (/makalu\s*t?3|makalu.*iii/.test(n)) return "makalut3";
  if (/makalu\s*t?2|makalu.*ii\b/.test(n)) return "makalut2";
  if (/makalu\s*(assault|i\b)/.test(n)) return "makaluassault";
  return null;
}
function cutOf(n) {
  const s = n.toLowerCase();
  if (/\bhigh(-|\s)?rise\b|\bhigh\b/.test(s)) return "high";
  if (/\bmid(-|\s)?rise\b|\bmid\b/.test(s)) return "mid";
  if (/\blow(-|\s)?rise\b|\blow(-|\s)?cut\b|\blow\b|faster|fresh|revival|light\b/.test(s)) return "low";
  return null; // "boots" w/o qualifier resolved by caller (default mid)
}
function tentSig(n) {
  const s = n.toLowerCase();
  const cap = (s.match(/(\d)\s*-?\s*(person|persoons|p\b)/) || s.match(/\b(one|two|three|four)-person/))?.[1];
  const capNum = { one: 1, two: 2, three: 3, four: 4 }[cap] || cap;
  let type = /tunnel/.test(s) ? "tunnel" : /tarp/.test(s) ? "tarp" : /mesh/.test(s) ? "mesh" : /makalu/.test(s) ? "makalu" : "dome";
  let fam = /mt900|makalu/.test(s) ? (/makalu/.test(s) ? "makalu" : "mt900") : /mt500/.test(s) ? "mt500" : "?";
  const ul = /\bul\b|ultralight|ultra-?light/.test(s) ? "ul" : "";
  return `${fam}|${type}|${capNum}|${ul}`;
}
// discriminator for model variants that share a family code (MH500 vs MH500 Light,
// NH500 Fresh vs Leather) — critical so we don't collapse distinct products.
function variantToken(name) {
  const s = name.toLowerCase();
  const t = [];
  if (/\blight\b/.test(s)) t.push("light");
  if (/faster/.test(s)) t.push("faster");
  if (/\bfresh\b/.test(s)) t.push("fresh");
  if (/revival/.test(s)) t.push("revival");
  if (/mesh/.test(s)) t.push("mesh");
  return t.sort().join("+");
}
function sig(name, itemType, gender) {
  const g = gender || "u";
  if (itemType === "Backpacking Tent" || itemType === "Tarp Shelter") return "tent|" + tentSig(name);
  if (FOOTWEAR.has(itemType)) {
    const fam = familyToken(name); if (!fam) return null;
    // NOTE: cut (low/mid/high) is intentionally NOT in the footwear key — Decathlon's
    // stored names are inconsistent about it, so collapsing by family lets a single
    // existing height match cleanly, while two heights safely fall to "ambiguous review".
    const leather = /leather|leer/i.test(name) ? "L" : "";
    const wp = /\bwp\b|waterproof|wtp/i.test(name) ? "W" : "";
    return `shoe|${g}|${fam}|${leather}${wp}|${variantToken(name)}`;
  }
  // jackets / pants / baselayers: family + gender + itemType + variant
  const fam = familyToken(name) || (name.match(/alpinism|alpi|ice|windshell|merino (fresh|resist|seamless)|100% merino/i) || [])[0] || "?";
  return `${itemType}|${g}|${String(fam).toLowerCase().replace(/\s+/g, "")}|${variantToken(name)}`;
}
const gTok = (x) => (x === "Womens" ? "w" : x === "Mens" ? "m" : "u");

// ---------- feed ----------
const Q = String.fromCharCode(34);
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const idx = Object.fromEntries(lines[0].split(",").map((h, i) => [h, i]));
  const parse = (line) => { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === Q) { if (line[i + 1] === Q) { c += Q; i++; } else q = false; } else c += ch; } else { if (ch === Q) q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } } o.push(c); return o; };
  return { rows: lines.slice(1).map(parse), idx };
}
const clean = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
function stripColour(name, colour) {
  let n = name.replace(/^second life\s*[-–]\s*/i, "");
  for (const c of String(colour || "").split(/[\/,]/).map((x) => x.trim()).filter(Boolean)) n = n.replace(new RegExp("\\s*[-–]?\\s*" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i"), "");
  return n.replace(/\s*[-–]\s*$/, "").trim() || name;
}
function images(r, idx) {
  return [r[idx.merchant_image_url], r[idx.aw_image_url], r[idx.alternate_image], r[idx.alternate_image_two], r[idx.alternate_image_three]].filter((u) => u && /^https?:/.test(u)).filter((u, i, a) => a.indexOf(u) === i).slice(0, 6);
}
async function loadFeed() {
  let text;
  if (CSV_ARG && fs.existsSync(CSV_ARG)) text = fs.readFileSync(CSV_ARG, "utf8");
  else { const res = await fetch(process.env.AWIN_DECATHLON_FEED_URL); text = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"); }
  const { rows, idx } = parseCsv(text);
  const PROMO = /sale|new collection|second life|sportswear accessories|festival|clearance|outlet/i;
  const byCode = {};
  for (const r of rows) {
    const code = (r[idx.merchant_product_id] || "").split("-")[0];
    if (!/^\d{6,8}$/.test(code)) continue;
    const mc = r[idx.merchant_category] || "";
    const score = (r[idx.in_stock] === "1" ? 2 : 0) + (PROMO.test(mc) ? 0 : 1);
    if (!byCode[code] || score > byCode[code]._score) { r._score = score; byCode[code] = r; }
  }
  return { byCode, idx };
}

(async () => {
  const { byCode, idx } = await loadFeed();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  // index existing house-brand items by signature
  const relTypes = ["Hiking Boots", "Hiking Shoes", "Rain Jacket", "Softshell Jacket", "Hiking Pants", "Convertible Pants",
    "Hiking Shirt", "Base Layer Top", "Backpacking Tent", "Tarp Shelter"];
  const existing = await C.find({ brand: { $in: ["Quechua", "Forclaz", "Simond"] }, isActive: true, itemType: { $in: relTypes } }).select("name brand itemType weightGrams attributes description").lean();
  const catByType = {};
  for (const e of await C.find({ isActive: true }).select("itemType category subcategory").lean()) if (!catByType[e.itemType] && e.category) catByType[e.itemType] = { category: e.category, subcategory: e.subcategory };
  const index = {};
  for (const e of existing) {
    const g = (e.attributes || {}).gender;
    const s = sig(e.name, FOOTWEAR.has(e.itemType) ? e.itemType : e.itemType, gTok(g));
    if (!s) continue;
    (index[s] = index[s] || []).push(e);
  }

  const backfill = [], creates = [], review = [], skip = [];
  for (const sec of SECTIONS) {
    if (!STORE[sec]) continue;
    for (const it of STORE[sec]) {
      if (it.thirdParty || !HOUSE.test(it.brand)) continue;
      const skus = it.skus || (it.sku ? [it.sku] : []);
      const g = (it.specs && it.specs.gender) || (it.itemType === "Backpacking Tent" || it.itemType === "Tarp Shelter" ? null : "Unisex");
      const s = sig(`${it.model}`, it.itemType, gTok(g));
      const cands = (index[s] || []);
      // store weight -> stored value (footwear x2)
      const storeW = it.weightGrams != null ? (FOOTWEAR.has(it.itemType) ? it.weightGrams * 2 : it.weightGrams) : null;

      if (cands.length === 1) {
        const e = cands[0];
        const cur = e.weightGrams;
        // SAFE backfill only: fill a weightless item. Never re-weight an item that already
        // has a value on a fuzzy match (cut/variant ambiguity) — those go to review.
        if (storeW != null && cur == null) backfill.push({ e, it, storeW, sig: s });
        else if (storeW != null && Math.abs(cur - storeW) / storeW > 0.05) review.push(`REWEIGHT?  "${e.name.slice(0, 40)}" ${cur} vs store ${storeW} [${it.model}]`);
        else skip.push(`${it.model} == "${e.name.slice(0, 40)}" (${cur ?? "-"}g ok)`);
      } else if (cands.length === 0) {
        const code = skus.find((x) => byCode[x] && !EXCLUDE_SKU.has(x));
        if (!code) { review.push(`NO-FEED-NO-MATCH  ${it.brand} ${it.model} [${skus.join(",")}]`); continue; }
        creates.push({ it, code, fr: byCode[code], storeW, sig: s });
      } else {
        review.push(`AMBIGUOUS(${cands.length})  ${it.brand} ${it.model} [sig ${s}] -> ${cands.map((c) => '"' + c.name.slice(0, 30) + '"').join(" | ")}`);
      }
    }
  }

  const PAIR = "\n\nListed weight is per pair.";
  console.log(`\n===== BACKFILL WEIGHTS (${backfill.length}) =====`);
  for (const b of backfill) {
    console.log(`  ${b.e.brand} ${b.e.itemType.padEnd(13)} "${b.e.name.slice(0, 46)}"  ${b.e.weightGrams ?? "-"} -> ${b.storeW}g   [store ${b.it.model}]`);
    if (COMMIT) {
      const set = { weightGrams: b.storeW };
      if (FOOTWEAR.has(b.e.itemType) && !/per pair/i.test(b.e.description || "")) set.description = ((b.e.description || "") + PAIR).trim();
      await C.collection.updateOne({ _id: b.e._id }, { $set: set });
    }
  }

  console.log(`\n===== WEIGHT-BUG FIXES (${WEIGHT_FIX.length}) =====`);
  for (const w of WEIGHT_FIX) {
    const e = await C.findOne({ brand: w.brand, name: w.re, isActive: true }).select("name weightGrams").lean();
    if (!e) { console.log(`  !! not found: ${w.brand} ${w.re}`); continue; }
    console.log(`  ${e.name.slice(0, 50)}  ${e.weightGrams} -> ${w.grams}g`);
    if (COMMIT) await C.collection.updateOne({ _id: e._id }, { $set: { weightGrams: w.grams } });
  }

  console.log(`\n===== CREATE NEW (${creates.length}) =====`);
  let created = 0;
  for (const c of creates) {
    const fr = c.fr, it = c.it;
    const brand = fr[idx.brand_name] && HOUSE.test(fr[idx.brand_name]) ? fr[idx.brand_name].replace(/^(\w)(\w+)/, (_, a, b) => a + b.toLowerCase()) : it.brand;
    if (!HOUSE.test(brand)) { review.push(`FEED-BRAND-OFF  ${it.model} -> feed brand "${fr[idx.brand_name]}"`); continue; }
    const name = stripColour(clean(fr[idx.product_name]) || `${brand} ${it.model}`, fr[idx.colour]);
    const dupName = await C.findOne({ name, brand: new RegExp("^" + brand + "$", "i"), isActive: true }).select("_id").lean();
    if (dupName) { skip.push(`create->dupname "${name}"`); continue; }
    const itemType = it.itemType === "Tarp" ? "Tarp Shelter" : it.itemType;
    const gender = (it.specs && it.specs.gender) || "Unisex";
    const cc = catByType[itemType] || categoryForItemType(itemType, gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : "");
    const imgs = images(fr, idx);
    const attributes = {};
    if (gender !== "Unisex" && ["Hiking Boots", "Hiking Shoes", "Rain Jacket", "Hiking Pants", "Convertible Pants", "Hiking Shirt", "Base Layer Top", "Softshell Jacket"].includes(itemType)) attributes.gender = gender;
    const sp = it.specs || {};
    if (sp.material) attributes.material = /merino/i.test(sp.material) ? "Merino Wool" : sp.material;
    if (itemType === "Backpacking Tent" && sp.capacity) attributes.capacity = sp.capacity;
    let description = clean(fr[idx.description]) || `Decathlon ${brand} ${it.model}.`;
    description = description.slice(0, 1500);
    if (FOOTWEAR.has(itemType) && c.storeW != null) description += PAIR;
    console.log(`  ${created + 1}. ${brand.padEnd(8)} [${itemType}] ${String(c.storeW ?? "-").padStart(5)}g  "${name.slice(0, 50)}"  imgs:${imgs.length}`);
    if (COMMIT) {
      if (!imgs.length) { console.log("     !! no image — skip"); continue; }
      const doc = new C({ name, brand, itemType, ...(cc.category ? { category: cc.category, subcategory: cc.subcategory } : {}), description, imageUrls: imgs, createdBy: ADMIN_ID, isActive: true, ...(c.storeW != null ? { weightGrams: c.storeW } : {}), attributes });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`     !! ${name}: ${e.message}`); continue; }
      await O.create({ network: "awin", region: "global", merchantId: "awin-decathlon-uk", merchantName: "Decathlon UK", externalProductId: c.code, productId: doc._id, deepLink: fr[idx.aw_deep_link], priority: 0 });
      created++;
    } else created++;
  }

  console.log(`\n===== REVIEW / SKIPPED-AMBIGUOUS (${review.length}) =====`);
  review.forEach((r) => console.log("  " + r));
  console.log(`\n===== ALREADY-OK SKIPS (${skip.length}) =====`);
  skip.slice(0, 40).forEach((r) => console.log("  " + r));

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: backfill ${backfill.length}, create ${creates.length}, review ${review.length}`);
  await mongoose.disconnect();
})();
