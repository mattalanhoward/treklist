/**
 * create-simond-climbing.js — Simond CLIMBING PROTECTION subset the user wants for
 * via-ferrata / light-mountaineering on hiking trails (Dolomites, PCT-style): Climbing
 * Helmets, Climbing Harnesses, Via Ferrata Sets. (Ice axes + crampons are handled by
 * create-simond-mountaineering.js. Ropes/carabiners/belay/chalk/etc. are NOT wanted.)
 *
 * simond.com = source of truth (specs/weights/images, in src/scripts/simond-climbing.json).
 * Keep the Awin/Decathlon affiliate link where the article code is in the feed, else the
 * simond.com product URL. -> Accessories & Tools / Climbing Gear.
 *
 *   node src/scripts/create-simond-climbing.js [--commit] [--csv <path>]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const zlib = require("zlib");
const fs = require("fs");
const { categoryForItemType } = require("../config/inferItemType");
const DATA = require("./simond-climbing.json");

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
  s = s.replace(/[\s,;:-]*two[\s-]colours?[\s,;:-]*/gi, " ");
  const COL = "black|white|grey|gray|blue|red|green|turquoise|navy|orange|yellow|purple|pink|beige|khaki|brown|jeans|dark|light";
  s = s.replace(new RegExp("\\s*[-–]\\s*(?:" + COL + ")(?:\\s+(?:" + COL + "))*\\s*$", "i"), "");
  s = s.replace(new RegExp("\\s+(?:" + COL + ")(?:\\s+(?:" + COL + "))*\\s*$", "i"), "");
  return s.replace(/[\s,;:–-]+$/, "").replace(/\s+/g, " ").trim() || n;
}
function genderOf(n) {
  if (/women|female|ladies|dames/i.test(n)) return "Womens";
  if (/kid|junior|child/i.test(n)) return "Kids";
  if (/\bmen'?s?\b|\bmale\b|heren/i.test(n)) return "Mens";
  return "Unisex";
}
function certEnum(c) {
  if (!c) return undefined;
  if (/12492/.test(c)) return "EN 12492";
  if (/12277/.test(c)) return "EN 12277";
  if (/958/.test(c)) return "EN 958";
  return "CE";
}
function helmetConstruction(specs) {
  const s = JSON.stringify(specs).toLowerCase();
  if (/in-mold|in mold|eps|polycarbonate/.test(s)) return "Foam (In-mold)";
  if (/\babs\b|polystyrene/.test(s)) return "Hardshell (ABS)";
  return undefined;
}
function harnessType(n) {
  if (/full|spider/i.test(n)) return "Full-body";
  if (/kid|junior/i.test(n)) return "Sport";
  if (/edge|lightweight|high.?perf/i.test(n)) return "Sport";
  if (/klimb|rock|all.?round/i.test(n)) return "Trad/All-round";
  return "Trad/All-round";
}
function numFrom(specs, re) { for (const v of Object.values(specs || {})) { const m = String(v).match(re); if (m) return parseInt(m[1]); } return undefined; }

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

    const gender = genderOf(p.name);
    const { category, subcategory } = categoryForItemType(p.itemType, "");
    const attributes = {};
    const cert = certEnum(p.certification);
    if (cert) attributes.certification = cert;
    if (p.itemType === "Climbing Helmet") {
      if (gender !== "Unisex") attributes.gender = gender;
      const con = helmetConstruction(p.specs); if (con) attributes.construction = con;
      const v = numFrom(p.specs, /(\d+)\s*(?:ventilation|air vent|vent)/i); if (v) attributes.ventCount = v;
      if (/headlamp|head torch/i.test(JSON.stringify(p.specs))) attributes.headlampClips = true;
    } else if (p.itemType === "Climbing Harness") {
      attributes.gender = gender;
      attributes.harnessType = harnessType(p.name);
      const gl = numFrom(p.specs, /(\d+)\s*gear\s*loop/i); if (gl) attributes.gearLoops = gl;
    } else if (p.itemType === "Via Ferrata Set") {
      if (/ferrata/i.test(p.name)) { attributes.absorberType = "Tearing Webbing"; attributes.carabiners = "Auto-locking"; attributes.elasticArms = true; }
      else { attributes.carabiners = "None (lanyard only)"; attributes.absorberType = "None"; }
    }

    const specBits = Object.entries(p.specs || {}).filter(([k]) => !/weight|lightweight/.test(k)).slice(0, 4).map(([k, v]) => `${k}: ${v}`);
    let description = (`${brand} ${name}. ` + specBits.join(". ")).replace(/\s+/g, " ").trim().slice(0, 1400);
    if (p.weightStr) description += `\n\nWeight (manufacturer): ${p.weightStr}.`;

    const link = feedLink[p.code];
    const offer = link
      ? { network: "awin", region: "global", merchantId: "awin-decathlon-uk", merchantName: "Decathlon UK", externalProductId: p.code, deepLink: link, priority: 0 }
      : { network: "direct", region: "global", merchantId: "direct-simond", merchantName: "Simond", externalProductId: p.code, deepLink: p.url, priority: 0 };
    if (link) awin++; else direct++;

    console.log(`${created + 1}. ${p.itemType.padEnd(16)} ${String(p.grams || "-").padStart(4)}g ${link ? "AWIN" : "simond"}  ${name.slice(0, 46)}`);

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
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created (${awin} Awin links, ${direct} direct simond.com), ${skipped} skipped`);
  await mongoose.disconnect();
})();
