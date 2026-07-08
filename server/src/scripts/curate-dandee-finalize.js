/**
 * curate-dandee-finalize.js — trim descriptions + fix/fill weights + attribute the
 * stragglers on the kept Dandee items. Cottage maker: most weights unpublished /
 * approximate; the Standard pack's imported 1134 g is bogus (made-to-order) -> null.
 *
 *   node src/scripts/curate-dandee-finalize.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const MAX = 240;
function trim(d) {
  let t = (d || "").replace(/\s+/g, " ").replace(/\*+PLEASE CONTACT[^.]*\.?/i, "").trim();
  const sent = t.match(/[^.!?]+[.!?]+/g) || [t];
  let out = "";
  for (const s of sent) { if (out && (out + s).length > MAX) break; out += s; if (out.length >= MAX) break; }
  out = out.trim() || t.slice(0, MAX).trim();
  return out.length > MAX + 40 ? out.slice(0, MAX).replace(/\s+\S*$/, "") + "…" : out;
}

// per-name weight (g) and/or attribute fixes
const FIX = {
  "Standard Ultralight Backpack": { weight: null },         // bogus 1134 -> unset
  "Ultralight fanny pack": { weight: 64 },
  "Lightweight Poncho": { weight: 59, attrs: { material: "Polyester" } },
  "Titanium Spoons": { weight: 16 },
  "Classy Titanium Spoons 😉": { weight: 14 },
  "Lightload towels": { weight: 14, attrs: { material: "Synthetic Blend", size: "Small" } },
  "Mini Ditty/Spoon Cover by Aardwolf Gear Company": { attrs: { closureType: "Drawcord" } },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ itemGroupId: /^dandeepacks-/, isActive: true });
  let n = 0;
  for (const doc of items) {
    const next = trim(doc.description);
    if (next && next !== (doc.description || "").replace(/\s+/g, " ").trim()) doc.description = next;
    const fix = FIX[doc.name];
    if (fix) {
      if ("weight" in fix) doc.weightGrams = fix.weight == null ? undefined : fix.weight;
      if (fix.attrs) doc.attributes = { ...(doc.attributes || {}), ...fix.attrs };
    }
    doc.$locals.lenientAttributes = true;
    try { if (COMMIT) await doc.save(); n++; }
    catch (e) { console.log(`   !! ${doc.name}: ${e.message}`); }
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${items.length} finalized`);
  await mongoose.disconnect();
})();
