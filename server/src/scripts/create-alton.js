/**
 * create-alton.js — Alton Goods (altongoods.com), Australian HOUSE-BRAND ultralight
 * maker on Shopify (open products.json, 217 products, vendor "Alton"). Multi-currency,
 * global shipping. Direct Alton offers (NO affiliate program — "Gear Tester" ambassador
 * only; not on Awin). Links are plain/unmonetized until they add a Shopify affiliate app.
 *
 * SCOPE (user-locked 2026-07-27, "widest incl. functional apparel"):
 *   Keep Alton house-brand UL gear + functional apparel. SKIP (defaults):
 *     - Food (22x "Real Meals"), National Park / trail STICKERS + merch tees, Gift Card
 *     - "Replacement …" spare parts, footprints, fitted sheets, storage boxes, bundles/sets
 *     - Resold 3rd-party: Flextail x3, Nikwax x5, Gear Aid x5, Katadyn, Klean Kanteen co-brand
 *     - Novelty National Park / Logo tees (functional apparel only)
 *
 * WEIGHTS: the feed `grams` is REAL only for the sleep category (bags/quilts/mats vary
 * correctly per variant). It is FLAT BOILERPLATE for apparel (all 360g/255g) and BACKWARDS
 * for tents (1P heavier than 2P). So every non-sleep weight below is HAND-VERIFIED from the
 * PDP spec table. Apparel/tent weights are reference-size (Size M etc.) → disclosed in desc
 * per the weight-precision rule. Temp rating on bags/quilts = PRODUCT identity → SPLIT into
 * separate items per the REI variant standard (NOT consolidated).
 *
 *   node src/scripts/create-alton.js            # dry-run
 *   node src/scripts/create-alton.js --commit   # write to treklist_local only
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("Refusing to --commit against a DB other than treklist_local");
  process.exit(1);
}
const ADMIN_ID = "69565d7c3480c2216f915a36";
const BRAND = "Alton";
const FEED = "https://altongoods.com/products.json?limit=250";
const strip = (s) =>
  (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Reference-size weight disclosure suffix.
const REF = (s) => ` (weight is for ${s}; other sizes/options vary — see product page).`;

// -----------------------------------------------------------------------------
// CURATED KEEP LIST — keyed by EXACT feed title.
//   itemType     : TrekList controlled type
//   weight       : hand-verified grams (omit → trust feed variant[0].grams; sleep only)
//   note         : appended to description (weight source / reference size / variant axes)
//   tempSplit    : true → create one item per temperature variant (per-temp feed weight)
//   attrs        : base structured attributes
// -----------------------------------------------------------------------------
const KEEP = {
  // ---- SHELTERS / TARPS (weights PDP-verified — feed grams were backwards) ----
  "Dyneema® Ultralight Tent - 1P": { itemType: "Backpacking Tent", weight: 1050, attrs: { capacityPersons: 1 }, note: "Trail weight (tent + poles + 6 pegs); packed 1250 g. Freestanding double-wall, Dyneema fly + carbon poles." },
  "Lightweight Tent - 1P": { itemType: "Backpacking Tent", weight: 1220, attrs: { capacityPersons: 1 }, note: "Trail weight (tent + poles + 6 pegs); packed 1440 g. Freestanding double-wall." },
  "Lightweight Tent - 2P": { itemType: "Backpacking Tent", weight: 1814, attrs: { capacityPersons: 2 }, note: "Trail weight (tent + poles + 10 pegs); packed 1898 g. Freestanding double-wall." },
  "Ultralight Bug Net Tent": { itemType: "Backpacking Tent", weight: 590, attrs: { capacityPersons: 1 }, note: "Solo micromesh bug shelter; pitches with trekking poles/guylines." },
  "Ultralight Bug Net Tent - Double": { itemType: "Backpacking Tent", weight: 860, attrs: { capacityPersons: 2 }, note: "Total packed weight. Two-person micromesh bug shelter; pitches with trekking poles/guylines." },
  "Walkabout Swag": { itemType: "Bivy Sack", weight: 870, note: "Swag weight; packed 1.4 kg. Solo Nanopore bivy-style shelter with integrated bug net + bathtub floor." },
  "2.8m x 1.8m Lightweight Hoochie Tarp": { itemType: "Tarp Shelter", weight: 410, note: "Tarp only; packed 600 g. Silicone/PU-coated ripstop nylon, 2.8 x 1.8 m." },
  "3m x 3m Lightweight Tarp": { itemType: "Tarp Shelter", weight: 635, note: "Tarp only; packed 875 g. Silicone/PU-coated ripstop nylon, 3 x 3 m." },
  "3m x 4m Lightweight Tarp": { itemType: "Tarp Shelter", weight: 780, note: "Tarp only; packed 990 g. Silicone/PU-coated ripstop nylon, 3 x 4 m." },
  "Ultralight Poncho Tarp": { itemType: "Rain Poncho", weight: 238, note: "Poncho only; 245 g packed with carabiner + bag. Doubles as a tarp. 20D silicone/PU ripstop." },
  "Ultralight Groundsheet - Single": { itemType: "Ground Sheet", weight: 182 },
  "Ultralight Groundsheet - Double": { itemType: "Ground Sheet", weight: 335 },
  "Collapsible Carbon Tarp Pole": { itemType: "Other", weight: 175, note: "Collapsible carbon tarp/shelter pole." },
  "Telescopic Carbon Tarp Pole": { itemType: "Other", weight: 240, note: "Telescopic carbon tarp/shelter pole." },

  // ---- SLEEP: PADS / PILLOWS ----
  // ⚠ Feed grams are WRONG for pads (store packed/with-pump values). All weights below are
  // mat-only, HAND-VERIFIED from PDP spec tables 2026-07-27. R4 has real Size variants.
  "Insulated Sleeping Mat (R4)": {
    itemType: "Inflatable Sleeping Pad", attrs: { rValue: 4 },
    variants: { axis: "Size", default: "Regular", values: [
      { value: "Regular", weight: 580 },
      { value: "Regular - Wide", weight: 690 },
      { value: "Large", weight: 760 },
    ] },
    note: "Mat-only weight (per size). Optional inflation pump bag sold separately." },
  "Insulated Double Sleeping Mat (R4)": { itemType: "Inflatable Sleeping Pad", weight: 1455, attrs: { rValue: 4 }, note: "Mat only. Double-wide (two-person)." },
  "Insulated Sleeping Mat PLUS (R6)": { itemType: "Inflatable Sleeping Pad", weight: 630, attrs: { rValue: 6 }, note: "Mat only. Optional pump bag sold separately." },
  "Insulated Sleeping Mat EXTREME (R8)": { itemType: "Inflatable Sleeping Pad", weight: 740, attrs: { rValue: 8.8 }, note: "Mat only (R-value 8.8). Optional pump bag sold separately." },
  "Ultralight Sleeping Mat (R1.5)": { itemType: "Inflatable Sleeping Pad", weight: 450, attrs: { rValue: 1.5 }, note: "Mat only. Optional pump bag sold separately." },
  "Self-Inflating Sleeping Mat (R4)": { itemType: "Inflatable Sleeping Pad", weight: 630, attrs: { rValue: 4 }, note: "Mat only. Self-inflating foam-core mat." },
  // NOTE: "Closed Cell Foam Sleeping Mat" (+PLUS) were DELISTED from the store 2026-07-27
  // (handles 404) — dropped. Re-add if they return. Only the Closed Cell Foam Sit Pad remains.
  "Insulated Pillow": { itemType: "Pillow", weight: 100 },
  "Ultralight Pillow": { itemType: "Pillow", weight: 110 },

  // ---- SLEEP: BAGS / QUILTS (TEMP-SPLIT per REI standard; per-temp feed weight) ----
  "Ultralight Sleeping Bag": { itemType: "Sleeping Bag", tempSplit: true, note: "Down. Comfort ratings ~3-6 °C above the lower limit shown." },
  "Synthetic Sleeping Bag": { itemType: "Sleeping Bag", tempSplit: true, note: "Synthetic insulation." },
  "Ultralight Summer Sleeping Bag": { itemType: "Sleeping Bag", weight: 512, attrs: { tempRatingC: 10 }, note: "Summer-weight down bag." },
  "Sleeping Bag Liner": { itemType: "Sleeping Bag Liner", weight: 450 },
  "Ultralight Top Quilt": { itemType: "Quilt", tempSplit: true },

  // ---- HAMMOCKS ----
  "Ultralight Hammock": { itemType: "Hammock", weight: 340, note: "Total packed weight (hammock + 2 carabiners + carry bag). Ultralight strap set optional." },
  "Ultralight Underquilt": { itemType: "Quilt", tempSplit: true, note: "Hammock underquilt." },

  // ---- COOK (titanium house line; feed grams reliable here) ----
  "Titanium Alcohol Stove": { itemType: "Stove (Alcohol)" },
  "Titanium Flatpack Twig Stove": { itemType: "Stove (Wood)" },
  "Titanium Billy Pot 1950ml": { itemType: "Backpacking Pot" },
  "Titanium Kettle 1L": { itemType: "Backpacking Pot" },
  "Titanium Mess Tin 800ml": { itemType: "Backpacking Pot" },
  "Titanium Pot Set": { itemType: "Backpacking Pot" },
  "Titanium Frying Pan - Ceramic Coated": { itemType: "Backpacking Pot" },
  "Titanium Large Frying Pan - Ceramic Coated": { itemType: "Backpacking Pot" },
  "Titanium Double-Wall Mug 450mL": { itemType: "Coffee Mug" },
  "Titanium Single-Wall Cup 600mL": { itemType: "Coffee Mug" },
  "Titanium Mug Set": { itemType: "Coffee Mug" },
  "Titanium Flask": { itemType: "Flask" },
  "Titanium Cutlery Set": { itemType: "Utensil" },
  "Titanium Cutlery Bundle": { itemType: "Utensil" },
  "Ultralight Titanium Cutlery": {
    itemType: "Utensil",
    variants: { axis: "Utensil", default: "Spork & Spoon Set", values: [
      { value: "Spork & Spoon Set", weight: 65 },
      { value: "Spork", weight: 35 },
      { value: "Spoon", weight: 35 },
    ] } },
  "Ultralight Titanium Tongs": { itemType: "Utensil" },
  "Titanium Trowel": { itemType: "Trowel" },
  "Ultralight Titanium Bowl 1200ml": { itemType: "Other", note: "Titanium bowl." },
  "Ultralight Titanium Plate": { itemType: "Other", note: "Titanium plate." },
  "Ultralight Titanium Grill": {
    itemType: "Other",
    variants: { axis: "Size", default: "Small", values: [
      { value: "Small", weight: 118 },   // grill only, PDP
      { value: "Large", weight: 240 },
    ] },
    note: "Titanium grill grate (grill only, per size)." },
  "Ultralight Titanium Grill Set": { itemType: "Other", weight: 382, note: "Titanium grill set (total packed weight)." },
  "Ultralight Pot Grippers": { itemType: "Other", note: "Titanium pot lifter." },
  "Ultralight Dry Sack": {
    itemType: "Dry Bag / Stuff Sack",
    variants: { axis: "Size", default: "10L", values: [
      { value: "5L", weight: 40 },   // PDP mat-only weights (feed was inflated)
      { value: "10L", weight: 50 },
      { value: "15L", weight: 60 },
    ] } },
  "Ultralight Gear Pouch": {
    itemType: "Dry Bag / Stuff Sack",
    variants: { axis: "Size", default: "Medium", values: [
      { value: "Small", weight: 22 },
      { value: "Medium", weight: 28 },
      { value: "Large", weight: 34 },
    ] } },

  // ---- STAKES / MISC ACCESSORIES ----
  "DAC J-Stake (F) Pegs (8 Pack)": { itemType: "Tent Stakes", weight: 64 },
  "Ultralight Aluminium Pegs (8 Pack)": { itemType: "Tent Stakes", weight: 105 },
  "Titanium Whistle": { itemType: "Other", weight: 4 },

  // ---- PACKS / POLES / CAMP ----
  "Ultralight Daypack - 20L": { itemType: "Daypack", weight: 340, attrs: { volumeLiters: 20 }, note: "20 L main + ~5 L stretch pockets." },
  // NOTE: "Ultralight Carbon Hiking Poles Set" (Trekking Poles, 300 g pair) was DELISTED
  // 2026-07-27 (handle ultralight-hiking-poles 404) — only replacement parts + the daypack
  // bundle remain. Dropped; re-add if the standalone poles return.
  "Ultralight Camp Chair": { itemType: "Camp Chair", weight: 1038 },
  "Closed Cell Foam Sit Pad": { itemType: "Sit Pad", weight: 57, note: "Weight per pad; sold in configurable quantities." },

  // ---- APPAREL (functional only; weights PDP-verified, reference size) ----
  "All-Weather Anorak": { itemType: "Rain Jacket", weight: 360, attrs: { gender: "Unisex" }, note: "Waterproof Nanopore 3L anorak." + REF("Size M") },
  "All-Weather Jacket - Mens": { itemType: "Rain Jacket", weight: 380, attrs: { gender: "Mens" }, note: "Waterproof Nanopore 3L shell." + REF("Size M") },
  "All-Weather Jacket - Womens": { itemType: "Rain Jacket", weight: 335, attrs: { gender: "Womens" }, note: "Waterproof Nanopore 3L shell." + REF("Size 8") },
  "All-Weather Bucket Hat": { itemType: "Hat/Headwear", weight: 42, note: "Waterproof Nanopore 3L bucket hat." + REF("Size S/M; M/L is 44 g") },
  "Multi Day Shirt": { itemType: "Hiking Shirt", weight: 335, attrs: { gender: "Unisex" }, note: "Nylon/spandex stretch ripstop, UPF 50+, PFC-free DWR." + REF("Size M") },
  "Switchback Pants": { itemType: "Hiking Pants", weight: 335, attrs: { gender: "Unisex" }, note: "4-way stretch nylon, bluesign, PFC-free DWR." + REF("Size M") },
  "Switchback Shorts": { itemType: "Hiking Shorts", weight: 205, attrs: { gender: "Unisex" }, note: "4-way stretch nylon, quick-dry, bluesign." + REF("Size M") },
  "Transit Hoodie": { itemType: "Fleece Jacket", weight: 610, attrs: { gender: "Unisex" }, note: "Mid-weight cotton/poly brushed fleece hoodie." + REF("Size M") },
  "Midweight Merino Socks": { itemType: "Hiking Socks", weight: 66, note: "65% merino blend. Pair weight" + REF("Size S/M; M/L is 72 g") },
  "Trailhead Cap": { itemType: "Hat/Headwear", weight: 50, note: "5-panel cap." },
};

// lower-limit temp (°C) parsed from a variant title like "-5°C | 23°F (Lower Limit) ..."
function tempC(title) {
  const m = title.match(/(-?\d+)\s*°?\s*c\b/i);
  return m ? parseInt(m[1], 10) : null;
}

(async () => {
  const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } });
  const products = (await res.json()).products || [];
  const byTitle = new Map(products.map((p) => [strip(p.title), p]));

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0,
    skipped = 0,
    missing = 0;
  const rows = [];

  for (const [title, cfg] of Object.entries(KEEP)) {
    const p = byTitle.get(strip(title));
    if (!p) {
      console.log(`  !! feed missing: ${title}`);
      missing++;
      continue;
    }
    const img = (p.images || [])[0] && p.images[0].src;
    const baseDesc = strip(p.body_html).slice(0, 1000);
    const url = `https://altongoods.com/products/${p.handle}`;

    // Build the list of (name, weight, attrs, model) units to create for this product.
    const units = [];
    if (cfg.tempSplit) {
      for (const v of p.variants) {
        const t = tempC(v.title);
        if (t == null) continue;
        units.push({
          name: `${title} — ${t}°C (${Math.round((t * 9) / 5 + 32)}°F)`,
          weight: v.grams || null,
          attrs: { ...(cfg.attrs || {}), tempRatingC: t },
          model: v.sku || undefined,
        });
      }
    } else if (cfg.variants) {
      // Real (non-temperature) variant axis with PDP-verified per-variant weights.
      const vx = cfg.variants;
      const def = vx.values.find((v) => v.value === vx.default) || vx.values[0];
      units.push({
        name: title,
        weight: def.weight,
        attrs: cfg.attrs || {},
        model: (p.variants[0] && p.variants[0].sku) || undefined,
        variantAxes: [{ name: vx.axis, values: vx.values.map((v) => v.value) }],
        variants: vx.values.map((v) => ({
          key: v.value,
          options: { [vx.axis]: v.value },
          weightGrams: v.weight,
          ...(v.sku ? { sku: v.sku } : {}),
        })),
        defaultVariantKey: def.value,
      });
    } else {
      units.push({
        name: title,
        weight: cfg.weight != null ? cfg.weight : p.variants[0] && p.variants[0].grams,
        attrs: cfg.attrs || {},
        model: (p.variants[0] && p.variants[0].sku) || undefined,
      });
    }

    const { category, subcategory } = categoryForItemType(cfg.itemType, "");
    for (const u of units) {
      const description = cfg.note ? `${baseDesc}\n\n${cfg.note}` : baseDesc;
      rows.push([cfg.itemType, u.weight, u.name]);
      const vtag = u.variants ? ` [${u.variants.length}× ${u.variantAxes[0].name}: ${u.variants.map((v) => v.weightGrams + "g").join("/")}]` : "";
      console.log(
        `  ${String(created + 1).padStart(3)}. ${cfg.itemType.padEnd(24)} ${String(u.weight || "-").padStart(5)}g  ${u.name.slice(0, 44)}${vtag}`,
      );
      if (COMMIT) {
        if (!img) {
          console.log("     !! no image, skipped");
          skipped++;
          continue;
        }
        if (await C.findOne({ name: u.name, brand: BRAND, isActive: true }).select("_id").lean()) {
          skipped++;
          continue;
        }
        const doc = new C({
          name: u.name,
          brand: BRAND,
          itemType: cfg.itemType,
          ...(category ? { category, subcategory } : {}),
          description,
          imageUrls: [img],
          createdBy: ADMIN_ID,
          isActive: true,
          ...(u.weight ? { weightGrams: u.weight } : {}),
          ...(u.model ? { modelNumber: u.model } : {}),
          ...(u.variantAxes ? { variantAxes: u.variantAxes, variants: u.variants, defaultVariantKey: u.defaultVariantKey } : {}),
          attributes: u.attrs,
        });
        doc.$locals.lenientAttributes = true;
        try {
          await doc.save();
        } catch (e) {
          console.log("     !! " + e.message);
          skipped++;
          continue;
        }
        await O.create({
          network: "direct",
          region: "global",
          merchantId: "direct-altongoods",
          merchantName: "Alton Goods",
          productId: doc._id,
          deepLink: url,
          priority: 0,
        });
      }
      created++;
    }
  }

  console.log(
    `\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} item(s), ${skipped} skipped, ${missing} feed-missing (from ${Object.keys(KEEP).length} keep-entries)`,
  );
  await mongoose.disconnect();
})();
