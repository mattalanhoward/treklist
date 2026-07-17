/**
 * curate-primus.js — Primus (primus.us), Shopify open feed.
 *
 * primus.us has an OPEN /products.json (118 products). ⚠ The Shopify `vendor`
 * field reads "Silva" on ~all products — that's the parent/distributor (Fenix
 * Outdoor / Silva Sweden), NOT a resale brand: every product is Primus gear
 * (stoves, cookware, fuel, lanterns). So brand = "Primus" throughout; nothing to
 * vendor-filter out.
 *
 * SCOPE (user decision 2026-07-17): BACKPACKING CORE only — backpacking stoves
 * (canister + multi-fuel + integrated systems), backpacking cookware (Ti/alu
 * pots, pans, kettles), fuel canisters, and sporks/mugs. SKIPPED: the CampFire/
 * OpenFire stainless car-camping cookware, 2-burner camp stoves (Profile/Kinjia/
 * Tupike/Alika/Onja/Kuchoma), fire pits, gas lanterns, and the ~32 spare-part
 * listings (jet nipples/o-rings/gaskets/service kits/igniter & hose replacements)
 * — 38 keepers of 118.
 *
 * WEIGHTS: the feed's variant `grams` is empty/wrong on nearly everything (a few
 * carry the canister or case-pack shipping weight). Real weights live in each
 * PDP's spec `<table>` (`<th>Weight g</th><td>230</td>` rows, server-rendered),
 * so every weight below was read from the PDP spec table (2 newer Lite Ultra
 * systems whose table is JS-hydrated were read from their PDP prose: 240g / 290g).
 * Baked inline here (keyed by handle) — the feed is only used live for images,
 * deep links, names, and descriptions.
 *
 * TYPING: OmniLite Ti (runs gas + liquid) -> Stove (Liquid Fuel), fuelCompat
 * "Multi-Fuel (incl. Canister)". All other stoves incl. integrated pot+burner
 * systems -> Stove (Canister) (the Jetboil-system precedent; potSupport
 * "Integrated" for systems, "Folding Arms" for stand-alone burners). outputBtu
 * derived from the spec's Power W (W x 3.412). Pots/pans/kettles -> Backpacking
 * Pot (the only cookware bucket; frying pans keep volumeMl unset + a diameter).
 * TrailSpork/TrailCutlery -> Utensil; mugs -> Coffee Mug; the 230g gas canister
 * -> Stove Fuel (fuelType Isobutane/Propane, volumeG 230; item weight left null —
 * the full-canister weight isn't published, the 230 g is net fuel content).
 *
 * OFFERS: direct, unmonetized primus.us product-page links
 * (merchantId "direct-primus"). No affiliate wired.
 *
 *   node src/scripts/curate-primus.js [--commit]
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
const FEED = "https://primus.us/products.json?limit=250";
const SITE = "https://primus.us/products/";

// weightGrams read from PDP spec tables; itemType + attributes curated.
const KEEPERS = [
  { handle:"omnilite-stove-ti", itemType:"Stove (Liquid Fuel)", weightGrams:230, attributes:{"fuelCompatibility":"Multi-Fuel (incl. Canister)","pumpIncluded":true,"outputBtu":8871} },
  { handle:"easyfuel-stove-incl-piezo-duo", itemType:"Stove (Canister)", weightGrams:385, attributes:{"outputBtu":10236,"igniterBuiltIn":true,"potSupport":"Folding Arms"} },
  { handle:"lite-ultra-stove-system-0-8-l", itemType:"Stove (Canister)", weightGrams:240, attributes:{"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"lite-ultra-xl-stove-system-1-2-l", itemType:"Stove (Canister)", weightGrams:290, attributes:{"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"sip-power-gas-230-canister", itemType:"Stove Fuel", weightGrams:null, attributes:{"fuelType":"Isobutane/Propane","volumeG":230} },
  { handle:"micron-iii-stove", itemType:"Stove (Canister)", weightGrams:58, attributes:{"outputBtu":8871,"igniterBuiltIn":false,"potSupport":"Folding Arms"} },
  { handle:"essential-stove-set-1-3l", itemType:"Stove (Canister)", weightGrams:822, attributes:{"outputBtu":6824,"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"classic-trail", itemType:"Stove (Canister)", weightGrams:233, attributes:{"outputBtu":9554,"igniterBuiltIn":false,"potSupport":"Folding Arms"} },
  { handle:"lite-plus-stove-system-green", itemType:"Stove (Canister)", weightGrams:402, attributes:{"outputBtu":5118,"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"gravity-stove", itemType:"Stove (Canister)", weightGrams:250, attributes:{"outputBtu":10236,"igniterBuiltIn":false,"potSupport":"Folding Arms"} },
  { handle:"essential-pot-set-1-3l", itemType:"Backpacking Pot", weightGrams:503, attributes:{"material":"Aluminum","volumeMl":1300,"coating":"Uncoated","lidType":"Solid Lid"} },
  { handle:"litech-pot-set-1-3l", itemType:"Backpacking Pot", weightGrams:456, attributes:{"material":"Aluminum","volumeMl":1300,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"litech-pot-set-2-3l", itemType:"Backpacking Pot", weightGrams:574, attributes:{"material":"Aluminum","volumeMl":2300,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"lite-xl-pot-1-0-l-34-oz", itemType:"Backpacking Pot", weightGrams:325, attributes:{"material":"Aluminum","volumeMl":1000,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"koppen-mug-0-3l-black", itemType:"Coffee Mug", weightGrams:214, attributes:{"volumeMl":300,"material":"Stainless Steel"} },
  { handle:"express-stove-piezo", itemType:"Stove (Canister)", weightGrams:83, attributes:{"outputBtu":8871,"igniterBuiltIn":true,"potSupport":"Folding Arms"} },
  { handle:"essential-trail-stove", itemType:"Stove (Canister)", weightGrams:112, attributes:{"igniterBuiltIn":false,"potSupport":"Folding Arms"} },
  { handle:"lite-stove-system", itemType:"Stove (Canister)", weightGrams:350, attributes:{"outputBtu":5118,"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"lite-xl-stove-system", itemType:"Stove (Canister)", weightGrams:460, attributes:{"outputBtu":5800,"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"essential-trail-kit", itemType:"Stove (Canister)", weightGrams:382, attributes:{"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"express-spider-stove", itemType:"Stove (Canister)", weightGrams:200, attributes:{"outputBtu":6824,"igniterBuiltIn":false,"potSupport":"Folding Arms"} },
  { handle:"litech-coffee-tea-kettle-0-9l", itemType:"Backpacking Pot", weightGrams:178, attributes:{"material":"Aluminum","volumeMl":900,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"4-season-mug-0-3l", itemType:"Coffee Mug", weightGrams:150, attributes:{"volumeMl":300,"material":"Stainless Steel"} },
  { handle:"litech-coffee-tea-kettle-1-5l", itemType:"Backpacking Pot", weightGrams:210, attributes:{"material":"Aluminum","volumeMl":1500,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  // frying pans: diameter (21/25cm) stays in the name — the schema's diameterCm caps at 20 (pot-sized)
  { handle:"litech-frying-pan-21cm", itemType:"Backpacking Pot", weightGrams:290, attributes:{"material":"Aluminum","coating":"Hard Anodized","lidType":"No Lid","handles":"Folding Handles"} },
  { handle:"litech-frying-pan-25cm", itemType:"Backpacking Pot", weightGrams:375, attributes:{"material":"Aluminum","coating":"Hard Anodized","lidType":"No Lid","handles":"Folding Handles"} },
  { handle:"essential-pot-set-2-3l", itemType:"Backpacking Pot", weightGrams:639, attributes:{"material":"Aluminum","volumeMl":2300,"coating":"Uncoated","lidType":"Solid Lid"} },
  { handle:"primetech-pot-set-1-3l", itemType:"Backpacking Pot", weightGrams:524, attributes:{"material":"Aluminum","volumeMl":1300,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"primetech-pot-set-2-3l", itemType:"Backpacking Pot", weightGrams:735, attributes:{"material":"Aluminum","volumeMl":2300,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"trailspork-titanium", itemType:"Utensil", weightGrams:22, attributes:{"utensilType":"Spork","material":"Titanium"} },
  { handle:"trailcutlery-aluminium", itemType:"Utensil", weightGrams:45, attributes:{"utensilType":"Multi-Tool","material":"Aluminum"} },
  { handle:"trek-pot-1-0l", itemType:"Backpacking Pot", weightGrams:270, attributes:{"material":"Aluminum","volumeMl":1000,"coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"trek-pot-set", itemType:"Backpacking Pot", weightGrams:410, attributes:{"material":"Aluminum","coating":"Hard Anodized","lidType":"Solid Lid"} },
  { handle:"essential-trek-pot-1-0l", itemType:"Backpacking Pot", weightGrams:270, attributes:{"material":"Aluminum","volumeMl":1000,"coating":"Uncoated","lidType":"Solid Lid"} },
  { handle:"essential-trek-pot-set", itemType:"Backpacking Pot", weightGrams:410, attributes:{"material":"Aluminum","coating":"Uncoated","lidType":"Solid Lid"} },
  { handle:"kasa-mug-stainless-steel", itemType:"Coffee Mug", weightGrams:200, attributes:{"volumeMl":300,"material":"Stainless Steel"} },
  { handle:"primetech-stove-set-1-3l", itemType:"Stove (Canister)", weightGrams:903, attributes:{"outputBtu":6824,"potSupport":"Integrated","igniterBuiltIn":false} },
  { handle:"primetech-stove-set-2-3l", itemType:"Stove (Canister)", weightGrams:1060, attributes:{"outputBtu":6824,"potSupport":"Integrated","igniterBuiltIn":false} },
];

const stripHtml = (h) =>
  (h || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&deg;/g, "°")
    .replace(/\s+/g, " ")
    .trim();

(async () => {
  // Cloudflare 503s node fetch; curl passes. Retry a few times.
  let raw;
  for (let i = 0; i < 4 && !raw; i++) {
    const out = execFileSync("curl", ["-s", "-H", "User-Agent: Mozilla/5.0", FEED], { maxBuffer: 32 * 1024 * 1024 }).toString();
    if (out.trim().startsWith("{")) raw = out;
    else execFileSync("sleep", ["3"]);
  }
  if (!raw) throw new Error("feed fetch kept returning a challenge — retry later");
  const products = (JSON.parse(raw).products) || [];
  const byHandle = (h) => products.find((p) => p.handle === h);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  const byType = {};
  for (const m of KEEPERS) {
    const p = byHandle(m.handle);
    if (!p) { console.log(`   !! ${m.handle}: not in feed — skip`); continue; }
    byType[m.itemType] = (byType[m.itemType] || 0) + 1;
    const name = p.title.trim();
    const existing = await C.findOne({ name, brand: /primus/i }).lean();
    if (existing) { console.log(`${name}: exists — skip`); continue; }

    const { category, subcategory } = categoryForItemType(m.itemType, name) || {};
    const images = (p.images || []).map((i) => i.src).slice(0, 10);
    const deepLink = SITE + p.handle;
    let description = stripHtml(p.body_html).slice(0, 600);
    if (m.itemType === "Stove Fuel") description += "\n\n* Weight shown is 230 g net fuel content; the full canister weighs more.";

    console.log(`${name.slice(0, 40).padEnd(40)} ${m.itemType.padEnd(20)} ${String(m.weightGrams ?? "NULL").padStart(5)}g imgs:${images.length}`);

    if (COMMIT) {
      if (!images.length) { console.log(`   !! ${name}: no images — skip`); continue; }
      const doc = new C({
        name,
        brand: "Primus",
        itemType: m.itemType,
        ...(category ? { category, subcategory } : {}),
        description,
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(m.weightGrams != null ? { weightGrams: m.weightGrams } : {}),
        ...(m.attributes ? { attributes: m.attributes } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); }
      catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({
        network: "direct", region: "global",
        merchantId: "direct-primus", merchantName: "Primus",
        productId: doc._id, deepLink, priority: 0,
      });
      created++;
    }
  }
  console.log(`\nby type: ${JSON.stringify(byType)}`);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created (of ${KEEPERS.length} keepers)`);
  await mongoose.disconnect();
})();
