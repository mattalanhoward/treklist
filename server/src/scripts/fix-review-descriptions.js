/**
 * fix-review-descriptions.js — description hygiene from the 2026-07-10 review:
 * (a) TOAKS/GramXpert: strip <style>/<script> CONTENT (46+1 descriptions were raw CSS)
 *     and re-set from the live feed;
 * (b) Nitecore/Flextail/TOAKS: re-set 1000-char mid-word truncations from the feed at a
 *     word boundary with the current 2000-char standard;
 * (c) GGG-sourced 600-char truncations (Cumulus/SMD/EE/Tarptent/WM/Alpenglow…): re-set from
 *     the GGG feed the same way;
 * (d) entity-decode remaining descriptions containing &amp;/&#39;-style entities.
 * Only touches `description`. updateOne only.
 *
 *   node src/scripts/fix-review-descriptions.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" };
const DECODE = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#8217;": "’", "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&#8212;": "—", "&nbsp;": " ", "&reg;": "®", "&trade;": "™", "&deg;": "°" };
const decodeEnts = (s) => s.replace(/&#?\w+;/g, (m) => DECODE[m] ?? (m.match(/^&#(\d+);$/) ? String.fromCharCode(+m.slice(2, -1)) : " "));
// strip that REMOVES style/script content (the create-script strip() kept it)
const strip = (s) =>
  decodeEnts(
    (s || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
const cutWord = (s, cap) => {
  if (s.length <= cap) return s;
  const cut = s.slice(0, cap);
  const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (i > cap * 0.6) return cut.slice(0, i + 1);
  const j = cut.lastIndexOf(" ");
  return (j > 0 ? cut.slice(0, j) : cut).trim() + "…";
};

async function fetchShopify(base, maxp) {
  const out = [];
  for (let p = 1; p <= maxp; p++) {
    let j = null;
    for (let t = 0; t < 3 && !j; t++) { try { const r = await fetch(`${base}&page=${p}`, { headers: UA }); if (r.ok) j = await r.json(); } catch (e) {} }
    if (!j || !j.products || !j.products.length) break;
    out.push(...j.products);
  }
  return out;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  // ---- (a)+(b): feed-based re-set for TOAKS / Nitecore / Flextail / GramXpert
  const FEEDS = [
    ["TOAKS", await fetchShopify("https://www.toaksoutdoor.com/products.json?limit=250", 2), "shopify"],
    ["Nitecore", await fetchShopify("https://www.nitecorestore.com/products.json?limit=250", 7), "shopify"],
    ["Flextail", await fetchShopify("https://www.flextail.com/products.json?limit=250", 2), "shopify"],
  ];
  let gx = [];
  try { gx = await (await fetch("https://www.gramxpert.eu/wp-json/wc/store/v1/products?per_page=100", { headers: UA })).json(); } catch (e) {}
  FEEDS.push(["GramXpert", gx, "woo"]);

  for (const [brand, feed, kind] of FEEDS) {
    const byHandle = {};
    for (const p of feed) {
      const h = kind === "woo" ? (p.permalink || "").replace(/\/$/, "").split("/").pop() : p.handle;
      byHandle[h] = kind === "woo" ? (p.short_description || p.description) : p.body_html;
    }
    const items = await C.find({ brand, isActive: true }).select("name description").lean();
    let reset = 0;
    for (const it of items) {
      const offer = await O.findOne({ productId: it._id, network: "direct" }).select("deepLink").lean();
      const h = offer && offer.deepLink.replace(/\/$/, "").split("/").pop();
      const body = h && byHandle[h];
      if (!body) continue;
      const nd = cutWord(strip(body), 2000);
      if (!nd || nd === it.description) continue;
      const wasCss = /\{[^}]{3,60}:[^}]{2,60}\}/.test(it.description || "");
      const wasTrunc = (it.description || "").length === 1000 || (it.description || "").length === 1200;
      if (!wasCss && !wasTrunc && (it.description || "").length >= Math.min(nd.length, 400)) continue; // only fix broken/short ones
      reset++;
      if (reset <= 4) console.log(`  ${brand}: ${it.name.slice(0, 40)} (${wasCss ? "CSS" : wasTrunc ? "truncated" : "short"}) -> ${nd.length} chars: "${nd.slice(0, 70)}…"`);
      if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: nd } });
    }
    console.log(`${brand}: re-set ${reset} descriptions\n`);
  }

  // ---- (c): GGG-sourced 600-char truncations
  const ggg = await fetchShopify("https://www.garagegrowngear.com/products.json?limit=250", 6);
  const gggByHandle = {};
  ggg.forEach((p) => (gggByHandle[p.handle] = p.body_html));
  const trunc600 = await C.find({ isActive: true, $expr: { $eq: [{ $strLenCP: { $ifNull: ["$description", ""] } }, 600] } }).select("name brand description").lean();
  console.log(`600-char truncated: ${trunc600.length}`);
  let fixed600 = 0;
  for (const it of trunc600) {
    const offer = await O.findOne({ productId: it._id, deepLink: /garagegrowngear\.com/ }).select("deepLink").lean();
    const h = offer && offer.deepLink.replace(/\/$/, "").split("/").pop();
    const body = h && gggByHandle[h];
    if (!body) { console.log(`  (no GGG source: ${it.brand}: ${it.name.slice(0, 40)} — word-trim only)`); const nd = cutWord(it.description, 598); if (COMMIT && nd !== it.description) await C.collection.updateOne({ _id: it._id }, { $set: { description: nd } }); continue; }
    const nd = cutWord(strip(body), 2000);
    if (nd.length > 600) {
      fixed600++;
      if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: nd } });
    }
  }
  console.log(`GGG re-set: ${fixed600}\n`);

  // ---- (d): entity decode anything left
  const ents = await C.find({ isActive: true, description: /&#?\w+;/ }).select("name brand description").lean();
  let dec = 0;
  for (const it of ents) {
    const nd = decodeEnts(it.description).replace(/\s+/g, " ").trim();
    if (nd !== it.description) {
      dec++;
      if (dec <= 5) console.log(`  entities: ${it.brand}: ${it.name.slice(0, 44)}`);
      if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: nd } });
    }
  }
  console.log(`entity-decoded: ${dec}`);

  // ---- word-boundary trim for remaining exact-cap truncations (1000/1200/2000) without a feed source
  for (const cap of [1000, 1200, 2000]) {
    const t = await C.find({ isActive: true, $expr: { $eq: [{ $strLenCP: { $ifNull: ["$description", ""] } }, cap] } }).select("name brand description").lean();
    let trimmed = 0;
    for (const it of t) {
      const nd = cutWord(it.description, cap - 2);
      if (nd !== it.description) { trimmed++; if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: nd } }); }
    }
    if (t.length) console.log(`cap ${cap}: word-trimmed ${trimmed} of ${t.length}`);
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
