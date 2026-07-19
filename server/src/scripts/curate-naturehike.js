/**
 * curate-naturehike.js — Naturehike post-ingest curation.
 *
 * Ran AFTER `ingest-shopify-catalog.js --domain naturehike.com --brand Naturehike
 * --merchant-name Naturehike --collapse-color --commit` (355 items, real feed
 * weights, direct offers).
 *
 * SCOPE (user, 2026-07-15): "Strict UL tents (~25) + Cookware & Stoves." Core
 * always-kept = tents (strict-UL only), sleeping bags, sleeping pads, backpacks,
 * trekking poles, pillows, dry bags. Explicitly OUT: lights/lanterns, water
 * bottles/tanks, apparel, furniture/cots/carts/canopies, swimming, luxury.
 *
 * Naturehike's feed is furniture-heavy and the auto-typer mis-fired in two ways
 * this fixes:
 *  1. Every "...Backpacking Tent" title matched the "backpack" rule BEFORE "tent"
 *     -> ~40 flagship tents (Cloud Up/Mongar/Star River/Tagar/Star Trail/Summiture)
 *     landed as itemType "Backpack". RETYPED to Backpacking Tent here.
 *  2. Furniture/lights/etc. came in untyped (95) -> archived.
 *
 * TENT KEEP-LIST (strict UL): keep only the UL backpacking model families
 * (Cloud Up / Mongar / Star River / Star Trail / Tagar / DABAN / JIMS / Summiture
 * / Cloud Trek / Giling) AT 1–2 person AND <=2500 g AND not a "Base/BASE" crossover.
 * Everything heavier / 3P+ / car-camping (pop-up/cabin/glamping/hot/teepee/yurt/
 * canopy/shower/pet/instant/Village/KOTA/Cape/Dune/Ranch/Brighten/GEN/Opalus/
 * Cloud River/Cloud Peak/Bleik/P-Series) -> archived.
 *
 * WITHIN-CATEGORY archive (car-camping outliers by weight/name):
 *  - Inflatable Sleeping Pad: archive >2200 g or air-mattress/car-camping (keeps
 *    the TuYe/FC/Yugu/D-series UL pads, drops the built-in-pump air mattresses).
 *  - Stove (Canister): archive >2000 g (drops the 2-burner/tabletop car-camping
 *    stoves, keeps the compact canister stoves).
 *  - Stove (Wood): archive — Naturehike's are 8–9.75 kg hot-tent chimney stoves
 *    (basecamp), not backpacking twig stoves.
 *  - Tarp Shelter: archive — both are 4.5–7 kg CANVAS car-camping tarps.
 *  - Utensil: archive BBQ/grill tools (keep Ti cutlery).
 *  - Ground Sheet: archive the fly/inner/footprint PARTS bundle (keep the footprint).
 *  - Backpack: archive the inflatable kayak + a pack rain-cover (keep real packs).
 *  - Sleeping Bag: archive double/envelope/kids/car-camping or >2600 g.
 *
 * UNTYPED KEEPERS retyped: "…Doublewide Pad" -> Inflatable Sleeping Pad; Ti/alu
 * kettles + Ti cup/bowl -> Backpacking Pot; tableware/cutlery set -> Utensil;
 * sport towels -> Travel Towel. All other untyped -> archive.
 *
 * FLAGGED FOR USER (archived per the strict scope, trivially re-includable): a
 * Headlamp, a Hydration Reservoir, and 3 compact UL pad Air Pumps — all genuinely
 * backpacking but outside the confirmed tents+sleep+pack+cookware scope.
 *
 * Weights are the real feed weights (spot-checked, plausible gradient) — nothing
 * fabricated. Archived = isActive:false (excluded from prod, reversible).
 *
 *   node src/scripts/curate-naturehike.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const CAT = {
  "Backpacking Tent": ["Shelter", "Tents"],
  "Inflatable Sleeping Pad": ["Sleep System", "Sleeping Pads"],
  "Backpacking Pot": ["Kitchen & Cooking", "Cookware"],
  Utensil: ["Kitchen & Cooking", "Utensils"],
  "Travel Towel": ["Travel", "Personal Care"],
};

// name tokens
const PART_NOISE = /shipping fee|price difference|add-on gift|gear repair|repair patch|repair outdoor patch|tent pole|pole accessor|tent hook|tent accessories|ground cloth|top cover|storage bag|carry bag|d-shaped|hiking hook|tool organizer|fire starter|kindling/i;
const FURNITURE = /\bchair\b|\btable\b|stool|\bcot\b|\bcart\b|wagon|canopy|awning|sunshade|sun sha|sunsha|\bshade\b|furniture|hammock|storage box|\bshelf\b|\brack\b|cooler|\bbucket\b|water bag|water storage|storage jug|\bjug\b|picnic mat|moisture[- ]?proof|foam camping sleeping|inflatable bed|inflatable lounger|\bsofa\b|carpet|wool blanket|foot cover|goose down foot|\bbbq\b|\bgrill\b|fire pit|firepit|fire grill|\bheater\b|kitchen box|mobile kitchen|director chair|coffee cup|butane camping heater/i;
const LIGHTS = /camping (light|lamp|lantern)|\blantern\b|led (work|camping)|work light|headlight|\btorch\b|flashlight|stepless dimming|lumen rechargeable/i;
const WATER = /water bottle|water tank|\bflask\b|\bbottle\b|\btumbler\b|coffee cup|collapsible bucket/i;
const SWIM = /swimming|\bbeach\b|snorkel|\bfloat\b/i;
// tent scope
const TENT_KEEP_MODEL = /(cloud up|mongar|star river|star trail|tagar|daban|jims|summiture|cloud trek|giling)/i;
const TENT_1_2P = /1[-\s]?person|2[-\s]?person|1p\b|2p\b/i;
const IS_TENT = /\btent\b/i;

const decide = (i) => {
  const n = i.name || "";
  const g = i.weightGrams || 0;
  const T = i.itemType || null;

  if (PART_NOISE.test(n)) return { keep: false, reason: "part/noise/non-product" };

  // ---- Tents ----
  if (IS_TENT.test(n)) {
    if (/pet tent/i.test(n)) return { keep: false, reason: "pet tent" };
    const strictUL =
      TENT_KEEP_MODEL.test(n) && TENT_1_2P.test(n) && g > 0 && g <= 2500 && !/\bbase\b/i.test(n);
    if (strictUL) {
      const cap = /3[-\s]?person/i.test(n) ? "3-Person" : /2[-\s]?person|2p\b/i.test(n) ? "2-Person" : "1-Person";
      const season = /4[-\s]?season|ext\b/i.test(n) ? "4-Season" : "3-Season";
      return { keep: true, retype: "Backpacking Tent", attrs: { capacity: cap, seasonRating: season }, reason: "strict-UL tent" };
    }
    return { keep: false, reason: "tent out of strict-UL scope (heavy/3P+/Base/car-camping)" };
  }

  // ---- clear archive buckets (out of scope) ----
  if (FURNITURE.test(n)) return { keep: false, reason: "furniture / car-camping" };
  if (LIGHTS.test(n) || T === "Camp Lantern" || T === "Torch Light") return { keep: false, reason: "light/lantern (out of scope)" };
  if (SWIM.test(n)) return { keep: false, reason: "swimming/beach" };
  if (["Gloves (Insulated)", "Hat/Headwear", "Hiking Pants", "Rain Poncho", "Camp Chair"].includes(T) || /jacket|\bpants\b|\bglove|\bponcho\b|down coat/i.test(n))
    return { keep: false, reason: "apparel (out of scope)" };
  if (T === "Headlamp") return { keep: false, reason: "FLAG: headlamp — archived per strict scope, re-includable" };
  if (T === "Hydration Reservoir") return { keep: false, reason: "FLAG: hydration reservoir — archived per strict scope, re-includable" };
  if (T === "Air Pump") return { keep: false, reason: "FLAG: UL pad air pump — archived per strict scope, re-includable" };
  if (WATER.test(n)) return { keep: false, reason: "water bottle/tank (out of scope)" };

  // ---- keep categories (with car-camping outlier archives) ----
  if (T === "Sleeping Bag") {
    if (g > 2600 || /double|envelope|kids|children|car ?camping/i.test(n)) return { keep: false, reason: "car-camping/double/kids sleeping bag" };
    return { keep: true, reason: "sleeping bag" };
  }
  if (T === "Sleeping Bag Liner") return { keep: true, reason: "bag liner" };
  if (T === "Inflatable Sleeping Pad") {
    if (g > 2200 || /car ?camping|air mattress|\bking\b|double (camping|mattress|air)/i.test(n)) return { keep: false, reason: "car-camping air mattress" };
    return { keep: true, reason: "UL sleeping pad" };
  }
  if (T === "Pillow") return { keep: true, reason: "pillow" };
  if (T === "Trekking Poles") return { keep: true, reason: "trekking poles" };
  if (T === "Dry Bag / Stuff Sack") return { keep: true, reason: "dry bag" };
  if (T === "Backpacking Pot") return { keep: true, reason: "cookware" };
  if (T === "Stove (Canister)") {
    if (g > 2000) return { keep: false, reason: "2-burner/tabletop car-camping stove" };
    return { keep: true, reason: "canister stove" };
  }
  if (T === "Stove (Wood)") return { keep: false, reason: "hot-tent chimney wood stove (basecamp)" };
  if (T === "Utensil") {
    if (/\bbbq\b|\bgrill|charcoal/i.test(n)) return { keep: false, reason: "BBQ/grill tool" };
    return { keep: true, reason: "utensil" };
  }
  if (T === "Tarp Shelter") return { keep: false, reason: "heavy canvas car-camping tarp" };
  if (T === "Ground Sheet") {
    if (/fly.*inner|inner.*foot|accessories\(/i.test(n)) return { keep: false, reason: "tent parts bundle" };
    return { keep: true, reason: "footprint" };
  }
  if (T === "Backpack") {
    if (/kayak|\bcover\b|\bcart\b|wagon|cooler/i.test(n)) return { keep: false, reason: "not a pack (kayak/cover)" };
    return { keep: true, reason: "backpack" };
  }

  // ---- untyped keepers ----
  if (!T) {
    if (/doublewide|double ?wide/i.test(n) && /inflatable/i.test(n)) return { keep: true, retype: "Inflatable Sleeping Pad", reason: "UL doublewide pad (untyped)" };
    if (/(titanium|aluminum|aluminium).*(kettle|cup|bowl|pot)|camping kettle/i.test(n)) return { keep: true, retype: "Backpacking Pot", reason: "cookware (untyped)" };
    if (/tableware.*set|cutlery set/i.test(n)) return { keep: true, retype: "Utensil", reason: "tableware/cutlery (untyped)" };
    if (/towel/i.test(n)) return { keep: true, retype: "Travel Towel", reason: "sport towel (untyped)" };
    return { keep: false, reason: "untyped noise (furniture/accessory/non-product)" };
  }

  // fallthrough: unknown typed item -> keep-but-flag
  return { keep: true, reason: `KEEP? unhandled itemType ${T}` };
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: /naturehike/i }).select("name itemType weightGrams category attributes").lean();

  let keep = 0,
    archive = 0,
    retyped = 0;
  const flags = [];
  const byReasonArchive = {};
  for (const i of items) {
    const d = decide(i);
    if (d.reason.startsWith("FLAG") || d.reason.startsWith("KEEP?")) flags.push(`${d.keep ? "KEEP" : "ARCH"} ${i.name.slice(0, 50)} — ${d.reason}`);
    if (d.keep) {
      keep++;
      if (d.retype && d.retype !== i.itemType) retyped++;
      if (COMMIT) {
        const set = { isActive: true };
        if (d.retype && d.retype !== i.itemType) {
          set.itemType = d.retype;
          const [cat, sub] = CAT[d.retype] || [];
          if (cat) {
            set.category = cat;
            set.subcategory = sub;
          }
        } else if (d.retype === "Backpacking Tent" || i.itemType === "Backpack") {
          // kept tent that was mistyped Backpack but retype===itemType path won't hit — handled above
        }
        if (d.attrs) set.attributes = { ...(i.attributes || {}), ...d.attrs };
        await C.collection.updateOne({ _id: i._id }, { $set: set });
      }
    } else {
      archive++;
      byReasonArchive[d.reason] = (byReasonArchive[d.reason] || 0) + 1;
      if (COMMIT) await C.collection.updateOne({ _id: i._id }, { $set: { isActive: false } });
    }
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — keep ${keep} | archive ${archive} | retyped ${retyped} (of ${items.length})`);
  console.log("\nArchive reasons:");
  for (const r of Object.keys(byReasonArchive).sort((a, b) => byReasonArchive[b] - byReasonArchive[a])) console.log(`  ${String(byReasonArchive[r]).padStart(3)}  ${r}`);
  console.log("\nFlags / unhandled:");
  for (const f of flags) console.log("  " + f);
  await mongoose.disconnect();
})();
