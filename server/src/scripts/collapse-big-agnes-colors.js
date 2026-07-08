/**
 * collapse-big-agnes-colors.js
 *
 * Big Agnes lists some products once PER colorway / special edition (Blacktail
 * "Warm Olive" vs "Vetiver", "- Alpenglow" editions) and has a few exact-name
 * dupes (two "Shield 2 Footprint", a doubled "Women's Anthracite 20°"). Colorways
 * don't change the gear, so collapse each group to one item.
 *
 * KEEPER = most images (current colorway carries the fullest gallery + the
 * trail-weight spec), tie-break by exact base name, then newest itemGroupId.
 * The keeper is renamed to the color-free base; the rest are archived
 * (isActive:false). updateOne only (never .save() a projected doc).
 *
 * DRY-RUN by default; --commit to write. Local DB only unless --db/--confirm.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const DB = flag("--db", null) || process.env.MONGO_DB_NAME || "treklist_local";
if (COMMIT && DB !== "treklist_local" && flag("--confirm", null) !== DB) {
  console.error(`Refusing to --commit to non-local DB "${DB}". Add --confirm ${DB}.`);
  process.exit(1);
}

const baseName = (n) => String(n).replace(/\s*-\s*(Vetiver|Warm Olive|Alpenglow)\s*$/i, "").trim();

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const CatalogItem = require("../models/catalogItem");
  const col = CatalogItem.collection;
  const items = await CatalogItem.find({
    brandLC: "big agnes", itemGroupId: /^bigagnes-/, isActive: { $ne: false },
  }).select("name imageUrls itemGroupId").lean();

  const groups = {};
  for (const it of items) (groups[baseName(it.name)] = groups[baseName(it.name)] || []).push(it);

  let renamed = 0, archived = 0;
  for (const [base, arr] of Object.entries(groups)) {
    if (arr.length < 2) continue;
    const idNum = (g) => Number(String(g.itemGroupId).replace(/\D/g, "")) || 0;
    arr.sort((a, b) =>
      (b.imageUrls?.length || 0) - (a.imageUrls?.length || 0) ||
      (a.name === base ? -1 : 0) - (b.name === base ? -1 : 0) ||
      idNum(b) - idNum(a),
    );
    const [keeper, ...rest] = arr;
    console.log(`\n"${base}": keep ${keeper.name} (${keeper.imageUrls?.length || 0} img) | archive ${rest.map((r) => r.name).join(", ")}`);
    if (COMMIT) {
      if (keeper.name !== base) { await col.updateOne({ _id: keeper._id }, { $set: { name: base } }); renamed++; }
      for (const r of rest) { await col.updateOne({ _id: r._id }, { $set: { isActive: false } }); archived++; }
    } else {
      if (keeper.name !== base) renamed++;
      archived += rest.length;
    }
  }
  console.log(`\n${COMMIT ? "✓ " : "(dry-run) "}renamed keepers: ${renamed} | archived dupes: ${archived}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
