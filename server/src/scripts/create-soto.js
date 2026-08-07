/**
 * create-soto.js — SOTO (sotooutdoors.com), WooCommerce open Store API. Scope (user,
 * 2026-08-07): all relevant SOTO products — Stoves (7) + Cookware (pots/mugs/cook sets)
 * + a chosen set of Accessories (Pocket Spork, Micro Lifter, Navi Duo Handle, 2 Cozies;
 * the 2 Titanium Mugs come in via Cookware). NO parts, NO lanterns/lighters/fuel-bottles.
 *
 * ⚠ The Woo feed `weight` (oz) is SHIPPING weight (Amicus reads 8oz but is 75g). REAL
 * weights + specs were hand-read from each product's description and encoded here.
 * Data-quality note: the Regulator (ST-310) listing says "350 Grams" — a clear typo
 * (the ST-310 is the well-known ~90g stove; likely contaminated by the TriTrail US350
 * model number) → used 90g. Explicit allow-list by handle (skips parts by construction).
 *
 *   node src/scripts/create-soto.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const BRAND = "SOTO";
const stove = (btu, igniter, regulator, windscreen = "Not Included") => ({ outputBtu: btu, igniterBuiltIn: igniter, potSupport: "Folding Arms", windscreen, regulatorValve: regulator });

const KEEP = {
  // Stoves (Stove (Canister))
  "amicus-without-igniter": { name: "Amicus Stove without Igniter", type: "Stove (Canister)", wt: 75, attrs: stove(11000, false, false) },
  "amicus-stove-with-igniter": { name: "Amicus Stove with Igniter", type: "Stove (Canister)", wt: 81, attrs: stove(11000, true, false) },
  "windmaster-stove-with-4flex": { name: "WindMaster Stove with 4Flex", type: "Stove (Canister)", wt: 67, attrs: stove(11000, true, true, "Integrated") },
  "st-310-regulator-stove-3": { name: "Regulator Stove", type: "Stove (Canister)", wt: 90, attrs: stove(9900, true, true), note: "SOTO ST-310. (The web listing states 350 g — a clear typo; the ST-310's published weight is ~90 g.)" },
  "dealer-resources-6": { name: "TriTrail Stove", type: "Stove (Canister)", wt: 135, attrs: stove(8700, true, true), note: "SOTO ST-US350." },
  "dealer-resources": { name: "Fusion Trek Stove", type: "Stove (Canister)", wt: 182, attrs: stove(11000, true, true) },
  "new-river-pot-amicus-with-igniter-stove": { name: "New River Pot + Amicus with Igniter Stove", type: "Stove (Canister)", wt: null, attrs: stove(11000, true, false), note: "Bundle: SOTO New River pot + Amicus (with igniter) stove; combined weight not published." },
  // Cookware — mugs (Coffee Mug)
  "titanium-mug450": { name: "Titanium Mug 450", type: "Coffee Mug", wt: 53, attrs: { volumeMl: 450, material: "Titanium" } },
  "dealer-resources-8": { name: "Titanium Mug 600", type: "Coffee Mug", wt: 64, attrs: { volumeMl: 600, material: "Titanium" } },
  "aero-mug-450-ml-2": { name: "Aero Mug, 450 ml", type: "Coffee Mug", wt: 116, attrs: { volumeMl: 450, material: "Stainless Steel" } },
  // Cookware — pots / cook sets (Backpacking Pot)
  "titanium-pot-1100": { name: "Titanium Pot 1100ml", type: "Backpacking Pot", wt: 62, attrs: { volumeMl: 1100, material: "Titanium" } },
  "sod-530-titanium-pot-750-2": { name: "Titanium Pot 750ml", type: "Backpacking Pot", wt: 60, attrs: { volumeMl: 750, material: "Titanium" } },
  "new-river-pot-2": { name: "New River Pot", type: "Backpacking Pot", wt: 118, attrs: { volumeMl: 473, material: "Aluminum" } },
  "thermostack-cook-set-combo": { name: "Thermostack Cook Set Combo", type: "Backpacking Pot", wt: 290, attrs: { material: "Stainless Steel" } },
  "thermostack-cook-set-original": { name: "Thermostack Cook Set", type: "Backpacking Pot", wt: 182, attrs: { material: "Stainless Steel" } },
  "dealer-resources-2": { name: "Navigator Camping Cookware Set", type: "Backpacking Pot", wt: null, attrs: {} },
  "thermolite-pot-set": { name: "ThermoLite Cook Set", type: "Backpacking Pot", wt: 91, attrs: { volumeMl: 750, material: "Titanium" } },
  // Accessories (user-chosen)
  "pocket-spork": { name: "Pocket Spork", type: "Utensil", wt: 21, attrs: { utensilType: "Spork", foldable: true } },
  "micro-lifter": { name: "Micro Lifter", type: "Other", wt: 13, cat: ["Kitchen & Cooking", "Cookware"], note: "Pot lifter / gripper." },
  "dealer-resources-4": { name: "Navi Duo Handle", type: "Other", wt: 38, cat: ["Kitchen & Cooking", "Cookware"], note: "Detachable pot/pan handle." },
  "dealer-resources-10": { name: "Cozy 1100", type: "Other", wt: 46, cat: ["Kitchen & Cooking", "Cookware"], note: "Insulating cozy for the 1100 ml pot." },
  "dealer-resources-9": { name: "Cozy 750", type: "Other", wt: 40, cat: ["Kitchen & Cooking", "Cookware"], note: "Insulating cozy for the 750 ml pot." },
};

(async () => {
  const feed = await (await fetch("https://sotooutdoors.com/wp-json/wc/store/v1/products?per_page=100", { headers: { "User-Agent": UA } })).json();
  const byHandle = Object.fromEntries(feed.map((p) => [p.permalink.replace(/\/$/, "").split("/").pop(), p]));

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let done = 0; const byType = {};

  for (const [handle, cfg] of Object.entries(KEEP)) {
    const p = byHandle[handle];
    if (!p) { console.log(`?? NOT IN FEED: ${handle}`); continue; }
    const [cat, sub] = cfg.cat || (() => { const r = categoryForItemType(cfg.type, cfg.name); return [r.category, r.subcategory]; })();
    const images = (p.images || []).map((i) => i.src).slice(0, 6);
    const body = (p.description || p.short_description || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim().replace(/^\s*(Question:|Product #:)[^.]*\.?\s*/i, "").slice(0, 340);
    const desc = `${body}${cfg.note ? " " + cfg.note : ""}`;

    byType[cfg.type] = (byType[cfg.type] || 0) + 1;
    console.log(`${cfg.type.padEnd(18)} ${cfg.name.slice(0, 40).padEnd(40)} ${cfg.wt ?? "null"}g  ${cat}/${sub}`);
    if (COMMIT) {
      if (await C.findOne({ name: cfg.name, brand: BRAND })) { console.log("  exists — skip"); continue; }
      if (!images.length) { console.log("  !! no images — skip"); continue; }
      const doc = new C({
        name: cfg.name, brand: BRAND, itemType: cfg.type, category: cat, subcategory: sub,
        description: desc, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(cfg.wt != null ? { weightGrams: cfg.wt } : {}), attributes: cfg.attrs || {},
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`  !! ${cfg.name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-soto", merchantName: BRAND, productId: doc._id, deepLink: p.permalink, priority: 0 });
      done++;
    }
  }
  console.log(`\nby itemType:`, JSON.stringify(byType));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? done + " created" : Object.keys(KEEP).length + " items"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
