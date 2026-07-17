/**
 * curate-aarn.js — Aarn (aarnpacks.com), Shopify open feed.
 *
 * Aarn (NZ) makes "Body-Balance" hiking packs — internal-frame packs worn with a
 * pair of front "Balance Pockets" that clip to the shoulder straps to centre the
 * load. A genuinely distinctive niche nothing else in the catalog covers.
 *
 * SOURCE: www.aarnpacks.com has an OPEN /products.json (49 products, Shopify).
 * The feed gives titles/variants/images/handles but NOT usable weights — variant
 * `grams` is 0 on nearly everything. Real weights live on each PDP's spec block
 * (NOT in body_html — the theme renders them client-side), so every weight below
 * was hand-read from the product page. Per the standing rule: real weights or
 * null + TODO, never fabricated.
 *
 * SCOPE (user decision 2026-07-17): packs + balance pockets + hipbelts + tents
 * ONLY. Small accessories (rain covers, bottle/shoulder pouches, straps, spare
 * parts) SKIPPED. Third-party resale (Injinji socks, NOSO patch) SKIPPED. All
 * "- Previous Model" listings SKIPPED (superseded by the "NEW" versions). The
 * duplicate `mountain-magic-50-pro-2025` listing is dropped in favour of the
 * current `mountain-magic-50-pro`.
 *
 * VARIANTS — the packs' Shopify variants are "Back Length × Hipbelt size", but
 * the weight-driving axis is BACK LENGTH only (Aarn quotes pack weight per back
 * length; hipbelt size is a fit adjustment). So packs use a single "Back Length"
 * axis (Short/Medium/Long), matching the HMG/Osprey torso-axis precedent. VOLUME
 * varies by back length on Aarn packs, so each variant carries its own
 * volumeLiters override (base volumeLiters = the default variant's).
 *
 * WEIGHT PRECISION (disclosure rule) — pack weights are the pack BODY "+ liner",
 * excluding the included Balance Pockets; each pack description says so. Balance
 * Pockets are a set of two worn one per shoulder, but Aarn quotes SOME per pair
 * (Compact/Sport/Multi/Fishing) and SOME per single pocket (Expedition/
 * Expedition PRO/Universal/Photo). Rather than fabricate a doubled figure, each
 * pocket is stored with its PUBLISHED number and the unit (pair vs single) is
 * stated in the description — same precedent as the Altra per-single-shoe rule.
 * The Pelvic Form Hipbelt publishes no weight anywhere scrapeable -> null +
 * review flag, all sizes.
 *
 * TYPING:
 *   Backpack (Backpacks & Bags / Backpacking Packs): Mountain Magic 50 PRO,
 *     Effortless Rhythm, Featherlite Freedom, Featherlite Freedom PRO,
 *     Peak Aspiration, Natural Exhilaration, Pace Magic 40, Pace Magic 30.
 *   Daypack (Backpacks & Bags / Day Packs & Accessories): Back Favour 28,
 *     Pace Magic 20, Little Llama 20.
 *   Pack Accessory (Day Packs & Accessories): all Balance Pockets (accessoryType
 *     "Shoulder Pouch", mount "Shoulder Strap") + Pelvic Form Hipbelt.
 *   Backpacking Tent (Shelter / Tents): Aarn 2 Tent.
 *
 * OFFERS: direct, unmonetized aarnpacks.com product-page links
 * (merchantId "direct-aarn"). No affiliate program wired (the jetboil/lanshan
 * direct pattern). One item-level offer each — back length / size is an on-page
 * selector, so no per-variant links.
 *
 *   node src/scripts/curate-aarn.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFileSync } = require("child_process");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.aarnpacks.com/products.json?limit=250";
const SITE = "https://www.aarnpacks.com/products/";

const CATEGORY_BY_TYPE = {
  Backpack: ["Backpacks & Bags", "Backpacking Packs"],
  Daypack: ["Backpacks & Bags", "Day Packs & Accessories"],
  "Pack Accessory": ["Backpacks & Bags", "Day Packs & Accessories"],
  "Backpacking Tent": ["Shelter", "Tents"],
};

// vol = per-variant volumeLiters override (packs). w = per-variant weightGrams.
const KEEPERS = [
  // ---- BACKPACKS ---------------------------------------------------------
  {
    name: "Mountain Magic 50 PRO",
    handle: "mountain-magic-50-pro",
    itemType: "Backpack",
    axisName: "Back Length",
    defaultKey: "Short",
    variants: [
      { key: "Short", w: 1000, vol: 50 },
      { key: "Medium", w: 1060, vol: 50 },
    ],
    attributes: {
      volumeLiters: 50,
      loadCapacityKg: 15,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "70D Robic Gridstop with UHMWPE",
    },
    description:
      "Aarn's flagship Body-Balance pack: 43L in the main body plus a pair of clip-on front Balance Pockets (~7L), with a suspended air-mesh back panel that auto-moulds to your back and holds a ventilating air gap. The front load balances the pack load for an upright, stable carry.\n\n* Weight is the pack body per back length ('+ liner'); the included pair of Balance Pockets adds ~256g.",
  },
  {
    name: "Effortless Rhythm",
    handle: "effortless-rhythm",
    itemType: "Backpack",
    axisName: "Back Length",
    defaultKey: "Medium",
    variants: [
      { key: "Medium", w: 1690, vol: 66 },
      { key: "Long", w: 1754, vol: 72 },
    ],
    attributes: {
      volumeLiters: 66,
      loadCapacityKg: 20,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "500D Nylon Kodra",
    },
    description:
      "A large-volume (66–72L) Body-Balance expedition pack rated to a 20kg load, with a suspended air-mesh back panel and a 500D Kodra body for durability on long carries. Worn with a pair of front Balance Pockets to centre the load.\n\n* Weight is the pack body per back length ('+ liner'), excluding the Balance Pockets.",
  },
  {
    name: "Featherlite Freedom",
    handle: "featherlite-freedom",
    itemType: "Backpack",
    axisName: "Back Length",
    defaultKey: "Medium",
    variants: [
      { key: "Short", w: 1262, vol: 50 },
      { key: "Medium", w: 1351, vol: 55 },
      { key: "Long", w: 1422, vol: 65 },
    ],
    attributes: {
      volumeLiters: 55,
      loadCapacityKg: 17,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
    },
    description:
      "A lightweight (50–65L by back length) Body-Balance pack with a suspended auto-moulding air-mesh back panel, rated to a 17kg load. Aarn's do-everything multi-day pack; carried with a pair of front Balance Pockets.\n\n* Weight is the pack body per back length ('+ liner'); the included pair of Balance Pockets adds ~296g.",
  },
  {
    name: "Featherlite Freedom PRO",
    handle: "featherlite-freedom-pro",
    itemType: "Backpack",
    axisName: "Back Length",
    defaultKey: "Medium",
    variants: [
      { key: "Short", w: 1221, vol: 50 },
      { key: "Medium", w: 1330, vol: 55 },
    ],
    attributes: {
      volumeLiters: 55,
      loadCapacityKg: 15,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "70D Robic Gridstop with UHMWPE",
    },
    description:
      "The PRO build of the Featherlite Freedom in a lighter, tougher 70D Robic Gridstop (UHMWPE) fabric; 50–55L by back length with the suspended auto-moulding air-mesh back panel. Carried with a pair of front Balance Pockets.\n\n* Weight is the pack body per back length ('+ liner'), excluding the Balance Pockets.",
  },
  {
    name: "Peak Aspiration",
    handle: "peak-aspiration",
    itemType: "Backpack",
    axisName: "Back Length",
    defaultKey: "Medium",
    variants: [
      { key: "Short", w: 1452, vol: 50 },
      { key: "Medium", w: 1518, vol: 55 },
      { key: "Long", w: 1580, vol: 60 },
    ],
    attributes: {
      volumeLiters: 55,
      loadCapacityKg: 17,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "500D Nylon Kodra & 100D Robic",
    },
    description:
      "A rugged 50–60L (by back length) Body-Balance mountain pack in a 500D Kodra / 100D Robic body, rated to a 17kg load, with the suspended air-mesh back panel. Carried with a pair of front Balance Pockets.\n\n* Weight is the pack body per back length ('+ liner'), excluding the Balance Pockets.",
  },
  {
    name: "Natural Exhilaration",
    handle: "natural-exhilaration",
    itemType: "Backpack",
    axisName: "Back Length",
    defaultKey: "Short",
    variants: [
      { key: "Short", w: 1102, vol: 33 },
      { key: "Long", w: 1156, vol: 36 },
    ],
    attributes: {
      volumeLiters: 33,
      loadCapacityKg: 14,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "210D Dynatec",
    },
    description:
      "A compact 33–36L (by back length) Body-Balance pack with an Active X-Frame suspended air-mesh back panel, rated to a 14kg load — sized for day hikes to light overnights. Carried with a pair of front Balance Pockets.\n\n* Weight is the pack body per back length ('+ liner'), excluding the Balance Pockets.",
  },
  {
    name: "Pace Magic 40",
    handle: "pace-magic-40-backpack",
    itemType: "Backpack",
    weightGrams: 850,
    attributes: {
      volumeLiters: 40,
      loadCapacityKg: 13.5,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "100D Robic",
    },
    description:
      "A 40L fastpacking pack (850g) with an Active X-Frame suspended air-mesh back panel that flexes with your stride, hip-belt and front mesh pockets for on-the-move access. Rated to a 13.5kg load.",
  },
  {
    name: "Pace Magic 30",
    handle: "pace-magic-30",
    itemType: "Backpack",
    weightGrams: 810,
    attributes: {
      volumeLiters: 30,
      loadCapacityKg: 13.5,
      gender: "Unisex",
      frameType: "Internal Frame",
      backPanelType: "Mesh",
      hipBeltType: "Padded",
      mainFabric: "100D Robic",
    },
    description:
      "A 30L fastpacking pack (810g) with an Active X-Frame suspended air-mesh back panel that flexes with your stride, plus hip-belt and front mesh pockets. Rated to a 13.5kg load.",
  },

  // ---- DAYPACKS ----------------------------------------------------------
  {
    name: "Back Favour 28",
    handle: "back-favour-28",
    itemType: "Daypack",
    weightGrams: 1080,
    attributes: {
      volumeLiters: 28,
      loadCapacityKg: 12,
      gender: "Unisex",
      frameType: "Internal Frame",
      hipBeltType: "Padded",
      mainFabric: "210D Dynatec",
    },
    description:
      "A 28L Body-Balance daypack (1080g) with an Active X-Frame suspended air-mesh back panel, rated to a 12kg load. Carried with front Balance Pockets to keep the load centred and the back upright.",
  },
  {
    name: "Pace Magic 20",
    handle: "pace-magic-20",
    itemType: "Daypack",
    weightGrams: 452,
    attributes: {
      volumeLiters: 20,
      loadCapacityKg: 6,
      gender: "Unisex",
      frameType: "Foam Back",
      hipBeltType: "Webbing Only",
      mainFabric: "100D Robic",
    },
    description:
      "A 20L day pack / running vest (452g) with a removable foam back panel that doubles as a sit pad and front mesh pockets for bottles. A light, close-carrying vest-style pack for fast days.",
  },
  {
    name: "Little Llama 20",
    handle: "little-llama-20-24",
    itemType: "Daypack",
    weightGrams: 680,
    attributes: {
      volumeLiters: 20,
      loadCapacityKg: 10,
      gender: "Unisex",
      frameType: "Internal Frame",
      hipBeltType: "Padded",
      mainFabric: "210D Dynatec",
    },
    description:
      "A 20L Body-Balance daypack (680g) with an Active X-Frame suspended air-mesh back panel that follows your hip movement, rated to a 10kg load. Carried with front Balance Pockets.",
  },

  // ---- BALANCE POCKETS (Pack Accessory) ----------------------------------
  {
    name: "Balance Pockets Compact",
    handle: "balance-pockets-compact",
    itemType: "Pack Accessory",
    weightGrams: 218,
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "Aarn's smallest front Balance Pockets — a pair of clip-on shoulder-strap pockets (6L total; 5L main + 1L mesh) in 100D Robic that centre the load for a stable, upright carry.\n\n* Weight (218g) is for the pair.",
  },
  {
    name: "Balance Pockets Sport",
    handle: "balance-pockets-sport",
    itemType: "Pack Accessory",
    axisName: "Size",
    defaultKey: "Regular (12L)",
    variants: [
      { key: "Small (10L)", w: 296 },
      { key: "Regular (12L)", w: 320 },
    ],
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "A pair of front Balance Pockets in 100D nylon ripstop with outer mesh pockets, clipping to the shoulder straps to centre the load. Small = 10L + 2L mesh, Regular = 12L + 2L mesh.\n\n* Weights are for the pair (incl. liners + sling).",
  },
  {
    name: "Balance Pockets Sport PRO",
    handle: "balance-pockets-sport-pro",
    itemType: "Pack Accessory",
    axisName: "Size",
    defaultKey: "Regular (12L)",
    variants: [
      { key: "Small (10L)", w: 270 },
      { key: "Regular (12L)", w: 300 },
    ],
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "The PRO build of the Sport Balance Pockets in lighter, tougher 70D Robic Gridstop (UHMWPE), with outer mesh pockets. Small = 10L + 2L mesh, Regular = 12L + 2L mesh.\n\n* Weights are for the pair (incl. liners + sling).",
  },
  {
    name: "Balance Pockets Multi PRO",
    handle: "balance-pockets-multi-pro",
    itemType: "Pack Accessory",
    weightGrams: 250,
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "A pair of 7L front Balance Pockets in 70D Robic Gridstop (UHMWPE) — a lighter mid-size option that clips to the shoulder straps to centre the load.\n\n* Weight (250g) is for the pair.",
  },
  {
    name: "Balance Pockets Expedition",
    handle: "balance-pockets-expedition",
    itemType: "Pack Accessory",
    weightGrams: 372,
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "Aarn's largest front Balance Pockets (15L main + 2L mesh each) in 210D ripstop nylon, for big-load expedition carries — clip to the shoulder straps to centre the load.\n\n* Weight (372g) is per SINGLE pocket; a full set is two pockets.",
  },
  {
    name: "Balance Pockets Expedition PRO",
    handle: "balance-pockets-expedition-pro",
    itemType: "Pack Accessory",
    weightGrams: 328,
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "The PRO build of the Expedition Balance Pockets (15L main + 2L mesh each) in lighter 70D Robic Gridstop (UHMWPE) — for big-load expedition carries.\n\n* Weight (328g) is per SINGLE pocket; a full set is two pockets.",
  },
  {
    name: "Universal Balance Pockets",
    handle: "universal-balance-pockets-new",
    itemType: "Pack Accessory",
    axisName: "Size",
    defaultKey: "Regular (12L)",
    variants: [
      { key: "Small (10L)", w: 340 },
      { key: "Regular (12L)", w: 390 },
    ],
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "Front Balance Pockets in hard-wearing 210D Duramax Oxford designed to fit non-Aarn packs via an included crossbody sling. Small = 10L + 1L mesh, Regular = 12L + 2L mesh.\n\n* Weights are per SINGLE pocket; a full set is two pockets.",
  },
  {
    name: "Balance Pockets Fishing",
    handle: "balance-pockets-fishing",
    itemType: "Pack Accessory",
    weightGrams: 494,
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "Front Balance Pockets (12L) in 210D ripstop nylon set up for fly-fishing, with tool and tackle organisation, clipping to the shoulder straps to centre the load.\n\n* Weight (494g) is for the pair.",
  },
  {
    name: "Balance Pockets Photo",
    handle: "balance-pockets-photo-regular",
    itemType: "Pack Accessory",
    weightGrams: 562,
    attributes: { accessoryType: "Shoulder Pouch", mount: "Shoulder Strap" },
    description:
      "Padded front Balance Pockets (12L main + 2L mesh each) in 210D Duramax Oxford for camera bodies and lenses, keeping gear centred and quick to reach.\n\n* Weight (562g) is per SINGLE pocket; a full set is two pockets.",
  },

  // ---- HIPBELT (Pack Accessory) ------------------------------------------
  {
    name: "Pelvic Form Hipbelt",
    handle: "pelvic-form-hipbelt",
    itemType: "Pack Accessory",
    axisName: "Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", w: null }, // hip 64–80cm
      { key: "Medium", w: null }, // hip 81–90cm
      { key: "Large", w: null }, // hip 91–100cm
      { key: "XLarge", w: null }, // hip 101–120cm
    ],
    attributes: { accessoryType: "Other", mount: "Hip Belt" },
    description:
      "Aarn's Pelvic Form replacement/upgrade hipbelt, contoured to sit on the pelvis for load transfer. Sizes by hip measurement: S 64–80cm, M 81–90cm, L 91–100cm, XL 101–120cm.\n\n* Aarn does not publish a weight for this hipbelt; left unset pending a real figure.",
  },

  // ---- TENT --------------------------------------------------------------
  {
    name: "Aarn 2 Tent",
    handle: "aarn-2-tent",
    itemType: "Backpacking Tent",
    weightGrams: 1950,
    attributes: {
      capacity: "2-Person",
      seasonRating: "3-Season",
      tentType: "Non-Freestanding",
      wallType: "Double Wall",
      doors: 2,
      vestibules: 2,
      poleMaterial: "Aluminum",
      flyMaterial: "30D double ripstop nylon, silicone both sides (2000mm)",
      floorMaterial: "70D 210T taffeta nylon (PU 5000mm, taped)",
      footprintIncluded: false,
    },
    description:
      "A fly-first, double-wall 2-person tent with a door and vestibule on each side and included 7001-T6 aluminium arch poles; the 15D ripstop inner and 30D silicone fly pitch on the fly for wet-weather setup. Needs pegging (min 6).\n\n* Stored weight (1950g) is the full tent with inner + included poles. Pitched on trekking poles with the optional ridge connector it drops to ~1840g; fly-only is ~1200g.",
  },
];

(async () => {
  // Cloudflare 503s node's fetch (TLS fingerprint); curl usually passes but can
  // get challenged when rate-limited. AARN_FEED_FILE lets you point at a cached
  // products.json to bypass the network entirely.
  let raw;
  if (process.env.AARN_FEED_FILE) {
    raw = require("fs").readFileSync(process.env.AARN_FEED_FILE, "utf8");
  } else {
    for (let i = 0; i < 4 && !raw; i++) {
      const out = execFileSync(
        "curl",
        ["-s", "--retry", "2", "-H", "User-Agent: Mozilla/5.0", "-H", "Accept: application/json", FEED],
        { maxBuffer: 32 * 1024 * 1024 }
      ).toString();
      if (out.trim().startsWith("{")) raw = out;
      else execFileSync("sleep", ["3"]);
    }
    if (!raw) throw new Error("feed fetch kept returning a Cloudflare challenge — retry later or pass AARN_FEED_FILE");
  }
  const feed = JSON.parse(raw);
  const products = feed.products || [];
  const byHandle = (h) => products.find((p) => p.handle === h);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  for (const m of KEEPERS) {
    const existing = await C.findOne({ name: m.name, brand: /aarn/i }).lean();
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
    let defWeight = m.weightGrams ?? null;
    if (m.axisName) {
      axes = [{ name: m.axisName, values: m.variants.map((v) => v.key) }];
      variants = m.variants.map((v) => ({
        key: v.key,
        options: { [m.axisName]: v.key },
        ...(v.w != null ? { weightGrams: v.w } : {}),
        ...(v.vol != null ? { attributes: { volumeLiters: v.vol } } : {}),
      }));
      const def = m.variants.find((v) => v.key === m.defaultKey) || m.variants[0];
      defWeight = def.w ?? null;
    }

    const axisLabel = m.axisName
      ? `${m.axisName}[${m.variants.map((v) => v.key + "=" + (v.w ?? "?")).join(", ")}]`
      : "";
    console.log(
      `${m.name.padEnd(30)} ${m.itemType.padEnd(16)} ${String(defWeight ?? "NULL").padStart(5)}g  imgs:${images.length}  ${axisLabel}`
    );

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${m.name}: no images — skip`);
        continue;
      }
      const doc = new C({
        name: m.name,
        brand: "Aarn",
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
        merchantId: "direct-aarn",
        merchantName: "Aarn",
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
