/**
 * import-exped.js — full Exped catalog (exped.com/en). Custom Nuxt/Drupal SSR site,
 * NO open feed → scrape sitemap (/en/products/<category>/<slug>) + parse each page's
 * rendered spec table for the real weight, JSON-LD for description, rokka.io CDN for
 * images. itemType from the URL category (+name refinements). Direct Exped offers.
 *
 * User (2026-07-02): "add everything" EXCEPT a few straps + ropes/cords (and obvious
 * parts). Wanted: pumps, mats, bags, backpacks, tents, pillows, booties, storage,
 * hammocks, tarps, bivybags, ponchos. → EXCLUDE regex below.
 *
 * ⚠ WEIGHT-TRUST: packs use "Min. Weight" (trail wt), others the "Weight" field, read
 * from the rendered spec table (kg→g). No weight found → blank. Attributes left empty
 * (bulk import); specs live in the marketing description. Enrich later if wanted.
 *
 *   node src/scripts/import-exped.js [--limit N] [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i >= 0 ? +process.argv[i + 1] : Infinity; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// user excludes: straps, ropes/cords/lines, and non-gear parts
const EXCLUDE = /strap|carabiner|tool-blade|helmet-holder|repair-kit|valve-adapter|coupler-kit|chair-kit|snapshot|tent-cord|slit-line|flash-pack-pocket|hip-pads/i;

const T = (itemType, category, subcategory) => ({ itemType, category, subcategory });
function classify(cat, slug) {
  const s = slug.toLowerCase();
  if (/pump/.test(s)) return T("Other", "Sleep System", "Sleeping Pad Accessories");
  switch (cat) {
    case "backpacks": return /pouch/.test(s) ? T("Hip Pack", "Backpacks & Bags", "Day Packs & Accessories") : T("Backpack", "Backpacks & Bags", "Backpacking Packs");
    case "sleeping-mats":
      if (/schnozzel/.test(s)) return T("Other", "Sleep System", "Sleeping Pad Accessories");
      if (/evazote|multimat|doublemat|sit-pad|flex-sit/.test(s)) return T("Foam Sleeping Pad", "Sleep System", "Sleeping Pads");
      return T("Inflatable Sleeping Pad", "Sleep System", "Sleeping Pads");
    case "sleeping-bags":
      if (/quilt|blanket/.test(s)) return T("Quilt", "Sleep System", "Quilts");
      if (/liner/.test(s)) return T("Sleeping Bag Liner", "Sleep System", "Sleeping Bag Liners");
      return T("Sleeping Bag", "Sleep System", "Sleeping Bags");
    case "tents-and-tarps":
      if (/footprint/.test(s)) return T("Ground Sheet", "Shelter", "Ground Sheet");
      if (/peg|anchor|pole/.test(s)) return T("Tent Stakes", "Shelter", "Tent Stakes");
      if (/tarp/.test(s)) return T("Tarp Shelter", "Shelter", "Backpacking Tarps");
      return T("Backpacking Tent", "Shelter", "Tents");
    case "tarps": return T("Tarp Shelter", "Shelter", "Backpacking Tarps");
    case "storage": return T("Dry Bag / Stuff Sack", "Accessories & Tools", "Dry Bags");
    case "pillows": return T("Pillow", "Sleep System", "Pillows");
    case "bivybags": return T("Other", "Shelter", null);
    case "ponchos": return T("Rain Poncho", "Unisex Clothing", "Rain Gear");
    case "hammocks": return T("Other", "Shelter", null);
    case "booties": return T("Other", "Footwear", "Unisex Footwear");
    case "gear-bags": return T("Hip Pack", "Backpacks & Bags", "Day Packs & Accessories");
    case "accessories":
      if (/footprint/.test(s)) return T("Ground Sheet", "Shelter", "Ground Sheet");
      if (/peg|anchor|pole/.test(s)) return T("Tent Stakes", "Shelter", "Tent Stakes");
      if (/sit-pad|air-seat/.test(s)) return T("Foam Sleeping Pad", "Sleep System", "Sleeping Pads");
      if (/vbl-socks/.test(s)) return T("Hiking Socks", "Unisex Clothing", "Socks");
      if (/linerbag|liner/.test(s)) return T("Sleeping Bag Liner", "Sleep System", "Sleeping Bag Liners");
      if (/carry-all|case|pouch/.test(s)) return T("Dry Bag / Stuff Sack", "Accessories & Tools", "Dry Bags");
      return T("Other", "Sleep System", "Sleeping Pad Accessories"); // mat covers/sheets/rain-cover etc
  }
  return T("Other", null, null);
}

function parse(html, cat) {
  const deent = (x) => x.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
  const title = deent(((html.match(/<title>([^<]+)/) || [])[1] || "").split("|")[0].trim());
  const parts = title.split(" - ");
  const name = (parts.length > 1 ? parts.slice(0, -1).join(" - ") : parts[0]).trim();
  const txt = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const toG = (v, u) => Math.round(parseFloat(v.replace(/,/g, "")) * (/kg/i.test(u) ? 1000 : 1));
  // an optional size token can precede the value: "1 l:", "S/M:", "DUO M:", "S", "" → then N g/kg
  const SZ = "(?:[A-Za-z0-9/.() ]{1,12}?[:\\s])?\\s*";
  const minW = txt.match(new RegExp(`Min\\.?\\s*Weight\\b\\s*${SZ}([\\d.,]+)\\s*(kg|g)\\b`, "i"));
  const genW = txt.match(new RegExp(`(?<!Min\\.\\s)(?<!Max\\.\\s)Weight\\b\\s*${SZ}([\\d.,]+)\\s*(kg|g)\\b`, "i"));
  const w = (cat === "backpacks" || cat === "tents-and-tarps") ? (minW || genW) : (genW || minW);
  const weightGrams = w ? toG(w[1], w[2]) : null;
  let desc = (html.match(/"description":"((?:[^"\\]|\\.){20,700})"/) || [])[1] || (html.match(/og:description" content="([^"]{10,})"/) || [])[1] || "";
  desc = desc.replace(/\\u2122/g, "™").replace(/\\u[0-9a-f]{4}/gi, " ").replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\/g, "").replace(/\s+/g, " ").trim().slice(0, 700);
  // images: dedupe rokka by filename, one 933px variant each
  const seen = new Set(); const imgs = [];
  for (const m of html.matchAll(/https:\/\/exped\.rokka\.io\/[a-z0-9_-]+\/variables-w-\d+-h-\d+\/([a-f0-9]+)\/([^"'\s]+?\.(?:jpg|jpeg|png|webp))/gi)) {
    const key = m[2]; if (seen.has(key)) continue; seen.add(key);
    imgs.push(`https://exped.rokka.io/fe_nuxt_crop_product/variables-w-933-h-933/${m[1]}/${m[2]}`);
    if (imgs.length >= 8) break;
  }
  return { name, weightGrams, desc, imgs };
}

async function fetchText(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { "User-Agent": UA } }); if (r.ok) { const t = await r.text(); if (t.length > 1000) return t; } } catch (e) {}
  }
  return null;
}

(async () => {
  const sm = await fetchText("https://www.exped.com/sitemap.xml");
  const all = [...new Set((sm.match(/https:\/\/www\.exped\.com\/en\/products\/[a-z0-9\/-]+/gi) || []))]
    .filter((u) => u.split("/products/")[1].includes("/"));
  const targets = all.filter((u) => !EXCLUDE.test(u.split("/products/")[1].split("/")[1])).slice(0, LIMIT);
  console.log(`sitemap products: ${all.length} | after exclude: ${targets.length}${LIMIT < Infinity ? " (limited)" : ""}\n`);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0, noWeight = 0, failed = 0;
  const typeTally = {};

  for (let i = 0; i < targets.length; i += 6) {
    const chunk = targets.slice(i, i + 6);
    const pages = await Promise.all(chunk.map((u) => fetchText(u).then((h) => ({ u, h }))));
    for (const { u, h } of pages) {
      const [, cat, slug] = u.split("/products/")[1].match(/^([^/]+)\/(.+)$/) || [];
      if (!h) { console.log(`  FAIL fetch: ${slug}`); failed++; continue; }
      const { name, weightGrams, desc, imgs } = parse(h, cat);
      if (!name) { console.log(`  FAIL parse: ${slug}`); failed++; continue; }
      const { itemType, category, subcategory } = classify(cat, slug);
      typeTally[itemType] = (typeTally[itemType] || 0) + 1;
      if (weightGrams == null) noWeight++;
      const exists = await C.findOne({ brand: /^exped$/i, name });
      if (exists) { skipped++; continue; }
      if (!COMMIT) { if (LIMIT < Infinity) console.log(`  ${name.padEnd(26)} [${itemType}] ${weightGrams ?? "-"}g imgs:${imgs.length} (${cat})`); continue; }
      const doc = new C({ brand: "Exped", name, createdBy: ADMIN_ID });
      doc.itemType = itemType; doc.category = category; doc.subcategory = subcategory;
      doc.isActive = true;
      if (weightGrams != null) doc.weightGrams = weightGrams;
      if (desc) doc.description = desc;
      if (imgs.length) doc.imageUrls = imgs;
      doc.attributes = {};
      doc.$locals.lenientAttributes = true;
      await doc.save();
      await O.create({ network: "direct", region: "global", merchantId: "direct-exped", merchantName: "Exped", productId: doc._id, deepLink: u, priority: 0 });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — created:${created} skipped:${skipped} noWeight:${noWeight} failed:${failed}`);
  console.log("types:", JSON.stringify(typeTally));
  await mongoose.disconnect();
})();
