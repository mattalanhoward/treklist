/**
 * ai-type-untyped.js
 *
 * Assigns an itemType to catalog items that are still untyped (itemType: null),
 * using the enum-constrained AI path. Many feed items are MODEL-NAMED
 * ("Mariposa 60", "Lunar Solo") so a keyword classifier can't type them, but
 * the model recognizes the product. Batched to keep calls/cost low.
 *
 * DRY-RUN by default. Writes itemType (+ derived category/subcategory) only.
 *
 *   node src/scripts/ai-type-untyped.js --group garagegrowngear- --limit 40   # preview a sample
 *   node src/scripts/ai-type-untyped.js --group garagegrowngear- --commit      # apply
 *   node src/scripts/ai-type-untyped.js --group garagegrowngear- --commit --db TrekList --confirm TrekList
 *
 * Flags:
 *   --group <prefix>   only items whose itemGroupId starts with this (e.g. a retailer)
 *   --brand <name>     only this brand (lowercased match)
 *   --limit <n>        cap how many items to process (sample/validate first)
 *   --batch <n>        items per AI call (default 20)
 *   --commit           write (default: dry-run)
 *   --db / --confirm   prod guard (mirrors the other scripts)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { getClient } = require("../services/anthropicService");
const { getAllItemTypes } = require("../config/attributeSchemas");
const { normalizeItemType, categoryForItemType } = require("../config/inferItemType");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const COMMIT = args.includes("--commit");
const GROUP = flag("--group", null);
const BRAND = (flag("--brand", null) || "").toLowerCase() || null;
const LIMIT = parseInt(flag("--limit", "0"), 10) || 0;
// keep <=14 — structured-output schema allows max 16 union-typed params, and a
// batch of N makes N union-typed keys (the old default of 20 now 400s).
const BATCH = parseInt(flag("--batch", "14"), 10);

const DB = flag("--db", null) || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && flag("--confirm", null) !== DB) {
  console.error(`\nRefusing to --commit to non-local DB "${DB}".\nRe-run with:  --db ${DB} --commit --confirm ${DB}\n`);
  process.exit(1);
}

const ITEM_TYPES = getAllItemTypes();
// Schema is built PER CALL as an OBJECT keyed by item index ("0".."N-1"), each
// required. (Arrays can't pin a length — the API rejects minItems>1 — and the
// model otherwise truncates the list, leaving trailing items untyped. Required
// object keys ARE enforced, so every item gets an answer.)
function batchSchema(n) {
  // Free string per key (no enum — repeating the 67-value enum N times makes the
  // schema "too complex to compile"). The system prompt constrains the values
  // and normalizeItemType() coerces each answer to a valid type or null.
  const properties = {};
  const required = [];
  for (let i = 0; i < n; i++) {
    properties[String(i)] = { anyOf: [{ type: "string" }, { type: "null" }] };
    required.push(String(i));
  }
  return { type: "object", properties, required, additionalProperties: false };
}

const SYSTEM = `You categorize ultralight backpacking / hiking gear into a fixed taxonomy.
For each product, pick EXACTLY one itemType from this list, or null if none fit:
${ITEM_TYPES.join(", ")}

Rules:
- Use your knowledge of named products (e.g. "Mariposa 60" by Gossamer Gear is a Backpack; "Lunar Solo" by Six Moon Designs is a Backpacking Tent).
- Use "Other" for an identifiable product that is real gear but has no matching type (accessories like straps, windscreens, trowels, sit pads, repair kits).
- Use null ONLY when you genuinely cannot tell what the product is.
- Return one result per input index.`;

function parse(message) {
  const block = (message.content || []).find((b) => b.type === "text");
  try { return JSON.parse(block ? block.text : ""); } catch { return null; }
}

async function classifyBatch(anthropic, batch) {
  const lines = batch.map((it, i) => {
    const desc = (it.description || "").replace(/\s+/g, " ").slice(0, 140);
    return `${i}. ${it.brand || "?"} — ${it.name}${desc ? ` | ${desc}` : ""}`;
  }).join("\n");
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: batchSchema(batch.length) } },
    messages: [{ role: "user", content: `Classify all ${batch.length} products (one itemType per numbered key):\n${lines}` }],
  });
  return parse(message); // { "0": itemType, "1": itemType, ... }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");

  const q = { itemType: null };
  if (GROUP) q.itemGroupId = new RegExp("^" + GROUP);
  if (BRAND) q.brandLC = BRAND;
  let items = await C.find(q).select("name brand brandLC description itemGroupId").lean();
  if (LIMIT) items = items.slice(0, LIMIT);

  console.log("=".repeat(64));
  console.log(`AI-TYPE UNTYPED  (${COMMIT ? "COMMIT — WILL WRITE" : "DRY RUN"})  DB: ${mongoose.connection.name}`);
  console.log(`items: ${items.length}  | batch: ${BATCH}  | ~${Math.ceil(items.length / BATCH)} AI calls`);
  console.log("=".repeat(64));

  const anthropic = getClient();
  let typed = 0, other = 0, stillNull = 0, failed = 0;
  const dist = {};

  for (let off = 0; off < items.length; off += BATCH) {
    const batch = items.slice(off, off + BATCH);
    let results;
    try { results = await classifyBatch(anthropic, batch); }
    catch (e) { console.log(`  ! batch ${off}-${off + batch.length} failed: ${e.message}`); failed += batch.length; continue; }
    if (!results) { console.log(`  ! batch ${off} returned no results`); failed += batch.length; continue; }

    for (let i = 0; i < batch.length; i++) {
      const it = batch[i];
      const type = normalizeItemType(results[String(i)], it.name);
      if (!type) { stillNull++; continue; }
      if (type === "Other") other++; else typed++;
      dist[type] = (dist[type] || 0) + 1;
      const { category, subcategory } = categoryForItemType(type, it.name);
      console.log(`  ${(it.name.replace(/ by .*/, "")).slice(0, 40).padEnd(40)} -> ${type}`);
      if (COMMIT) {
        const $set = { itemType: type }; const $unset = {};
        if (category) $set.category = category; else $unset.category = 1;
        if (subcategory) $set.subcategory = subcategory; else $unset.subcategory = 1;
        const u = { $set }; if (Object.keys($unset).length) u.$unset = $unset;
        await C.updateOne({ _id: it._id }, u);
      }
    }
  }

  console.log("\n" + "-".repeat(40));
  console.log(`typed: ${typed}  | Other: ${other}  | still null: ${stillNull}  | failed: ${failed}`);
  console.log("\ntop assigned types:");
  Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t, n]) => console.log(`  ${String(n).padStart(3)}  ${t}`));
  if (!COMMIT) console.log("\n(DRY RUN — nothing written. Re-run with --commit.)");

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
