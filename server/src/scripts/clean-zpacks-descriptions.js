/**
 * clean-zpacks-descriptions.js
 *
 * Strips embedded customer reviews + leftover CSS/style blocks from Zpacks
 * descriptions (reviews are prepended, ending in a "– Name ★★★★★" run). Keeps the
 * real product description. Hook-safe collection.updateOne ($set description).
 *
 *   node src/scripts/clean-zpacks-descriptions.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

function clean(d) {
  if (!d) return d;
  let t = d.replace(/\s+/g, " ").trim();
  t = t.replace(/[a-z.#][\w.#,\s>:-]*\{[^}]*\}/gi, " ").replace(/\s+/g, " ").trim(); // CSS blocks
  if (/★/.test(t)) {
    const after = t.slice(t.lastIndexOf("★") + 1).replace(/^[\s,.;:–—-]+/, "").trim();
    t = after.length >= 60 ? after : t.slice(0, t.indexOf("★")).replace(/[""][^""]*$/, "").trim();
  }
  return t.replace(/\s+/g, " ").trim();
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ itemGroupId: /^zpacks-/, isActive: true }).select("name description").lean();
  let n = 0;
  for (const it of items) {
    const next = clean(it.description);
    if (!next || next === (it.description || "").replace(/\s+/g, " ").trim()) continue;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: next } });
    n++;
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} descriptions cleaned / ${items.length}`);
  await mongoose.disconnect();
})();
