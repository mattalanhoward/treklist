/**
 * curate-hmg-cleanup.js — archive HMG pack-accessories + trim descriptions.
 *   node src/scripts/curate-hmg-cleanup.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const GRP = /^hyperlitemountaingear-/;

const ARCHIVE = ["Pack Toggle","Inside Pack Pocket","Accessory Bundle","Contour Removable Hip Belt","Removable Hip Belt","Unbound Removable Hip Belt","Insulator","Lawson Ironwire","Hip Belt Extender","Diagonal Ski Carry Kit","Pods","Side Entry Pod","Bottle Pocket","Porter Stuff Pocket","Prism Ice Screw Case","Prism Crampon Bag","Flat Micro D Carabiner","Sternum Strap","Pack Accessory Straps","Summit Stuff Pocket","Voile Straps","G.O.A.T. Tote","River Rescue Throw Bag","Trail Wallet","Minimalist Wallet"];

const MAX = 280;
const CUT = /(Specifications|Dimensions:|Features:|Materials:|\bSpecs\b|What.?s included)/i;
function trim(d) {
  let t = (d || "").replace(/[a-z.#][\w.#,\s>:-]*\{[^}]*\}/gi, " ").replace(/\s+/g, " ").trim();
  const m = t.search(CUT); if (m > 0) t = t.slice(0, m).trim();
  const sent = t.match(/[^.!?]+[.!?]+/g) || [t];
  let out = ""; for (const s of sent) { if (out && (out + s).length > MAX) break; out += s; if (out.length >= MAX) break; }
  out = out.trim() || t.slice(0, MAX).trim();
  return out.length > MAX + 40 ? out.slice(0, MAX).replace(/\s+\S*$/, "") + "…" : out;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let arch = 0;
  for (const name of ARCHIVE) {
    const r = await C.updateOne({ name, isActive: true, itemGroupId: GRP }, COMMIT ? { $set: { isActive: false } } : {});
    if (r.matchedCount) arch++; else console.log(`  ? not found: ${name}`);
  }
  // Garmin inReach: retype Smartphone -> Other (satellite communicator, no schema)
  if (COMMIT) await C.updateOne({ name: "Garmin inReach Mini 3", itemGroupId: GRP }, { $set: { itemType: "Other" } });
  // trim descriptions on remaining active
  const items = await C.find({ itemGroupId: GRP, isActive: true, name: { $nin: ARCHIVE } }).select("name description").lean();
  let trimmed = 0;
  for (const it of items) {
    const next = trim(it.description);
    if (next && next !== (it.description || "").replace(/\s+/g, " ").trim()) { if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: next } }); trimmed++; }
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${arch}/${ARCHIVE.length}, trimmed ${trimmed} descriptions`);
  await mongoose.disconnect();
})();
