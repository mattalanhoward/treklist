/**
 * analyze-feed.js  (READ-ONLY)
 *
 * Pre-import analysis for a Shopify feed: how well it would classify, how much
 * is food/consumables, and how much overlaps the existing catalog (cross-source
 * dedupe). Writes nothing.
 *
 *   node src/scripts/analyze-feed.js --domain garagegrowngear.com
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);
const { inferItemType } = require("../config/inferItemType");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const DOMAIN = (flag("--domain", "garagegrowngear.com") || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

async function fetchPage(page) {
  const url = `https://${DOMAIN}/products.json?limit=250&page=${page}`;
  const { stdout } = await execFileP("curl", ["-s", "--max-time", "30", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", url], { maxBuffer: 50 * 1024 * 1024 });
  return (JSON.parse(stdout).products) || [];
}
async function fetchAll() {
  const out = [];
  for (let p = 1; p <= 40; p++) { const x = await fetchPage(p); if (!x.length) break; out.push(...x); if (x.length < 250) break; }
  return out;
}
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// Food / consumable signals (dehydrated meals, bars, drink mixes, etc.)
const FOOD_BRANDS = new Set([
  "nomad nutrition", "farm to summit", "karen's naturals", "good to-go", "good to go",
  "backpacker's pantry", "peak refuel", "mountain house", "trailtopia", "heather's choice",
  "outdoor herbivore", "naked & free", "wild zora", "skout", "gnarly nutrition",
]);
const FOOD_RE = /\b(meal|meals|dehydrated|freeze-?dried|backpacking food|trail food|granola|oatmeal|breakfast|dinner|entree|soup|stew|chili|risotto|pasta primavera|curry|snack|bar\b|bars\b|jerky|drink mix|electrolyte|coffee blend|instant coffee|ration|calorie)\b/i;

(async () => {
  console.log(`Fetching ${DOMAIN} ...`);
  const raw = await fetchAll();
  console.log(`fetched: ${raw.length}\n`);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const existing = await C.find({ isActive: true }).select("brand brandLC name").lean();
  const existingKeys = new Set(existing.map((e) => `${e.brandLC || norm(e.brand)}|${norm(e.name)}`));
  const existingBrands = new Set(existing.map((e) => e.brandLC || norm(e.brand)).filter(Boolean));

  let typed = 0, untyped = 0, food = 0, dupeExact = 0, dupeBrand = 0;
  const typeDist = {};
  const foodSamples = [], dupeSamples = [];
  const brandOverlap = {};
  // "net" = after excluding food + already-carried brands (the recommended first pass)
  let netTotal = 0, netTyped = 0, netUntyped = 0;

  for (const p of raw) {
    const name = p.title || "";
    const brand = p.vendor || "";
    const blc = norm(brand);
    const it = inferItemType(name, p.product_type) || null;
    if (it) { typed++; typeDist[it] = (typeDist[it] || 0) + 1; } else untyped++;

    const isFood = FOOD_BRANDS.has(blc) || FOOD_RE.test(name) || /food|meal|nutrition/i.test(p.product_type || "");
    if (isFood) { food++; if (foodSamples.length < 15) foodSamples.push(`${brand} — ${name}`); }

    const key = `${blc}|${norm(name)}`;
    const brandDupe = existingBrands.has(blc);
    if (existingKeys.has(key)) { dupeExact++; if (dupeSamples.length < 15) dupeSamples.push(`${brand} — ${name}`); }
    if (brandDupe) { dupeBrand++; brandOverlap[brand] = (brandOverlap[brand] || 0) + 1; }

    if (!isFood && !brandDupe) { netTotal++; if (it) netTyped++; else netUntyped++; }
  }

  console.log("================ CLASSIFICATION ================");
  console.log(`typed by inferItemType: ${typed}/${raw.length}  (${Math.round(100*typed/raw.length)}%)`);
  console.log(`untyped (null):         ${untyped}/${raw.length}`);
  console.log("\ntop itemTypes:");
  Object.entries(typeDist).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([t,n])=>console.log(`  ${String(n).padStart(4)}  ${t}`));

  console.log("\n================ FOOD / CONSUMABLES ================");
  console.log(`flagged food: ${food}/${raw.length}`);
  foodSamples.forEach((s)=>console.log(`  - ${s}`));

  console.log("\n================ CROSS-SOURCE OVERLAP (vs existing catalog) ================");
  console.log(`exact brand+name dupes: ${dupeExact}`);
  dupeSamples.forEach((s)=>console.log(`  = ${s}`));
  console.log(`\nitems whose BRAND already exists in catalog: ${dupeBrand}`);
  console.log("brand overlap counts:");
  Object.entries(brandOverlap).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([b,n])=>console.log(`  ${String(n).padStart(4)}  ${b}`));

  console.log("\n================ RECOMMENDED FIRST PASS (exclude food + already-carried brands) ================");
  console.log(`net importable: ${netTotal}  (typed ${netTyped} / ${Math.round(100*netTyped/netTotal)}%, untyped ${netUntyped})`);
  console.log(`excluded: ${food} food, ${dupeBrand} already-carried-brand (overlap between the two counted once in net)`);

  await mongoose.disconnect();
})().catch((e)=>{ console.error(e); process.exit(1); });
