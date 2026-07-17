/**
 * curate-jetboil.js — Jetboil (jetboil.co.uk), Shopify open feed.
 *
 * The UK store (jetboil.co.uk) has an OPEN `/products.json` (28 products, single
 * vendor "JetBoil"). This reverses the stale memory note that Jetboil was an
 * Incapsula bot-wall / manual-entry backlog — that was the US site
 * (jetboil.com, now jetboil.johnsonoutdoors.com, NOT Shopify). The UK site is a
 * clean Shopify feed and is used here.
 *
 * WEIGHTS: the feed's variant `grams` is 0 on every product. Real weights live
 * in a "Specifications" block or in the "Features" prose of each product's
 * body_html — but only SOME products carry it (the others JS-hydrate their spec
 * table from a metafield the theme fetches client-side, invisible to any static
 * scrape of jetboil.co.uk, jetboil.com/johnsonoutdoors, or products.json). So
 * weights were hand-read from body_html where present, and left NULL + flagged
 * for review where the brand never exposes them in scrapeable form. NOT
 * fabricated (per the standing catalog rule: real weights or null + TODO).
 *   Weighted (7): TrailCook 2.0L 630g, TrailCook 1.2L 550g, Flash 1.0L 371g,
 *     Zip 0.8L 324g, Stash 201g (7.1oz prose), MicroMo 340g (12oz prose),
 *     MightyMo 94g (3.3oz prose).
 *   NULL + review (4): SuMo, MiniMo, 1.5L Ceramic Pot, Summit Skillet — no
 *     published weight reachable from any static source. User can enter via the
 *     admin editor.
 *
 * VARIANTS: none. Every keeper is a single configuration. COLOR is collapsed per
 * the locked standard (Jetboil lists each colorway as a SEPARATE Shopify product,
 * not an on-page variant selector): Flash 1.0L had 5 colorway listings (Duck Camo/
 * JavaKit-Topo/Ocean-Topo/Mountainscape/Carbon) -> ONE "Flash 1.0L" (source =
 * Carbon); Zip 0.8L had 2 (Duck Camo + plain) -> ONE "Zip 0.8L" (source = plain);
 * MiniMo had 2 (Sunset + Carbon) -> ONE "MiniMo" (source = Carbon). Volume is
 * product IDENTITY (kept in the name), not a variant axis.
 *
 * TYPING: all 9 integrated/stand-alone canister systems -> "Stove (Canister)"
 * (Kitchen & Cooking / Stoves). The 2 cookware pieces -> "Backpacking Pot"
 * (Kitchen & Cooking / Cookware) — Summit Skillet is a frying pan (no meaningful
 * pot volume) but "Backpacking Pot" is the catalog's only cookware bucket; its
 * volumeMl is left unset (lenientAttributes permits) and the description says it's
 * a skillet.
 *
 * EXCLUDED (17 of 28 feed products), per the standing archive-noise defaults:
 *   - Genesis Basecamp System — 4.1kg 2-burner BASECAMP system, explicitly car-
 *     camping / group base camp, not backpacking (car-camping exclusion rule).
 *   - System Accessories (6): Trailware Kit, Trailware Spoon, Pot Support,
 *     Pot Support 2.0, Hanging Kit 2.0, Coffee Press — stove-system accessories/
 *     parts.
 *   - Fuel & Fuel Accessories (4): Jetpower Fuel (consumable canister),
 *     Fuel Can Stabiliser 2.0, JetGauge (fuel gauge tool), CrunchIt (canister
 *     recycling tool).
 *   Plus the 6 collapsed colorway dupes fold into their kept item (not archived).
 *   28 = 11 keep + 6 collapsed color dupes + 11 excluded.
 *
 * OFFERS: direct, unmonetized jetboil.co.uk product-page links
 * (merchantId "direct-jetboil"). No affiliate program wired.
 *
 *   node src/scripts/curate-jetboil.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.jetboil.co.uk/products.json?limit=250";
const SITE = "https://www.jetboil.co.uk/products/";

const CATEGORY_BY_TYPE = {
  "Stove (Canister)": ["Kitchen & Cooking", "Stoves"],
  "Backpacking Pot": ["Kitchen & Cooking", "Cookware"],
};

// name = catalog name; src = feed product title used for images + deepLink;
// weightGrams null = not published anywhere scrapeable (flag for review).
const KEEPERS = [
  {
    name: "TrailCook 2.0L",
    src: "TrailCook 2.0L",
    itemType: "Stove (Canister)",
    weightGrams: 630,
    attributes: { outputBtu: 6000, regulatorValve: true, igniterBuiltIn: true, potSupport: "Integrated" },
    description:
      "A regulated 2.0L canister cooking system sized for groups of 2–4, with a self-centering pot support, ceramic-coated FluxRing cook pot and insulating cozy, and turn-and-click igniter for precise simmer-to-boil heat control.",
  },
  {
    name: "TrailCook 1.2L",
    src: "TrailCook 1.2L Sunset",
    itemType: "Stove (Canister)",
    weightGrams: 550,
    attributes: { outputBtu: 6000, regulatorValve: true, igniterBuiltIn: true, potSupport: "Integrated" },
    description:
      "A regulated 1.2L canister cooking system with a self-centering pot support, ceramic-coated FluxRing cook pot and insulating cozy, and turn-and-click igniter for precise simmer-to-boil heat control.",
  },
  {
    name: "Flash 1.0L",
    src: "Flash™ 1.0L - Carbon",
    itemType: "Stove (Canister)",
    weightGrams: 371,
    attributes: { outputBtu: 5300, regulatorValve: false, igniterBuiltIn: true, potSupport: "Integrated" },
    description:
      "Jetboil's fast-boil 1.0L integrated canister system — a FluxRing cooking pot with insulating cozy, turn-and-click igniter, and a thermochromatic heat indicator for blistering boil times.",
  },
  {
    name: "Zip 0.8L",
    src: "Zip™ 0.8L",
    itemType: "Stove (Canister)",
    weightGrams: 324,
    attributes: { outputBtu: 5300, regulatorValve: false, potSupport: "Integrated" },
    description:
      "A simple, lightweight 0.8L integrated canister boiling system with FluxRing technology; the bottom cover doubles as a measuring cup and bowl. Focused on the backcountry boiling essentials.",
  },
  {
    name: "SuMo",
    src: "SuMo® - Carbon",
    itemType: "Stove (Canister)",
    weightGrams: null, // no published weight reachable from any static source
    attributes: { regulatorValve: true, igniterBuiltIn: true, potSupport: "Integrated" },
    description:
      "A regulated group cooking system with a large 1.8L FluxRing cooking cup and insulating cozy — a higher cup-to-fuel capacity for cooking for you and friends, with push-button igniter and simmer-to-boil regulator control.",
  },
  {
    name: "MiniMo",
    src: "MiniMo® - Carbon",
    itemType: "Stove (Canister)",
    weightGrams: null, // no published weight reachable from any static source
    attributes: { regulatorValve: true, igniterBuiltIn: true, potSupport: "Integrated" },
    description:
      "A regulated personal canister cooking system with a 1L short FluxRing cook pot, metal handles, and a low spoon-angle cup optimized for eating; incremental simmer-to-boil heat control.",
  },
  {
    name: "MicroMo",
    src: "MicroMo®",
    itemType: "Stove (Canister)",
    weightGrams: 340, // "12 oz" prose in body_html
    attributes: { regulatorValve: true, igniterBuiltIn: true, potSupport: "Integrated" },
    description:
      "Jetboil's lightest regulated cooking system — a 0.8L FluxRing cooking cup with insulating cozy, push-button igniter, and simmer-to-boil regulator control that stows compactly.",
  },
  {
    name: "MightyMo",
    src: "MightyMo®",
    itemType: "Stove (Canister)",
    weightGrams: 94, // "3.3 ounces" prose in body_html
    attributes: { regulatorValve: true, igniterBuiltIn: true, potSupport: "Folding Arms" },
    description:
      "A compact, regulated stand-alone canister burner with a four-turn regulator for precise simmer-to-boil control and a push-button igniter; accommodates FluxRing pots and skillets (sold separately).",
  },
  {
    name: "Stash",
    src: "Stash™ - Carbon",
    itemType: "Stove (Canister)",
    weightGrams: 201, // "7.1 oz" prose in body_html
    attributes: { regulatorValve: false, potSupport: "Folding Arms" },
    description:
      "Jetboil's lightest system ever — a stand-alone titanium burner with a nesting 0.8L FluxRing cook pot; 40% lighter than the Zip, with a 2.5-minute boil time.",
  },
  {
    name: "1.5L Ceramic FluxRing Cooking Pot",
    src: "1.5L Ceramic FluxRing® Cooking Pot",
    itemType: "Backpacking Pot",
    weightGrams: null, // no published weight reachable from any static source
    attributes: { material: "Aluminum", volumeMl: 1500, coating: "Ceramic", handles: "Folding Handles", lidType: "Solid Lid" },
    description:
      "A 1.5L ceramic-coated FluxRing cook pot for solo or small-group cooking, with folding wire handles and an insulating cozy for safe handling; nonstick for easy cleanup.",
  },
  {
    name: "Summit Skillet",
    src: "Summit Skillet",
    itemType: "Backpacking Pot",
    weightGrams: null, // no published weight reachable (body_html only lists the 21g turner)
    attributes: { material: "Aluminum", coating: "Ceramic", lidType: "No Lid" },
    description:
      "A trail-ready ceramic non-stick skillet (PFOA-free) with varied wall thickness for even heat; includes a turner that nests in the handle. A compatible pot support is required when cooking on a burner.",
  },
];

(async () => {
  const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } });
  const feed = await res.json();
  const products = feed.products || [];
  const byTitle = (t) => products.find((p) => p.title === t);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  for (const m of KEEPERS) {
    const existing = await C.findOne({ name: m.name, brand: /jetboil/i }).lean();
    if (existing) {
      console.log(`${m.name}: already exists — skip`);
      continue;
    }
    const p = byTitle(m.src);
    if (!p) {
      console.log(`   !! ${m.name}: source "${m.src}" not in feed — skip`);
      continue;
    }
    const images = (p.images || []).map((i) => i.src).slice(0, 10);
    const deepLink = SITE + encodeURIComponent(p.handle);
    const [category, subcategory] = CATEGORY_BY_TYPE[m.itemType] || [];

    console.log(
      `${m.name.padEnd(34)} ${m.itemType.padEnd(18)} ${String(m.weightGrams ?? "NULL").padStart(5)}g  imgs:${images.length}  ${p.handle}`
    );

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${m.name}: no images — skip`);
        continue;
      }
      const doc = new C({
        name: m.name,
        brand: "Jetboil",
        itemType: m.itemType,
        ...(category ? { category, subcategory } : {}),
        description: m.description,
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(m.weightGrams != null ? { weightGrams: m.weightGrams } : {}),
        ...(m.attributes ? { attributes: m.attributes } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try {
        await doc.save();
      } catch (e) {
        console.log(`   !! ${m.name}: ${e.message}`);
        continue;
      }
      await O.create({
        network: "direct",
        region: "global",
        merchantId: "direct-jetboil",
        merchantName: "Jetboil",
        productId: doc._id,
        deepLink,
        priority: 0,
      });
      created++;
      console.log(`   ✓ created (_id ${doc._id}) + direct offer`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created (of ${KEEPERS.length} keepers)`);
  await mongoose.disconnect();
})();
