/**
 * curate-naturehike-weights.js — fix Naturehike weights.
 *
 * The ingest stored the Shopify feed `grams`, which for Naturehike is a SHIPPING/
 * packaging weight, systematically inflated over the real product weight (often
 * 30–130%): Mongar UL 2P 2100→1660g, Snowbird SP1000 bag 1900→820g... , Gale
 * Terk PRO poles 500→197g. Real weights live in the body_html spec text.
 *
 * PASS 1 (done) nulled the bogus feed weight on every active item. This script is
 * now ADDITIVE (fill-nulls-only): it only sets weight on items currently NULL and
 * NEVER nulls or overwrites — so manual edits and archived items are never touched.
 * It backfills ONLY a HIGH-CONFIDENCE real weight parsed from body_html:
 *   (1) tents:  "Minimum weight approx. X kg"  (single, unambiguous)
 *   (2) any:    "Weigh(s/ing) as little as / approximately / only / about ~X g|kg"
 * Loose "Weight: X g" table values are NOT used — Naturehike reuses one body_html
 * across a whole product FAMILY (e.g. Snowbird SP400/700/1000) with a multi-row
 * table, so grabbing "the first weight" yields the WRONG model's number. Those
 * (and items with no published weight, e.g. the Cloud Up tents) are left NULL and
 * flagged for manual entry — never a fabricated or mismatched number.
 *
 *   node src/scripts/curate-naturehike-weights.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}
const FEED = process.env.NH_FEED || "/private/tmp/claude-501/-Users-matthewhoward-Projects-treklist/c1d45da0-4e4a-4787-9be0-c5ac49d125da/scratchpad/naturehike-all.json";

const toGrams = (numStr, unit) => {
  let v = parseFloat(String(numStr).replace(/,/g, ""));
  if (!isFinite(v)) return null;
  const u = unit.toLowerCase();
  if (u.startsWith("kg")) v *= 1000;
  else if (u.startsWith("lb") || u.startsWith("pound")) v *= 453.592;
  else if (u.startsWith("oz") || u.startsWith("ounce")) v *= 28.3495;
  return Math.round(v);
};

const text = (bh) =>
  (bh || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

// Return { g, src } for a HIGH-confidence single weight, else null.
function realWeight(bh, itemType) {
  const isTent = /tent/i.test(itemType || "");
  const isBag = /sleeping bag/i.test(itemType || ""); // bags always list a FILL weight -> single-figure is unsafe
  const t = text(bh);
  if (isTent) {
    const m = t.match(/minimum weight[^\d]{0,12}approx\.?[^\d]{0,6}([\d.]+)\s*kg/i);
    if (m) return { g: Math.round(parseFloat(m[1]) * 1000), src: "min-weight" };
  }
  // explicit single "weigh(s/ing) [as little as/approx/only/just] X g|kg|lb|oz"
  // (item's own intro prose -> model-specific even when a shared spec table follows)
  const m2 = t.match(/weigh(?:s|ing)?\s*(?:(?:as little as|approximately|approx\.?|only|just|about|around)\s*)*~?\s*([\d.,]+)\s*(g|kg|lbs?|pounds?|oz|ounces?)\b/i);
  if (m2) {
    const g = toGrams(m2[1], m2[2]);
    if (g != null && g >= 40 && g <= 9000) return { g, src: "weighing-phrase" };
  }
  // fallback: exactly ONE plausible weight figure in the whole body (single-model
  // item). Exclude fill-weight / packed-size / capacity contexts and multi-row
  // family tables (which leave >1 distinct value -> skipped as ambiguous).
  // SKIPPED for sleeping bags: they always carry a down/synthetic FILL-weight
  // figure that contaminates (CW400 -> the 400 is fill, not total).
  if (isBag) return null;
  const vals = new Set();
  const re = /([\d.,]+)\s*(g|kg)\b/gi;
  let mm;
  while ((mm = re.exec(t))) {
    const before = t.slice(Math.max(0, mm.index - 22), mm.index).toLowerCase();
    if (/fill|down|feather|capacity|cotton|polyester|nylon|denier|\bd\b|gsm|per |×|x\s*$/.test(before)) continue; // skip fill/fabric/dimension contexts
    let v = parseFloat(mm[1].replace(/,/g, ""));
    if (/kg/i.test(mm[2])) v *= 1000;
    v = Math.round(v);
    if (v >= 40 && v <= 9000) vals.add(v);
  }
  if (vals.size === 1) return { g: [...vals][0], src: "single-figure" };
  return null;
}

(async () => {
  const all = JSON.parse(fs.readFileSync(FEED, "utf8"));
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: /naturehike/i, isActive: true }).select("name itemType weightGrams itemGroupId").lean();
  const findFeed = (k) => all.find((x) => k.itemGroupId && k.itemGroupId.endsWith("-" + String(x.id))) || all.find((x) => x.title === k.name);

  // ADDITIVE fill-nulls-only: the bogus feed weights were already nulled in the
  // first pass. This pass ONLY fills items whose weight is currently null, and
  // NEVER nulls or overwrites — so manual edits (user's or the tent min-weights)
  // and archived items are never touched.
  let set = 0,
    stillNull = 0;
  const setRows = [],
    nullRows = [];
  for (const k of items) {
    if (k.weightGrams != null) continue; // leave existing weights alone
    const p = findFeed(k);
    const rw = p ? realWeight(p.body_html, k.itemType) : null;
    if (rw) {
      set++;
      setRows.push(`  NULL -> ${String(rw.g).padStart(5)}  (${rw.src})  ${k.name.slice(0, 48)}`);
      if (COMMIT) await C.collection.updateOne({ _id: k._id }, { $set: { weightGrams: rw.g } });
    } else {
      stillNull++;
      nullRows.push(`  ${k.name.slice(0, 54)}`);
    }
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"} — newly filled: ${set} | still null (manual entry): ${stillNull}`);
  console.log("\n=== NEWLY BACKFILLED (were null) ===");
  console.log(setRows.sort().join("\n"));
  console.log("\n=== STILL NULL ===");
  console.log(nullRows.sort().join("\n"));
  await mongoose.disconnect();
})();
