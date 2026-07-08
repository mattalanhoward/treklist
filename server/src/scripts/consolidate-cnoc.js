/**
 * consolidate-cnoc.js — merge CNOC water containers that are split into one item per
 * THREAD (28mm/42mm) into a single item with Thread × Volume variants (collapsing the
 * Volume+Color combined option down to Volume). Per-variant weight from the feed.
 *
 * Parent = the 28mm DB item (keeps its offer/images), renamed; the 42mm item archived.
 * One buy-link for both threads (per-variant offers unsupported) — 42mm URL noted.
 * Special editions (Triple Crown, PCTA, TKO, Artist Series) left separate.
 *
 *   node src/scripts/consolidate-cnoc.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// name = consolidated name; t28/t42 = feed+DB titles per thread; volFixed = single-volume label (no Volume axis)
const MODELS = [
  { name: "Vecto Water Container", t28: "28mm Vecto Water Container", t42: "42mm Vecto Water Container" },
  { name: "VectoX Water Container", t28: "28mm VectoX Water Container", t42: "42mm VectoX Water Container" },
  { name: "Hydriam Collapsible Flask", t28: "28mm Hydriam Collapsible Flask", t42: "42mm Hydriam Collapsible Flask" },
  { name: "HydriamX Collapsible Flask", t28: "28mm HydriamX Collapsible Flask", t42: "42mm HydriamX Collapsible Flask" },
  { name: "Vesica 1L Collapsible Bottle", t28: "28mm Vesica® 1L Collapsible Bottle", t42: "42mm Vesica® 1L Collapsible Bottle", volFixed: "1L" },
];

const volOf = (optionValue) => { const m = String(optionValue).match(/^\s*([\d.]+\s*(?:L|ml))/i); return m ? m[1].replace(/\s+/g, "").toUpperCase().replace("ML", "ml") : null; };

(async () => {
  const feed = (await (await fetch("https://minimalgear.com/products.json?limit=250", { headers: { "User-Agent": UA } })).json()).products || [];
  const byTitle = Object.fromEntries(feed.map((p) => [p.title, p]));
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let done = 0;

  for (const m of MODELS) {
    const p28 = byTitle[m.t28], p42 = byTitle[m.t42];
    if (!p28 || !p42) { console.log(`  ! ${m.name}: feed products missing (${!p28 ? m.t28 : m.t42})`); continue; }

    // volume -> weight (grams) from feed variants of either thread
    const volWeight = {};
    const volsSeen = [];
    for (const p of [p28, p42]) for (const v of p.variants || []) {
      const vol = m.volFixed || volOf(v.option1) || volOf(v.title) || "one";
      if (!volsSeen.includes(vol)) volsSeen.push(vol);
      if (v.grams > 0 && volWeight[vol] == null) volWeight[vol] = v.grams;
    }
    const volumes = m.volFixed ? null : volsSeen;

    // trust per-volume weights only if they VARY across volumes (uniform across sizes =
    // shipping/placeholder, e.g. Vecto 142 g for 1L/2L/3L). Single-volume = trust it.
    const distinctW = new Set(Object.values(volWeight).filter(Boolean)).size;
    const useWeights = m.volFixed ? distinctW >= 1 : distinctW > 1;

    const axes = [{ name: "Thread", values: ["28mm", "42mm"] }];
    if (volumes) axes.push({ name: "Volume", values: volumes });
    const variants = [];
    for (const thread of ["28mm", "42mm"]) {
      for (const vol of volumes || [m.volFixed]) {
        const options = { Thread: thread };
        if (volumes) options.Volume = vol;
        variants.push({ key: Object.values(options).join(" / "), options, weightGrams: useWeights ? volWeight[vol] : undefined });
      }
    }
    const def = variants[0];

    console.log(`${m.name.padEnd(28)} ${axes.map((a) => `${a.name}[${a.values.join("/")}]`).join(" × ")} = ${variants.length} var | weights: ${JSON.stringify(volWeight)}`);

    if (COMMIT) {
      const parent = await C.findOne({ brand: "CNOC", name: m.t28, isActive: true });
      const other = await C.findOne({ brand: "CNOC", name: m.t42, isActive: true });
      if (!parent) { console.log(`   !! ${m.name}: 28mm DB item not found`); continue; }
      parent.name = m.name;
      parent.variantAxes = axes;
      parent.variants = variants;
      parent.defaultVariantKey = def.key;
      parent.weightGrams = def.weightGrams;
      parent.$locals.lenientAttributes = true;
      try { await parent.save(); } catch (e) { console.log(`   !! ${m.name}: ${e.message}`); continue; }
      if (other) await C.updateOne({ _id: other._id }, { $set: { isActive: false } });
      done++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${done || MODELS.length} models consolidated`);
  await mongoose.disconnect();
})();
