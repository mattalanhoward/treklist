/**
 * exped-attributes.js — fill CatalogItem.attributes for Exped from name + description
 * (user, 2026-07-02). Derivable: bags = temp(°C/°F) + insulation + shape + gender;
 * pads = rValue (from "3R"/SIM number/desc) + shape + inflationMethod; packs =
 * volumeLiters + gender; tents = capacity + seasonRating. Loads FULL docs and .save()s
 * (safe — not projected) so the pre-save hook validates leniently.
 *
 *   node src/scripts/exped-attributes.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
const f2c = (f) => Math.round(((f - 32) * 5) / 9);

function bagAttrs(name, desc) {
  const a = { shape: "Mummy", gender: "Unisex" };
  let m = name.match(/(-?\d+)\s*C\b/i); const mf = name.match(/(-?\d+)\s*F\b/i);
  if (m) a.tempRatingC = +m[1];
  if (mf) a.tempRatingF = +mf[1];
  if (!m) { const d = name.match(/(-?\d+)\s*°/); if (d) { a.tempRatingC = +d[1]; } }
  if (a.tempRatingC != null && a.tempRatingF == null) a.tempRatingF = Math.round((a.tempRatingC * 9) / 5 + 32);
  // model name drives insulation ("down" appears in prose so desc is unreliable)
  if (/^(ultra|comfort|dura)\b/i.test(name)) a.insulationType = "Down";
  else if (/^(terra|deepsleep|megasleep|dreamwalker|luxewool)/i.test(name)) a.insulationType = "Synthetic";
  else a.insulationType = /synthetic|texped|synmat|primaloft/i.test((desc || "").toLowerCase()) ? "Synthetic" : "Down";
  const fp = (desc || "").match(/(\d{3})\s*(?:fill power|fp|cuin)/i); if (fp) a.fillPower = +fp[1];
  return a;
}
function quiltAttrs(name, desc) { const a = bagAttrs(name, desc); delete a.shape; delete a.gender; return a; }

function padAttrs(name, desc, foam) {
  const a = {};
  let m = name.match(/(\d+(?:\.\d+)?)\s*R\b/i);          // "3R", "6.5R"
  if (!m) m = name.match(/\b(\d+(?:\.\d+)?)\s*$/);        // SIM trailing number = R-value
  if (!m) { const d = (desc || "").match(/R[- ]?Value[:\s]+(\d+(?:\.\d+)?)/i); if (d) m = d; }
  if (m) a.rValue = +m[1];
  a.shape = /mummy/i.test(name) ? "Mummy" : "Rectangular";
  if (!foam) {
    const t = (desc || "").toLowerCase();
    if (/self.?inflat/.test(t) || /^(sim|megamat|luxemat|deepsleep|multimat|versaluxe)/i.test(name)) a.inflationMethod = "Self-Inflating";
    else if (/pump/.test(t)) a.inflationMethod = "Pump Sack";
    else a.inflationMethod = "Blow Valve";
  } else { a.padType = "Closed-Cell Foam"; }
  return a;
}

function packAttrs(name) {
  const a = { gender: /wmns|women/i.test(name) ? "Womens" : "Unisex" };
  const nums = (name.match(/\d+/g) || []).map(Number);
  if (nums.length) a.volumeLiters = nums[nums.length - 1]; // trailing number = volume
  return a;
}

function tentAttrs(name, desc) {
  const a = {};
  const tok = name.toLowerCase().match(/\b(i{1,3}|iv|v|[1-4])\b/);
  if (tok) a.capacity = `${ROMAN[tok[1]] || +tok[1]}-Person`;
  else { const d = (desc || "").match(/(\d)[- ]person/i); if (d) a.capacity = `${d[1]}-Person`; }
  a.seasonRating = /extreme|expedition|4.?season|polaris/i.test(name + " " + (desc || "")) ? "4-Season" : "3-Season";
  return a;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const docs = await C.find({ brand: /^exped$/i, isActive: true });
  let n = 0; const byType = {};
  for (const d of docs) {
    let a = null;
    switch (d.itemType) {
      case "Sleeping Bag": a = bagAttrs(d.name, d.description); break;
      case "Quilt": a = quiltAttrs(d.name, d.description); break;
      case "Inflatable Sleeping Pad": a = padAttrs(d.name, d.description, false); break;
      case "Foam Sleeping Pad": a = padAttrs(d.name, d.description, true); break;
      case "Backpack": case "Hip Pack": a = d.itemType === "Backpack" ? packAttrs(d.name) : null; break;
      case "Backpacking Tent": a = tentAttrs(d.name, d.description); break;
    }
    if (!a) continue;
    // sub-20L "backpacks" fail Backpack volume≥20 → Daypack (10-40); <10L drop volume
    if (d.itemType === "Backpack" && a.volumeLiters != null && a.volumeLiters < 20) {
      d.itemType = "Daypack";
      const cc = categoryForItemType("Daypack", d.name);
      d.category = cc.category; d.subcategory = cc.subcategory;
      if (a.volumeLiters < 10) delete a.volumeLiters;
    }
    byType[d.itemType] = (byType[d.itemType] || 0) + 1;
    if (!COMMIT) { if (n < 12) console.log(`  ${d.name.padEnd(26)} ${JSON.stringify(a)}`); n++; continue; }
    d.attributes = a; d.$locals.lenientAttributes = true;
    try { await d.save(); n++; } catch (e) { console.log(`  !! ${d.name}: ${e.message}`); }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — attr-filled ${n} | byType ${JSON.stringify(byType)}`);
  await mongoose.disconnect();
})();
