/**
 * trim-zpacks-descriptions.js
 *
 * Trims Zpacks descriptions to the first 1-2 sentences (reviews/CSS already removed
 * by clean-zpacks-descriptions.js). Hook-safe collection.updateOne ($set).
 *
 *   node src/scripts/trim-zpacks-descriptions.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const MAX = 280;
const CUT = /(Specifications|Dimensions:|Features:|Materials:|Includes:|\bSpecs\b|What.?s included)/i;
function trim(d) {
  let t = (d || "").replace(/\s+/g, " ").trim();
  const m = t.search(CUT);
  if (m > 0) t = t.slice(0, m).trim();
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  let out = "";
  for (const s of sentences) { if (out && (out + s).length > MAX) break; out += s; if (out.length >= MAX) break; }
  out = out.trim() || t.slice(0, MAX).trim();
  if (out.length > MAX + 40) out = out.slice(0, MAX).replace(/\s+\S*$/, "") + "…";
  return out;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ itemGroupId: /^zpacks-/, isActive: true }).select("name description").lean();
  let n = 0;
  for (const it of items) {
    const next = trim(it.description);
    if (!next || next === (it.description || "").replace(/\s+/g, " ").trim()) continue;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: next } });
    n++;
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} trimmed / ${items.length}`);
  await mongoose.disconnect();
})();
