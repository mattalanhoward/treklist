/**
 * trim-hyberg-descriptions.js
 *
 * Now that Hyberg items carry structured attributes, the long descriptions (2000
 * chars, spec-table dumps) are overkill. This trims each active Hyberg item's
 * description to the first 1–2 sentences of its marketing intro (everything before
 * the spec table). Deterministic — keeps real prose, no AI, no specs invented.
 * Reversible: backfill-descriptions.js re-expands from the feed.
 *
 *   node src/scripts/trim-hyberg-descriptions.js            # dry-run (shows before/after)
 *   node src/scripts/trim-hyberg-descriptions.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const MAX = 280;
// markers where the marketing intro ends and specs/sections begin
const CUT = /(Technical Specs|Product features|Product Features|What.?s included|What.?s Included|Comfort\s*\/\s*Limit|Key Advantages|Key Features|Design\s*&|Down quality|\bSpecs\b|Material:)/i;

function trim(desc) {
  let d = (desc || "").replace(/\s+/g, " ").trim();
  d = d.replace(/^Product Description\s*/i, "");
  const m = d.search(CUT);
  if (m > 0) d = d.slice(0, m).trim();
  // take whole sentences up to ~MAX chars (at least 1 sentence)
  const sentences = d.match(/[^.!?]+[.!?]+/g) || [d];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).length > MAX) break;
    out += s;
    if (out.length >= MAX) break;
  }
  out = out.trim() || d.slice(0, MAX).trim();
  if (out.length > MAX + 40) out = out.slice(0, MAX).replace(/\s+\S*$/, "") + "…";
  return out;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ itemGroupId: /^hyberg-/, isActive: true }).select("name description").lean();
  let n = 0;
  for (const it of items) {
    const next = trim(it.description);
    if (!next || next === it.description) continue;
    console.log(`\n### ${it.name}  (${(it.description || "").length} -> ${next.length})`);
    console.log(`   ${next}`);
    // direct $set — NOT doc.save() — to avoid the pre-save hook wiping other fields
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: next } });
    n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} descriptions trimmed`);
  await mongoose.disconnect();
})();
