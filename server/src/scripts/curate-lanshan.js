/**
 * curate-lanshan.js — Lanshan (lanshantent.com), Shopify open feed.
 *
 * Tiny, focused single-brand store: 6 products, ALL backpacking-relevant
 * (4 trekking-pole UL tents + a footprint + a stake kit) — nothing to archive.
 *
 * VARIANTS/COLOR: the 4 tents list Color as their only variant axis -> collapsed
 * to a single item each (color never a variant). Volume/capacity is in the name.
 * The footprint has a real Size axis (1 Person / 2 Person) -> kept as a variant.
 *
 * WEIGHTS — ⚠ the feed's `grams` is UNRELIABLE per product:
 *   - Tents: feed grams (790/690/1100/910) are plausible per-model MINIMUM
 *     (trail) weights, consistent with Lanshan's known specs and internally
 *     coherent (Pro versions lighter than standard, matching the body copy's
 *     "Pro drops 0.5–0.6 lb"). USED as the tent weight.
 *   - Footprint: feed grams (800g 1P / 1200g 2P) are PROVABLY bogus shipping/
 *     placeholder numbers — the body copy states the real weight is "5.3 oz
 *     (150g)". Used 150g (1-Person, the published figure); the 2-Person weight
 *     is NOT separately published -> left null (no fabrication) + disclosed.
 *   - Stakes: feed grams (1000g) and the body's "997g" are the tent weight
 *     boilerplate copy-pasted onto the accessory (a 9× 7000-series Y-beam stake
 *     kit is ~100–130g, not ~1kg) -> left null + flagged, not fabricated.
 *
 * TYPING: 4 tents -> Backpacking Tent (Shelter/Tents), tentType "Trekking Pole
 * Tent" (Lanshans pitch on the user's own poles), double-wall (mesh inner + fly);
 * footprint -> Ground Sheet (Shelter/Ground Sheet); stake kit -> Tent Stakes
 * (Shelter/Tent Stakes).
 *
 * OFFERS: direct jetboil-style unmonetized lanshantent.com product-page links
 * (merchantId "direct-lanshan"). One item-level offer each (color/size is an
 * on-page selector -> no per-variant links, the HMG/Zpacks pattern).
 *
 *   node src/scripts/curate-lanshan.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://lanshantent.com/products.json?limit=250";
const SITE = "https://lanshantent.com/products/";

const CATEGORY_BY_TYPE = {
  "Backpacking Tent": ["Shelter", "Tents"],
  "Ground Sheet": ["Shelter", "Ground Sheet"],
  "Tent Stakes": ["Shelter", "Tent Stakes"],
};

const KEEPERS = [
  {
    name: "Lanshan 1",
    handle: "lanshan-1-ultralight-backpacking-tent",
    itemType: "Backpacking Tent",
    weightGrams: 790,
    attributes: {
      capacity: "1-Person",
      tentType: "Trekking Pole Tent",
      seasonRating: "3-Season",
      wallType: "Double Wall",
      doors: 1,
      flyMaterial: "15D silnylon (PU 5000mm)",
      floorMaterial: "20D nylon (PU 6000mm)",
      footprintIncluded: false,
    },
    description:
      "A single-pole (trekking-pole) ultralight 1-person tent with a seam-taped 15D silnylon rainfly (5000mm) and 20D bathtub floor (6000mm); mesh inner for double-wall condensation control. Pitches with one trekking pole.",
  },
  {
    name: "Lanshan 1 Pro",
    handle: "lanshan-1-pro-ultralight-backpacking-tent",
    itemType: "Backpacking Tent",
    weightGrams: 690,
    attributes: {
      capacity: "1-Person",
      tentType: "Trekking Pole Tent",
      seasonRating: "3-Season",
      wallType: "Double Wall",
      doors: 1,
      flyMaterial: "20D dual-sided silicone nylon",
      floorMaterial: "20D nylon (PU 5000mm)",
      footprintIncluded: false,
    },
    description:
      "The Pro version of the Lanshan 1: a lighter, more durable 20D dual-sided silicone-nylon build (fly and floor). ⚠ Ships un-seam-sealed — dual-silicone fabric can't be factory-taped, so the seams need field sealing (SilNet/Seam Grip+SIL, not included).",
  },
  {
    name: "Lanshan 2",
    handle: "lanshan-2-ultralight-tent",
    itemType: "Backpacking Tent",
    weightGrams: 1100,
    attributes: {
      capacity: "2-Person",
      tentType: "Trekking Pole Tent",
      seasonRating: "3-Season",
      wallType: "Double Wall",
      doors: 2,
      vestibules: 2,
      flyMaterial: "15D silnylon (PU 5000mm)",
      floorMaterial: "20D nylon (PU 6000mm)",
      footprintIncluded: false,
    },
    description:
      "A two-pole (trekking-pole) ultralight 2-person tent with dual doors and vestibules, a seam-taped 15D silnylon rainfly (5000mm) and 20D bathtub floor (6000mm); mesh inner for double-wall condensation control.",
  },
  {
    name: "Lanshan 2 Pro",
    handle: "lanshan-2-pro-ultralight-tent",
    itemType: "Backpacking Tent",
    weightGrams: 910,
    attributes: {
      capacity: "2-Person",
      tentType: "Trekking Pole Tent",
      seasonRating: "3-Season",
      wallType: "Double Wall",
      doors: 2,
      vestibules: 2,
      flyMaterial: "20D dual-sided silicone nylon",
      floorMaterial: "20D nylon (PU 5000mm)",
      footprintIncluded: false,
    },
    description:
      "The Pro version of the Lanshan 2: a lighter, more durable 20D dual-sided silicone-nylon build (fly and floor), dual doors/vestibules. ⚠ Ships un-seam-sealed — dual-silicone fabric can't be factory-taped, so the seams need field sealing (SilNet/Seam Grip+SIL, not included).",
  },
  {
    name: "Lanshan Tent Footprint",
    handle: "tent-footprint-for-lanshan",
    itemType: "Ground Sheet",
    axisName: "Size",
    defaultKey: "1 Person",
    variants: [
      { key: "1 Person", weightGrams: 150 }, // published "5.3 oz (150g)"
      { key: "2 Person", weightGrams: null }, // 2P weight not separately published
    ],
    attributes: { material: "Silnylon" },
    description:
      "A 40D silicone-coated nylon footprint (PU 4000mm) cut for the Lanshan 1/2 tents, protecting the tent floor from abrasion.\n\n* Listed weight (150g) is the 1-Person size; the 2-Person size is larger and its weight is not separately published.",
  },
  {
    name: "Lanshan Y-Beam Tent Stakes (Kit of 9)",
    handle: "lanshan-2-person-tent-stakes",
    itemType: "Tent Stakes",
    weightGrams: null, // feed 1000g / body "997g" = boilerplate tent weight, not the stakes
    attributes: { material: "7000-series aluminum" },
    description:
      "A kit of nine 7000-series aluminum Y-beam tent stakes with a reflective pull loop, carry bag, and repair patches. Y-profile bites and holds across soil conditions.\n\n* Lanshan does not publish a reliable weight for this stake kit (its listing repeats the tent's weight); a typical 9-stake 7000-series Y-beam set is roughly 100–130g.",
  },
];

(async () => {
  const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } });
  const feed = await res.json();
  const products = feed.products || [];
  const byHandle = (h) => products.find((p) => p.handle === h);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  for (const m of KEEPERS) {
    const existing = await C.findOne({ name: m.name, brand: /lanshan/i }).lean();
    if (existing) {
      console.log(`${m.name}: already exists — skip`);
      continue;
    }
    const p = byHandle(m.handle);
    if (!p) {
      console.log(`   !! ${m.name}: handle "${m.handle}" not in feed — skip`);
      continue;
    }
    const images = (p.images || []).map((i) => i.src).slice(0, 10);
    const deepLink = SITE + p.handle;
    const [category, subcategory] = CATEGORY_BY_TYPE[m.itemType] || [];

    let axes = [];
    let variants = [];
    let defWeight = m.weightGrams;
    if (m.axisName) {
      axes = [{ name: m.axisName, values: m.variants.map((v) => v.key) }];
      variants = m.variants.map((v) => ({
        key: v.key,
        options: { [m.axisName]: v.key },
        ...(v.weightGrams != null ? { weightGrams: v.weightGrams } : {}),
      }));
      const def = variants.find((v) => v.key === m.defaultKey) || variants[0];
      defWeight = m.variants.find((v) => v.key === (m.defaultKey || variants[0].key))?.weightGrams ?? null;
    }

    console.log(
      `${m.name.padEnd(38)} ${m.itemType.padEnd(17)} ${String(defWeight ?? "NULL").padStart(5)}g  imgs:${images.length}  ${
        m.axisName ? `${m.axisName}[${m.variants.map((v) => v.key + "=" + (v.weightGrams ?? "?")).join(", ")}]` : ""
      }`
    );

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${m.name}: no images — skip`);
        continue;
      }
      const doc = new C({
        name: m.name,
        brand: "Lanshan",
        itemType: m.itemType,
        ...(category ? { category, subcategory } : {}),
        description: m.description,
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(defWeight != null ? { weightGrams: defWeight } : {}),
        ...(axes.length ? { variantAxes: axes, variants, defaultVariantKey: m.defaultKey } : {}),
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
        merchantId: "direct-lanshan",
        merchantName: "Lanshan",
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
