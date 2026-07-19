/**
 * curate-gsi.js — GSI Outdoors (gsioutdoors.com), Shopify open feed.
 *
 * gsioutdoors.com has an OPEN /products.json (357 products; vendor "GSI Outdoors"
 * + a games/gifts sub-brand "Outside Inside Gifts" we ignore). ✅ The feed variant
 * `grams` are REAL product weights (spot-checked: Halulite Minimalist 173g,
 * Infinity Mug 100g, Escape 3L 835g) — used directly, no PDP scrape needed.
 *
 * SCOPE = the specific backpacking items the user selected (2026-07-17). Cook
 * systems + canister stoves + a coffee dripper + backpacking cutlery. Car-camping
 * kitchen sets, Selkirk/Pinnacle-Pro basecamp stoves, enamelware, chef/steak
 * knives, games and gifts are all out.
 *
 * WEIGHTS: feed grams. EXCEPTION — the 3 Glacier Folding spork/spoon/fork read
 * 0.0 oz on GSI's own PDPs (no published weight anywhere) → imported weightless +
 * flagged, NOT fabricated (standing rule).
 *
 * TYPING (baked per handle): cook systems (pot + cups/bowls) -> Backpacking Pot;
 * canister/remote stoves -> Stove (Canister); cutlery -> Utensil (Spork/Spoon/
 * Fork/Knife/Multi-Tool by name); the Ultralight Java Drip (a collapsible coffee
 * filter cone, no matching itemType) -> Other in Kitchen & Cooking / Coffee.
 * material + volumeMl + outputBtu are auto-derived from each product's body_html.
 * COLOR collapsed (Glacier Folding Spoon/Fork/Spork, Tekk Trio) — color is never
 * a product distinction.
 *
 * OFFERS: direct, unmonetized gsioutdoors.com links (merchantId "direct-gsi").
 *
 *   node src/scripts/curate-gsi.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFileSync } = require("child_process");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://gsioutdoors.com/products.json?limit=250";
const SITE = "https://gsioutdoors.com/products/";

// handle -> itemType (+ optional name override, utensilType hint)
const KEEPERS = [
  // cook systems -> Backpacking Pot
  { handle: "glacier-stainless-explorer-set", itemType: "Backpacking Pot" },
  { handle: "glacier-dualist", itemType: "Backpacking Pot" },
  { handle: "glacier-minimalist", itemType: "Backpacking Pot" },
  { handle: "halulite-dualist", itemType: "Backpacking Pot" },
  { handle: "halulite-dualist-hs", itemType: "Backpacking Pot" },
  { handle: "halulite-dualist-hs-complete", itemType: "Backpacking Pot" },
  { handle: "halulite-minimalist-ii-cookset-for-one", itemType: "Backpacking Pot" },
  { handle: "halulite-soloist-new", itemType: "Backpacking Pot" },
  // canister stoves -> Stove (Canister)
  { handle: "glacier-canister-top-stove", itemType: "Stove (Canister)" },
  { handle: "pinnacle-canister-stove", itemType: "Stove (Canister)" },
  { handle: "pinnacle-4-season-stove", itemType: "Stove (Canister)" },
  { handle: "glacier-camp-stove", itemType: "Stove (Canister)" },
  // coffee dripper -> Other
  { handle: "ultralight-java-drip", itemType: "Other" },
  // cutlery -> Utensil
  { handle: "glacier-folding-knife", itemType: "Utensil", utensilType: "Knife" },
  { handle: "tekk-folding-spork", itemType: "Utensil", utensilType: "Spork" },
  { handle: "tekk-tandem-spork-set", itemType: "Utensil", utensilType: "Spork" },
  { handle: "tekk-trio-folding-cutlery-set-grey", itemType: "Utensil", utensilType: "Multi-Tool", name: "Tekk Trio Folding Cutlery Set" },
  { handle: "tekk-cutlery-set", itemType: "Utensil", utensilType: "Multi-Tool" },
  { handle: "glacier-stainless-3-pc-cutlery-set", itemType: "Utensil", utensilType: "Multi-Tool" },
  { handle: "halulite-3-pc-ring-cutlery", itemType: "Utensil", utensilType: "Multi-Tool" },
  { handle: "essential-spoon", itemType: "Utensil", utensilType: "Spoon" },
  { handle: "pivot-spoon", itemType: "Utensil", utensilType: "Spoon" },
  { handle: "pack-spoon", itemType: "Utensil", utensilType: "Spoon" },
  { handle: "glacier-folding-spork", itemType: "Utensil", utensilType: "Spork" },
  { handle: "glacier-folding-spoon-blue", itemType: "Utensil", utensilType: "Spoon", name: "Glacier Folding Spoon" },
  { handle: "glacier-folding-fork-blue", itemType: "Utensil", utensilType: "Fork", name: "Glacier Folding Fork" },
];

const stripHtml = (h) =>
  (h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const materialOf = (txt, itemType) => {
  // GSI product LINES are the reliable signal (body prose sometimes name-drops
  // "titanium" in comparisons): Halulite/Pinnacle = hard-anodized aluminum,
  // Glacier = stainless steel.
  if (/halulite|pinnacle/i.test(txt)) return "Aluminum";
  if (/glacier/i.test(txt)) return "Stainless Steel";
  if (/titanium/i.test(txt)) return "Titanium";
  if (/stainless/i.test(txt)) return "Stainless Steel";
  if (/anodi|aluminum|aluminium/i.test(txt)) return "Aluminum";
  if (itemType === "Utensil" && /nylon|polypro|polycarb|plastic/i.test(txt)) return "Plastic/Polycarbonate";
  return null;
};
const volumeMlOf = (txt) => {
  // largest "X L" / "X.X L" / "XXX ml" capacity mention
  let max = 0;
  for (const m of txt.matchAll(/(\d+(?:\.\d+)?)\s*(l|liter|litre)\b/gi)) max = Math.max(max, parseFloat(m[1]) * 1000);
  for (const m of txt.matchAll(/(\d{2,4})\s*ml\b/gi)) max = Math.max(max, parseFloat(m[1]));
  return max >= 200 ? Math.round(max) : null;
};
const btuOf = (txt) => {
  const m = /([\d,]{3,6})\s*btu/i.exec(txt);
  return m ? parseInt(m[1].replace(/,/g, "")) : null;
};

(async () => {
  // the feed is ~357 products across pages of 250 — fetch all pages
  const products = [];
  for (let page = 1; page <= 5; page++) {
    let raw;
    for (let i = 0; i < 4 && !raw; i++) {
      const out = execFileSync("curl", ["-s", "-H", "User-Agent: Mozilla/5.0", `${FEED}&page=${page}`], { maxBuffer: 32 * 1024 * 1024 }).toString();
      if (out.trim().startsWith("{")) raw = out; else execFileSync("sleep", ["3"]);
    }
    if (!raw) throw new Error("feed fetch kept failing — retry later");
    const batch = JSON.parse(raw).products || [];
    if (!batch.length) break;
    products.push(...batch);
  }
  const byHandle = (h) => products.find((p) => p.handle === h);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  const byType = {};
  for (const k of KEEPERS) {
    const p = byHandle(k.handle);
    if (!p) { console.log(`   !! ${k.handle}: not in feed — skip`); continue; }
    byType[k.itemType] = (byType[k.itemType] || 0) + 1;
    const name = (k.name || p.title).replace(/\s*-\s*(Blue|Grey|Gray|Orange|Green|Jade|Eggshell)\s*$/i, "").trim();
    const existing = await C.findOne({ name, brand: /gsi/i }).lean();
    if (existing) { console.log(`${name}: exists — skip`); continue; }

    const body = stripHtml(p.body_html);
    const grams = Math.max(0, ...p.variants.map((v) => v.grams || 0));
    const weightGrams = grams > 0 ? grams : null;
    const images = (p.images || []).map((i) => i.src).slice(0, 10);
    const deepLink = SITE + p.handle;

    // category
    let category, subcategory;
    if (k.itemType === "Other") { category = "Kitchen & Cooking"; subcategory = "Coffee"; }
    else ({ category, subcategory } = categoryForItemType(k.itemType, name) || {});

    // attributes
    const attributes = {};
    const mat = materialOf(body + " " + name, k.itemType);
    if (k.itemType === "Backpacking Pot") {
      if (mat) attributes.material = mat;
      const vol = volumeMlOf(body);
      if (vol) attributes.volumeMl = vol;
    } else if (k.itemType === "Stove (Canister)") {
      const btu = btuOf(body);
      if (btu) attributes.outputBtu = btu;
      attributes.potSupport = "Folding Arms";
      attributes.igniterBuiltIn = /piezo|push[- ]?button|auto[- ]?ignit|igniter/i.test(body);
    } else if (k.itemType === "Utensil") {
      attributes.utensilType = k.utensilType;
      if (mat) attributes.material = mat;
      attributes.foldable = /fold/i.test(name + " " + body);
    }

    console.log(`${name.slice(0, 40).padEnd(40)} ${k.itemType.padEnd(18)} ${String(weightGrams ?? "NULL").padStart(5)}g imgs:${images.length} ${JSON.stringify(attributes)}`);

    if (COMMIT) {
      if (!images.length) { console.log(`   !! ${name}: no images — skip`); continue; }
      const doc = new C({
        name, brand: "GSI Outdoors", itemType: k.itemType,
        ...(category ? { category, subcategory } : {}),
        description: body.slice(0, 600),
        imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(weightGrams != null ? { weightGrams } : {}),
        ...(Object.keys(attributes).length ? { attributes } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({
        network: "direct", region: "global",
        merchantId: "direct-gsi", merchantName: "GSI Outdoors",
        productId: doc._id, deepLink, priority: 0,
      });
      created++;
    }
  }
  console.log(`\nby type: ${JSON.stringify(byType)}`);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created (of ${KEEPERS.length} keepers)`);
  await mongoose.disconnect();
})();
