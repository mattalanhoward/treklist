/**
 * create-simond-mountaineering.js — Simond ICE AXES + CRAMPONS (the mountaineering
 * subset the user wants; helmets/harnesses/via-ferrata were explicitly declined).
 * simond.com = source of truth (specs/weights/images, in src/scripts/simond-mountaineering.json);
 * keep the Awin/Decathlon affiliate link where the article code is in the feed, else the
 * simond.com URL. -> Accessories & Tools / Climbing Gear.
 *
 *   node src/scripts/create-simond-mountaineering.js [--commit] [--csv <path>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const zlib = require("zlib");
const fs = require("fs");
const { categoryForItemType } = require("../config/inferItemType");
const DATA = require("./simond-mountaineering.json");

const COMMIT = process.argv.includes("--commit");
const CSV_ARG = (() => { const i = process.argv.indexOf("--csv"); return i > -1 ? process.argv[i + 1] : null; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";

const Q = String.fromCharCode(34);
async function loadFeedLinks() {
  try {
    let text;
    if (CSV_ARG && fs.existsSync(CSV_ARG)) text = fs.readFileSync(CSV_ARG, "utf8");
    else { const res = await fetch(process.env.AWIN_DECATHLON_FEED_URL); text = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"); }
    const lines = text.split(/\r?\n/).filter(Boolean);
    const idx = Object.fromEntries(lines[0].split(",").map((h, i) => [h, i]));
    const parse = (line) => { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === Q) { if (line[i + 1] === Q) { c += Q; i++; } else q = false; } else c += ch; } else { if (ch === Q) q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } } o.push(c); return o; };
    const byCode = {};
    for (const l of lines.slice(1)) { const r = parse(l); const code = (r[idx.merchant_product_id] || "").split("-")[0]; if (/^\d{6,8}$/.test(code) && !byCode[code]) byCode[code] = r[idx.aw_deep_link]; }
    return byCode;
  } catch (e) { console.log("(feed unavailable: " + e.message + ")"); return {}; }
}

function cleanName(n) {
  let s = (n || "").replace(/\s+/g, " ").trim();
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|\s|-)\w/g, (m) => m.toUpperCase());
  const COL = "black|white|grey|gray|blue|red|green|turquoise|navy|orange|yellow|purple|pink|beige|khaki|brown|jeans|dark|light";
  s = s.replace(new RegExp("\\s*[-–]\\s*(?:" + COL + ")(?:\\s+(?:" + COL + "))*\\s*$", "i"), "");
  s = s.replace(new RegExp("\\s+(?:" + COL + ")(?:\\s+(?:" + COL + "))*\\s*$", "i"), "");
  return s.replace(/[\s,;:–-]+$/, "").replace(/\s+/g, " ").trim() || n;
}
const specText = (p) => JSON.stringify(p.specs || {}).toLowerCase() + " " + (p.name || "").toLowerCase();

function iceAxeAttrs(p) {
  const t = specText(p), a = {};
  a.axeType = /waterfall|cascade|ice climb|steep ice|dry.?tool|mixed/.test(t) ? "Technical/Ice"
    : /mountaineering|glacier|walking|versatile|ski.?mountaineer/.test(t) ? "Mountaineering/Walking"
    : "Technical/Ice";
  if (/marteau|hammer/.test(t)) a.headType = "Hammer";
  else if (/adze|panne/.test(t)) a.headType = "Adze";
  if (p.certification && /13089/.test(p.certification)) a.certification = a.axeType === "Technical/Ice" ? "EN 13089 (Technical)" : "EN 13089 (Basic)";
  else if (p.certification) a.certification = "CE";
  a.shaftMaterial = /steel/.test(t) ? "Steel" : /carbon/.test(t) ? "Carbon" : "Aluminum";
  return a;
}
function cramponAttrs(p) {
  const t = specText(p), a = {};
  const pts = t.match(/(\d+)\s*-?\s*point/); if (pts) a.points = parseInt(pts[1]);
  a.bindingType = /mini|hiking|auxiliary|micro/.test(t) ? "Micro (Hiking)"
    : /semi.?auto|semi.?step|hybrid/.test(t) ? "Semi-automatic/Hybrid"
    : /\bautomatic\b|step.?in/.test(t) ? "Step-in/Automatic"
    : /strap|universal/.test(t) ? "Strap-on/Universal" : undefined;
  a.material = /alumin/.test(t) ? "Aluminum" : /stainless/.test(t) ? "Stainless Steel" : "Steel";
  a.certification = "EN 893";
  if (/anti.?bot|anti.?balling|antibott/.test(t)) a.antiBalling = true;
  if (/\bmix\b|mixed/.test(t)) a.frontPoints = "Dual/Modular";
  return a;
}

(async () => {
  const feedLink = await loadFeedLinks();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const usedCodes = new Set((await O.find({ externalProductId: { $exists: true } }).select("externalProductId").lean()).map((o) => o.externalProductId));

  let created = 0, skipped = 0, awin = 0, direct = 0;
  for (const p of DATA) {
    const name = cleanName(p.name);
    const brand = "Simond";
    if (usedCodes.has(p.code)) { console.log(`~~ ${name}: code ${p.code} already has an offer — skip`); skipped++; continue; }
    if (await C.findOne({ name, brand, isActive: true }).select("_id").lean()) { console.log(`~~ ${name}: already active — skip`); skipped++; continue; }

    const { category, subcategory } = categoryForItemType(p.itemType, "");
    const attributes = p.itemType === "Ice Axe" ? iceAxeAttrs(p) : cramponAttrs(p);

    const specBits = Object.entries(p.specs || {}).filter(([k]) => !/weight|lightweight/.test(k)).slice(0, 4).map(([k, v]) => `${k}: ${v}`);
    let description = (`${brand} ${name}. ` + specBits.join(". ")).replace(/\s+/g, " ").trim().slice(0, 1400);
    if (p.weightStr) description += `\n\nWeight (manufacturer): ${p.weightStr}.`;

    const link = feedLink[p.code];
    const offer = link
      ? { network: "awin", region: "global", merchantId: "awin-decathlon-uk", merchantName: "Decathlon UK", externalProductId: p.code, deepLink: link, priority: 0 }
      : { network: "direct", region: "global", merchantId: "direct-simond", merchantName: "Simond", externalProductId: p.code, deepLink: p.url, priority: 0 };
    if (link) awin++; else direct++;

    console.log(`${created + 1}. ${p.itemType.padEnd(8)} ${String(p.grams || "-").padStart(4)}g ${link ? "AWIN  " : "simond"} ${name.slice(0, 46).padEnd(46)} ${JSON.stringify(attributes)}`);

    if (COMMIT) {
      if (!p.image) { console.log(`   !! no image — skip`); skipped++; continue; }
      const doc = new C({
        name, brand, itemType: p.itemType, category, subcategory,
        description, imageUrls: [p.image], createdBy: ADMIN_ID, isActive: true,
        ...(p.grams ? { weightGrams: p.grams } : {}),
        attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); skipped++; continue; }
      await O.create({ ...offer, productId: doc._id });
      created++;
    } else created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created (${awin} Awin, ${direct} direct), ${skipped} skipped`);
  await mongoose.disconnect();
})();
