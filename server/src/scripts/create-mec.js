/**
 * create-mec.js — MEC Label (the house brand of Mountain Equipment Company,
 * mec.ca), targeted CREATE. MEC has NO open feed: the storefront is BigCommerce
 * (cdn11.bigcommerce.com/s-xw5rh7060c) but the whole site sits behind a Cloudflare
 * "Just a moment…" JS challenge → 403 to every curl/node client, so our feed
 * importer stack can't reach it. The specs + primary images below were gathered by
 * WebFetch (browser-style, solves the challenge) off each PDP, one product at a time,
 * after Google-enumerating the MEC-brand category pages (/en/products/brands/mec/...).
 *
 * SCOPE (user-locked 2026-07-19: "widest — all backpacking gear + apparel"):
 * MEC is a multi-brand RETAILER; the only UNIQUE target is its own MEC Label line.
 * We import the backpacking/hiking-relevant MEC Label gear and skip the resold
 * brands (Arc'teryx/TNF/Osprey/... — we import those direct; the "mud" rule) and the
 * value / car-camping tier per the standing archive defaults:
 *   EXCLUDED: Camper/Cabin/Base Camper family tents + Cabin/Base Camper shelters
 *   (car camping); Reactor 10/6.5 pads incl. Doubles (PDP literally says "car
 *   camping", 2.2 kg, 78 cm wide); Camper Deluxe Double / Sleep Systems; Camino
 *   Traveller; Camper 0C value bag; all Jr./Youth/Children bags; Mini Camp Stove +
 *   pot set; compression stuff sacks; towels.
 *
 * OFFERS: brand-direct, unmonetized `network:"direct"` (merchant "MEC"). MEC is
 * CAD/Canada-only; re-point to an affiliate feed later if their program lands.
 * deepLink = https://www.mec.ca/en/product/<id> (bare id path resolves).
 *
 * VARIANTS: each MEC product = one CatalogItem (matches MEC's own separate product
 * pages + the per-variant-link pattern). Temp = product identity (own item, not a
 * variant), width "Wide" bags kept as their own items (MEC sells them separately),
 * Length/Size = the intra-item variant axis with per-size weights where published.
 * Color dropped. Item weightGrams = the default (Regular) variant's weight.
 *
 *   node src/scripts/create-mec.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const { categoryForItemType } = require("../config/inferItemType");

// ---- variant helper: pairs = [["Regular", 888], ["Long", 944]] -----------------
function sized(axisName, pairs) {
  const values = pairs.map((p) => p[0]);
  const variants = pairs.map(([label, g]) => ({
    key: label,
    options: { [axisName]: label },
    ...(g != null ? { weightGrams: g } : {}),
  }));
  const def = values.includes("Regular") ? "Regular" : values[0];
  const defW = variants.find((v) => v.key === def)?.weightGrams;
  return {
    variantAxes: [{ name: axisName, values }],
    variants,
    defaultVariantKey: def,
    weightGrams: defW ?? null,
  };
}
// apparel: Size axis, no per-variant weights (weight = a reference size)
function apparelSizes(values, def = "Medium") {
  return {
    variantAxes: [{ name: "Size", values }],
    variants: values.map((s) => ({ key: s, options: { Size: s } })),
    defaultVariantKey: values.includes(def) ? def : values[0],
  };
}
const CDN = (p) => `https://cdn11.bigcommerce.com/s-xw5rh7060c/products/${p}`;

// =============================================================================
// ITEMS
// =============================================================================
const ITEMS = [];
const bagLen = (pairs) => sized("Length", pairs);

// ---- BACKPACKING TENTS ----
const tent = (id, name, weightGrams, attrs, img, desc) =>
  ITEMS.push({ id, name, itemType: "Backpacking Tent", weightGrams, attributes: attrs, img, description: desc });

tent("6031-122", "MEC Spark UL 1-Person Tent", 979,
  { capacity: "1-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 2.09, peakHeightCm: 90, doors: 1, vestibules: 1, poleMaterial: "DAC Featherlite", flyMaterial: "15D silicone-coated ripstop nylon", floorMaterial: "20D PU-coated nylon ripstop" },
  CDN("59414/images/495798/6031122_BTG25_TRANSPARENT__54688.1784129739.1280.1280.png"),
  "Ultralight freestanding 1-person, 3-season backpacking tent. Single-hub DAC NSL aluminum pole set, one door + one vestibule, fully seam-taped. Minimum trail weight 979 g; packs to 43 x 11 cm. Footprint sold separately.");
tent("6031-124", "MEC Spark UL 2-Person Tent", 1150,
  { capacity: "2-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 3.08, peakHeightCm: 101, doors: 2, vestibules: 2, poleMaterial: "DAC Featherlite", flyMaterial: "15D silicone-coated ripstop nylon", floorMaterial: "20D nylon ripstop" },
  CDN("59692/images/410821/6031124_BTG25_TRANSPARENT__66472.1784127416.1280.1280.png"),
  "Ultralight freestanding 2-person, 3-season tent. Two doors + two vestibules, DAC NSL aluminum poles. Minimum trail weight 1150 g (packaged 1280 g); packs to 42 x 13 x 12 cm.");
tent("6031-128", "MEC Spark UL 3-Person Tent", 1600,
  { capacity: "3-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 3.83, peakHeightCm: 105, doors: 2, vestibules: 2, poleMaterial: "DAC Featherlite", flyMaterial: "15D silicone-coated ripstop nylon", floorMaterial: "20D PU nylon ripstop" },
  CDN("59700/images/495749/6031128_BTG25_TRANSPARENT__00752.1784127942.1280.1280.png"),
  "Ultralight freestanding 3-person, 3-season tent. Two doors + two vestibules, DAC NSL aluminum poles. Minimum trail weight 1600 g.");
tent("6031-131", "MEC Volt LT 2-Person Tent", 1660,
  { capacity: "2-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 2.73, peakHeightCm: 102, doors: 2, vestibules: 2, poleMaterial: "DAC Featherlite", flyMaterial: "30D PU nylon ripstop (3000 mm)", floorMaterial: "30D PU nylon ripstop (5000 mm)" },
  CDN("59681/images/410822/6031131_BTG25_TRANSPARENT__44145.1780676441.1280.1280.png"),
  "Lightweight freestanding 2-person, 3-season tent. Two doors + two vestibules, DAC Featherlite NSL poles. Trail weight 1660 g (packaged 1700 g); packs to 55 x 17 cm.");
tent("6031-133", "MEC Volt LT 3-Person Tent", 2190,
  { capacity: "3-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 4.37, peakHeightCm: 119, doors: 2, vestibules: 2, poleMaterial: "DAC Featherlite", flyMaterial: "30D polyester ripstop", floorMaterial: "30D nylon ripstop" },
  CDN("59680/images/410820/6031133_BTG25_TRANSPARENT__46968.1780676441.1280.1280.png"),
  "Lightweight freestanding 3-person, 3-season tent. Two doors + two vestibules, DAC Featherlite NSL poles. Trail weight 2190 g (packaged 2230 g); packs to 56 x 20 cm.");
tent("6031-134", "MEC Volt LT 4-Person Tent", 2800,
  { capacity: "4-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 6.1, peakHeightCm: 135, doors: 2, vestibules: 2, poleMaterial: "DAC Featherlite", flyMaterial: "30D polyester ripstop (3000 mm)", floorMaterial: "30D nylon ripstop (5000 mm)" },
  CDN("59677/images/410817/6031134_BTG25_TRANSPARENT__17823.1780676441.1280.1280.png"),
  "Freestanding 4-person, 3-season tent. Two doors + two vestibules (1.5 sq m each), DAC Featherlite NSL poles. Trail weight 2800 g (packaged 2870 g); packs to 63 x 20.5 cm.");
tent("5047-590", "MEC TGV 2-Person 4-Season Tent", 2490,
  { capacity: "2-Person", seasonRating: "4-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 2.8, peakHeightCm: 105, doors: 1, vestibules: 1, poleMaterial: "Aluminum", flyMaterial: "40D PU polyester ripstop", floorMaterial: "70D PU nylon" },
  CDN("38721/images/429328/5047590_LDN00_TRANSPARENT__37589.1781638671.1280.1280.png"),
  "Freestanding 4-season mountaineering 2-person tent. One door + one vestibule, DAC aluminum poles, burly 70D floor. Trail weight 2490 g (packaged 2750 g); packs to 18 x 53 cm.");
tent("5061-995", "MEC Nunatak 3-Person 4-Season Tent", 4770,
  { capacity: "3-Person", seasonRating: "4-Season", tentType: "Freestanding", wallType: "Double Wall", floorAreaSqM: 4.3, peakHeightCm: 130, doors: 2, vestibules: 2, poleMaterial: "Aluminum", flyMaterial: "40D PU polyester ripstop", floorMaterial: "70D PU nylon" },
  CDN("38728/images/429329/5061995_LDN00_TRANSPARENT__56514.1781638672.1280.1280.png"),
  "Freestanding 4-season expedition 3-person tent. Two doors + two vestibules, DAC aluminum poles, 70D floor. Trail weight 4770 g (packaged 5080 g); packs to 20 x 68 cm.");

// ---- SLEEPING BAGS ----
// b(id, name, gender, tempC, extraAttrs, sizedResult|weightGrams, img, desc)
function bag(id, name, gender, ins, tempC, extra, variantOrWeight, img, desc) {
  const attrs = { insulationType: ins, tempRatingC: tempC, shape: "Mummy", gender, ...extra };
  const base = { id, name, itemType: "Sleeping Bag", attributes: attrs, img, description: desc };
  if (typeof variantOrWeight === "number") base.weightGrams = variantOrWeight;
  else Object.assign(base, variantOrWeight);
  ITEMS.push(base);
}

// down (650 fill unless noted); rds true across the MEC down line
const dn = { fillPower: 650, rdsDown: true };
bag("6031-099", "MEC Draco 0C Down Sleeping Bag", "Unisex", "Down", 0, dn,
  bagLen([["Regular", 888], ["Long", 944]]),
  CDN("59400/images/449940/6031099_NDN24_TRANSPARENT__24066.1280.1280.png"),
  "Value-focused 650-fill-power RDS down mummy bag with vertical torso baffles. EN comfort ~3 C. Regular 888 g / Long 944 g; packs to ~4 L. Recycled PFAS-free shell; includes compression + storage sacks.");
bag("6031-100", "MEC Draco -9C Down Sleeping Bag", "Unisex", "Down", -9, dn,
  bagLen([["Regular", 1200], ["Long", 1320]]),
  CDN("59218/images/449491/6031100_POB55_TRANSPARENT__31663.1781639109.1280.1280.png"),
  "650-fill-power RDS down mummy bag for cold-weather backpacking. Comfort -9 C / limit -11 C. Regular 1200 g / Long 1320 g; packs to 24 x 48 cm.");
bag("6031-101", "MEC Draco -9C Wide Down Sleeping Bag", "Unisex", "Down", -9, dn,
  bagLen([["Regular", 1330], ["Long", 1400]]),
  CDN("59215/images/449475/6031101_POB55_TRANSPARENT__32140.1781639108.1280.1280.png"),
  "Wider-cut version of the Draco -9C: 650-fill-power RDS down, roomier medium-wide mummy. Regular 1330 g / Long 1400 g.");
bag("6031-096", "MEC Delphinus 0C Down Sleeping Bag", "Womens", "Down", 0, dn,
  bagLen([["Small", 815], ["Regular", 880]]),
  CDN("59217/images/449478/6031096_SCI77_TRANSPARENT__39123.1783098385.1280.1280.png"),
  "Women's-specific 650-fill-power RDS down mummy bag with extra hip room and footbox insulation. EN comfort 0 C / limit -4 C. Small 815 g / Regular 880 g; packs to 20 x 35 cm.");
bag("6031-097", "MEC Delphinus -9C Down Sleeping Bag", "Womens", "Down", -9, dn,
  bagLen([["Small", 1130], ["Regular", 1240]]),
  CDN("59216/images/449470/6031097_WBB11_TRANSPARENT__56870.1781639108.1280.1280.png"),
  "Women's-specific 650-fill-power RDS down mummy bag. Comfort -6 C / limit -12 C. Small 1130 g / Regular 1240 g.");
bag("6031-098", "MEC Delphinus Wide -9C Down Sleeping Bag", "Womens", "Down", -9, dn,
  bagLen([["Small", 1220], ["Regular", 1350]]),
  CDN("59718/images/451796/6031098_WBB11_TRANSPARENT__39040.1781639158.1280.1280.png"),
  "Wider-cut women's-specific Delphinus -9C: 650-fill-power RDS down. Small 1220 g / Regular 1350 g.");
bag("6026-366", "MEC Aphelion UL -7C Down Sleeping Bag", "Unisex", "Down", -7,
  { fillPower: 900, rdsDown: true, waterResistantDown: true, fillWeightG: 425 },
  bagLen([["Regular", 700], ["Long", 760]]),
  CDN("54941/images/442089/6026366_WHO16_TRANSPARENT__18132.1781638951.1280.1280.png"),
  "Ultralight 900-fill-power water-repellent RDS goose down mummy bag (425 g fill) for minimalist backpacking and alpine use. Half-length zip, draft collar. Regular 700 g / Long 760 g; packs to 3.5 L.");
bag("6036-736", "MEC Delta Pivot -2 Sleeping Bag", "Unisex", "Down", -2,
  { fillPower: 900, rdsDown: true, waterResistantDown: true, fillWeightG: 270 }, 505,
  CDN("65383/images/411333/6036736_VCT01_TRANSPARENT__76726.1784205569.1280.1280.png"),
  "Ultralight 900-fill-power water-repellent RDS goose down bag (270 g fill) from MEC's 2Kilo Project, combined with aerogel insulation and a rotating HoodPivot system for side sleepers. 505 g; packs to 24 x 18 cm. Fits to 6'0\".");
bag("6005-009", "MEC Talon -17C Down Sleeping Bag", "Unisex", "Down", -17,
  { fillPower: 800, rdsDown: true }, 1520,
  CDN("45422/images/430603/6005009_CIC00_TRANSPARENT__58907.1781638700.1280.1280.png"),
  "800-fill-power RDS down winter mummy bag for ski touring and alpine climbing. Comfort -9 C / limit -20 C. Regular 1520 g; packs to 28 x 56 cm. Fits to 6'0\".");
bag("6005-010", "MEC Talon Windstopper -30C Down Expedition Sleeping Bag", "Unisex", "Down", -30,
  { fillPower: 800, rdsDown: true }, sized("Length", [["Regular", 1990], ["Long", 2200]]),
  CDN("45476/images/430723/6005010_COA00_TRANSPARENT__90553.1280.1280.png"),
  "Expedition-grade 800-fill-power RDS down mummy bag with a GORE-TEX INFINIUM WINDSTOPPER shell. Comfort -30 C. Regular 1990 g / Long 2200 g; packs to 13 L.");
bag("6022-629", "MEC Talon 0C Ultralight Hybrid Sleeping Bag", "Unisex", "Down", 0,
  { fillPower: 800, rdsDown: true }, 635,
  CDN("50938/images/436556/6022629_NEG00_TRANSPARENT__11890.1280.1280.png"),
  "Ultralight 800-fill-power RDS down hybrid bag/quilt with an enclosed footbox plus pad-attachment straps (backless quilt-style). Comfort 5 C / limit 0 C. 635 g. Fits to 6'4\".");

// synthetic
bag("6031-089", "MEC Centaurus 0C Sleeping Bag", "Unisex", "Synthetic", 0,
  { syntheticInsulationType: "Polyester HyperLoft (recycled)" },
  sized("Length", [["Small", 975], ["Regular", 1080], ["Long", 1120]]),
  CDN("59839/images/452426/6031089_DNN78_TRANSPARENT__40323.1781639171.1280.1280.png"),
  "Quick-drying recycled synthetic (HyperLoft) mummy bag; reliable value for damp conditions. EN comfort 3 C / limit -3 C. Small 975 g / Regular 1080 g / Long 1120 g; packs to 20 x 40 cm.");
bag("6031-091", "MEC Centaurus -9C Sleeping Bag", "Unisex", "Synthetic", -9,
  { syntheticInsulationType: "HyperLoft (recycled)" },
  sized("Length", [["Small", 1400], ["Regular", 1500], ["Long", 1630]]),
  CDN("59358/images/449838/6031091_BLP90_TRANSPARENT__32288.1781639117.1280.1280.png"),
  "Recycled synthetic (HyperLoft) mummy bag with Thermolite fleece lining. Comfort -2 C / limit -9 C. Packs to 48 x 24 cm. * Per-size weights are approximate — MEC publishes a 1.4–1.63 kg range across Small/Regular/Long.");
bag("6031-092", "MEC Centaurus -18C Sleeping Bag", "Unisex", "Synthetic", -18,
  { syntheticInsulationType: "EcoSoft (recycled)" }, 2570,
  CDN("62984/images/463004/6031092_CIM11_TRANSPARENT__02497.1280.1280.png"),
  "Recycled synthetic (EcoSoft) winter mummy bag. Comfort -9 C / limit -18 C. * Listed 2570 g is a representative weight — MEC does not publish separate per-size weights (Small/Regular/Long).");

// ---- SLEEPING PADS ----
const infPad = (id, name, weightGrams, attrs, variantExtra, img, desc) =>
  ITEMS.push({ id, name, itemType: "Inflatable Sleeping Pad", ...(weightGrams != null ? { weightGrams } : {}), attributes: attrs, ...variantExtra, img, description: desc });

infPad("6008-339", "MEC VectAir Insulated Sleeping Pad", null,
  { rValue: 4.4, thicknessCm: 8, inflationMethod: "Pump Sack", seasonRating: "3-Season" },
  sized("Size", [["Regular", 780], ["Long Wide", 1080]]),
  CDN("39950/images/429522/6008339_FTR00_TRANSPARENT__83366.1784141441.1280.1280.png"),
  "Insulated inflatable pad with offset internal baffles and 100 g synthetic fill; bi-directional valve. R-value 4.4, 8 cm thick. Regular (183 x 50 cm) 780 g / Long Wide (196 x 64 cm) 1080 g. Includes pump sack + repair kit.");
infPad("6036-660", "MEC VectAir SL Xtreme 6 Sleeping Pad", null,
  { rValue: 5.7, thicknessCm: 10, shape: "Mummy", inflationMethod: "Pump Sack", seasonRating: "4-Season" },
  sized("Size", [["Regular", 475], ["Long Wide", 630]]),
  CDN("65460/images/472013/6036660_BAL04_TRANSPARENT__96557.1781639567.1280.1280.png"),
  "Warm 4-season ultralight inflatable mummy pad with reflective insulation and a quiet floating chamber. R-value 5.7, 10 cm thick. Regular (183 x 55 cm) 475 g / Long Wide (198 x 64 cm) 630 g. Includes pump sack + repair kit.");
infPad("6037-391", "MEC VectAir Ultralight 4 Sleeping Pad", 495,
  { rValue: 4.0, thicknessCm: 10, shape: "Mummy", inflationMethod: "Pump Sack", seasonRating: "3-Season" },
  {},
  CDN("61519/images/511205/6037391_ZEN03_TRANSPARENT__33798.1280.1280.png"),
  "Ultralight inflatable mummy pad with Mylar reflective insulation and welded dot-weld baffles. R-value 4.0, 10 cm thick, 183 x 55 cm, 495 g. Includes pump sack + repair kit.");

ITEMS.push({ id: "6040-302", name: "MEC Waffle Z-Foam Sleeping Pad", itemType: "Foam Sleeping Pad",
  attributes: { rValue: 2.0, thicknessCm: 2.1, padType: "Accordion Fold" },
  ...sized("Size", [["Short", 300], ["Regular", 436]]),
  img: CDN("64515/images/467744/6040302_BAL04_TRANSPARENT__93307.1781639481.1280.1280.png"),
  description: "Closed-cell IXPE foam accordion pad with a reflective aluminum layer. R-value 2.0, 2.1 cm thick, 56 cm wide. Short (130 cm) 300 g / Regular (186 cm) 436 g. Waterproof, instant setup." });

// ---- DAYPACK ----
ITEMS.push({ id: "6036-263", name: "MEC Trail 24 Pack", itemType: "Daypack", weightGrams: 460,
  attributes: { volumeLiters: 24, gender: "Unisex", frameType: "Foam Back", hipBeltType: "Webbing Only", hipBeltRemovable: true, hydrationCompatible: true, waterResistance: "DWR Coated", mainFabric: "210D PU-coated nylon ripstop" },
  img: CDN("63834/images/465314/6036263_BK000_TRANSPARENT__29590.1781639431.1280.1280.png"),
  description: "24 L clamshell daypack for day hikes and trail running. Padded airmesh back + straps, removable webbing waistbelt, side stretch pocket, hydration sleeve with hose port, cordlock for poles/axe. 460 g." });

// ---- BACKPACKS ----
ITEMS.push({ id: "6036-258", name: "MEC Zephyr 65L Backpack - Men's", itemType: "Backpack", weightGrams: 1970,
  attributes: { volumeLiters: 65, gender: "Mens", frameType: "Internal Frame", backPanelType: "Mesh", hipBeltType: "Padded", hydrationCompatible: true, rainCoverIncluded: false, waterResistance: "DWR Coated", mainFabric: "300D nylon with 420D reinforcements", torsoFitRange: "Short/Standard–Standard/Long" },
  img: CDN("64400/images/467360/6036258_BK000_TRANSPARENT__99670.1781639473.1280.1280.png"),
  description: "Adjustable-torso 65 L internal-frame backpacking pack with a trampoline-style ventilated back panel, removable floating lid, sleeping-bag compartment and Recco reflector. 1970 g. Two torso ranges (Short/Standard, Standard/Long)." });
ITEMS.push({ id: "6036-259", name: "MEC Zephyr 65L Backpack - Women's", itemType: "Backpack", weightGrams: 1980,
  attributes: { volumeLiters: 65, gender: "Womens", frameType: "Internal Frame", backPanelType: "Mesh", hipBeltType: "Padded", hydrationCompatible: true, rainCoverIncluded: false, waterResistance: "DWR Coated", mainFabric: "300D ripstop nylon with 420D reinforcements", torsoFitRange: "Short/Standard–Standard/Long" },
  img: CDN("64399/images/467346/6036259_BDT26_TRANSPARENT__94875.1781639472.1280.1280.png"),
  description: "Women's adjustable-torso 65 L internal-frame backpacking pack with trampoline back panel, hip-belt pockets, side-zip entry, sleeping-bag compartment and Recco reflector. 1980 g. Two torso ranges (Short/Standard, Standard/Long)." });
ITEMS.push({ id: "6036-256", name: "MEC Vista 40L Backpack - Unisex", itemType: "Backpack",
  attributes: { volumeLiters: 40, gender: "Unisex", frameType: "Internal Frame", backPanelType: "Mesh", hipBeltType: "Padded", hydrationCompatible: true, rainCoverIncluded: false, waterResistance: "DWR Coated", mainFabric: "300D nylon (PFAS-free DWR)" },
  ...sized("Size", [["Short/Standard", 1420], ["Standard/Long", 1530]]),
  img: CDN("63832/images/465304/6036256_ZEN03_TRANSPARENT__87564.1783108331.1280.1280.png"),
  description: "40 L overnight backpacking pack with airmesh back panel, height-adjustable harness, U-shaped front-zip access, removable top lid and hip-belt pockets. Short/Standard 1420 g / Standard/Long 1530 g." });
ITEMS.push({ id: "6036-257", name: "MEC Vista 65L Backpack - Unisex", itemType: "Backpack",
  attributes: { volumeLiters: 65, gender: "Unisex", frameType: "Internal Frame", backPanelType: "Mesh", hipBeltType: "Padded", hydrationCompatible: true, rainCoverIncluded: false, waterResistance: "DWR Coated", mainFabric: "300D nylon (PFAS-free DWR, PU coated)" },
  img: CDN("63841/images/465341/6036257_ZEN03_TRANSPARENT__16024.1781639431.1280.1280.png"),
  description: "65 L multi-day backpacking pack with airmesh back panel, height-adjustable shoulder straps, load lifters, long U-shaped zip access, removable lid and integrated whistle. (MEC does not publish a weight.)" });
ITEMS.push({ id: "6036-260", name: "MEC Charlie 32L UL Pack - 2Kilo Project - Unisex", itemType: "Backpack", weightGrams: 400,
  attributes: { volumeLiters: 32, gender: "Unisex", frameType: "Frameless", backPanelType: "Foam", hipBeltType: "Webbing Only", hipBeltRemovable: true, hydrationCompatible: true, rainCoverIncluded: false, waterResistance: "Waterproof", mainFabric: "Challenge Sailcloth TX70 Ultra 3-layer waterproof laminate" },
  img: CDN("65380/images/411335/6036260_SVB01_TRANSPARENT__94337.1780705241.1280.1280.png"),
  description: "Fully waterproof 32 L ultralight roll-top pack from MEC's 2Kilo Project in Challenge Sailcloth TX70 Ultra, with UHMWPE-reinforced stretch pockets. 400 g (350 g with the removable belt + foam back panel removed); no pack cover needed." });

// ---- TREKKING POLES ----
ITEMS.push({ id: "6036-037", name: "MEC Uplink Aluminum 3 Part Cork Grip Poles", itemType: "Trekking Poles", weightGrams: 555,
  attributes: { material: "Aluminum", soldAs: "Pair", adjustmentType: "Telescoping", lockingMechanism: "Lever Lock", minLengthCm: 105, maxLengthCm: 140, collapsedLengthCm: 65, sections: 3, gripMaterial: "Cork", tipType: "Carbide", basketsIncluded: true },
  img: CDN("62027/images/459532/6036037_BLU36_TRANSPARENT__81635.1781639314.1280.1280.png"),
  description: "3-section 7075-T6 aluminum trekking poles with natural cork grips and Powerlock 3.0 lever locks. Adjust 105-140 cm, collapse to 65 cm; carbide tips + trekking baskets. 555 g per pair." });

// ---- CAMP CHAIRS ----
ITEMS.push({ id: "6034-174", name: "MEC Ultra Lite Chair", itemType: "Camp Chair", weightGrams: 990,
  attributes: { type: "Chair", maxLoadKg: 113 },
  img: CDN("60014/images/453190/6034174_BK000_TRANSPARENT__49112.1784127250.1280.1280.png"),
  description: "Packable aluminum-frame camp chair with a PU-coated polyester DWR seat. Supports 113 kg; 990 g. Packs into an included zippered carry bag." });
ITEMS.push({ id: "6034-175", name: "MEC Ultra Lite Highback Chair", itemType: "Camp Chair", weightGrams: 1140,
  attributes: { type: "Chair", maxLoadKg: 113 },
  img: CDN("59717/images/451774/6034175_BK000_TRANSPARENT__96642.1781639158.1280.1280.png"),
  description: "High-back packable aluminum-frame camp chair with recycled polyester DWR seat for full back support. Supports 113 kg; 1140 g. Packs to 44 x 11 x 8 cm with carry bag." });

// ---- HAMMOCK ----
ITEMS.push({ id: "6011-543", name: "MEC Double Hammock with Tree Straps", itemType: "Hammock",
  attributes: { capacity: "2-Person", strapsIncluded: true },
  img: CDN("39401/images/408166/6011543_DOL00_TRANSPARENT__90113.1780589147.1280.1280.png"),
  description: "2-person 50D ripstop polyester hammock with two 10 ft bartacked tree straps included. Max load 180 kg. (MEC does not publish a weight.)" });

// ---- APPAREL ----
ITEMS.push({ id: "6033-841", name: "MEC Synergy Gore-Tex Jacket - Men's", itemType: "Rain Jacket", weightGrams: 404,
  attributes: { gender: "Mens", layerConstruction: "3-Layer", membrane: "GORE-TEX C-Knit", waterproofRating: 20000, breathabilityRating: 20000, hoodType: "Helmet-Compatible", packable: true, pfasFree: true },
  ...apparelSizes(["Small", "Medium", "Large", "X-Large", "XX-Large"]),
  img: CDN("61661/images/458694/6033841_BK000_TRANSPARENT__97667.1781639297.1280.1280.png"),
  description: "3-layer GORE-TEX C-Knit alpine shell (20K/20K) with a helmet-compatible hood, harness-accessible pockets, high collar, Recco reflector and PFAS-free DWR. 50D recycled polyester face. * Listed 404 g is a reference size; actual weight varies by size." });
ITEMS.push({ id: "6016-910", name: "MEC Northern Light Hoodie - Men's", itemType: "Insulated Jacket", weightGrams: 495,
  attributes: { insulationType: "Synthetic", gender: "Mens", syntheticInsulationType: "EcoSoft (recycled)", insulationWeightGsm: 60, shellFabric: "20D recycled nylon ripstop", hoodType: "Insulated Hood", pockets: 2, packable: true, temperatureRange: "Lightweight" },
  ...apparelSizes(["Small", "Medium", "Large", "X-Large", "XX-Large"]),
  img: CDN("54134/images/441039/6016910_BK000_TRANSPARENT__70935.1781638928.1280.1280.png"),
  description: "Lightweight synthetic insulated hoody with 60 g EcoSoft recycled fill and a 20D recycled nylon ripstop shell; stuffs into its own pocket. * Listed 495 g is a reference size; actual weight varies by size." });
ITEMS.push({ id: "6016-911", name: "MEC Northern Light Hoodie - Women's", itemType: "Insulated Jacket", weightGrams: 400,
  attributes: { insulationType: "Synthetic", gender: "Womens", syntheticInsulationType: "EcoSoft (recycled)", insulationWeightGsm: 60, shellFabric: "20D recycled nylon ripstop", pockets: 2, packable: true, temperatureRange: "Lightweight" },
  ...apparelSizes(["X-Small", "Small", "Medium", "Large", "X-Large", "XX-Large"]),
  img: CDN("49873/images/480384/6016911_BAL04_TRANSPARENT__15117.1782334327.1280.1280.png"),
  description: "Women's lightweight synthetic insulated jacket with 60 g EcoSoft recycled fill and a 20D recycled nylon ripstop shell; stuffs into its own pocket. * Listed 400 g is a reference size; actual weight varies by size." });

// =============================================================================
// RUN
// =============================================================================
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0;
  const counts = {};

  for (const it of ITEMS) {
    const existing = await C.findOne({ name: it.name, brandLC: "mec", isActive: true }).lean();
    if (existing) { console.log(`SKIP (exists): ${it.name}`); skipped++; continue; }

    const { category, subcategory } = categoryForItemType(it.itemType, it.name);
    counts[it.itemType] = (counts[it.itemType] || 0) + 1;
    const wv = it.weightGrams ?? (it.variants ? it.variants[0]?.weightGrams : null);
    console.log(`${it.name.slice(0, 46).padEnd(46)} ${it.itemType.padEnd(20)} ${String(wv ?? "?").padStart(5)}g  ${category || "-"}/${subcategory || "-"}  ${it.variantAxes ? "[" + it.variants.map((v) => v.key).join(",") + "]" : ""}`);

    if (!COMMIT) continue;
    if (!it.img) { console.log(`   !! ${it.name}: no image — skip`); continue; }

    const doc = new C({
      name: it.name, brand: "MEC", itemType: it.itemType,
      ...(category ? { category } : {}), ...(subcategory ? { subcategory } : {}),
      description: it.description, imageUrls: [it.img], createdBy: ADMIN_ID, isActive: true,
      ...(it.weightGrams != null ? { weightGrams: it.weightGrams } : {}),
      ...(it.variantAxes ? { variantAxes: it.variantAxes, variants: it.variants, defaultVariantKey: it.defaultVariantKey } : {}),
      attributes: it.attributes || {},
    });
    doc.$locals.lenientAttributes = true;
    try { await doc.save(); } catch (e) { console.log(`   !! ${it.name}: ${e.message}`); continue; }
    await O.create({ network: "direct", region: "global", merchantId: "direct-mec", merchantName: "MEC", productId: doc._id, deepLink: `https://www.mec.ca/en/product/${it.id}`, priority: 0 });
    created++;
  }

  console.log(`\nby itemType:`, counts);
  console.log(`total defined: ${ITEMS.length}`);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped (already active)`);
  await mongoose.disconnect();
})();
