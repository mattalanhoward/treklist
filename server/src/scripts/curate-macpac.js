/**
 * curate-macpac.js — Macpac (macpac.com.au), Salesforce Commerce Cloud scrape.
 *
 * Macpac is on SFCC/Demandware — NO open feed (products.json/cart.json all 410,
 * same wall as Mountain Hardwear). BUT unlike MH, every PDP renders a full
 * "Product Specifications" <table> in static HTML (weight, materials, fill,
 * temp, floor area, etc.), so it's cleanly scrapeable. The scrape lives in a
 * committed snapshot `data/macpac-products.json` (334 Macpac-brand PDPs), so
 * this curate step runs offline + deterministically.
 *
 * REGENERATE THE SNAPSHOT (when refreshing):
 *   1. curl the sitemap: https://www.macpac.com.au/sitemap_1.xml
 *   2. keep <loc> ending /<digits>.html whose slug starts `macpac-` (own brand)
 *   3. curl each PDP (UA "Mozilla/5.0"), parse per PDP:
 *      name = og:title; category = dw.ac.applyContext({category:"..."});
 *      images = /dw/image/.../-Master/...jpg; price = "price":"NN.NN";
 *      spec = the <table> under "Product Specifications" (<td>k</td><td>v</td>).
 *   (A validated Python scraper produced this snapshot; see the session notes.)
 *
 * SCOPE (user decision 2026-07-17): CORE GEAR + INSULATION only — packs, tents,
 * sleeping bags/quilts, sleeping mats, insulated jackets, rain shells, fleece,
 * merino/synthetic base layers. SKIP casual apparel (tees/shirts/hoodies/pants/
 * shorts), footwear, kids, and accessories (socks/caps/gloves/beanies/gaiters/
 * bottles/cookware/stoves/furniture/towels/dry-bags/child-carriers). Resale
 * brands (Sea to Summit, Jetboil, Yeti, ...) are excluded — only `macpac-` own
 * brand is scraped, and S2S/Jetboil we already have direct.
 *
 * TYPING: derived from spec-signature FIRST (immune to promo/"sale" category
 * pollution), then category taxonomy, then name. `applyContext` category is
 * unreliable for ~40 items that were crawled under a promo collection (sale/
 * gifts/travel-collection), so a sale-hidden item like the Uber Synthetic Quilt
 * is still caught by its Fill-Type spec + "quilt" name. category/subcategory
 * come from the repo's own categoryForItemType() (gender-resolved).
 *
 * WEIGHTS (from the spec "Weight" row, all real):
 *   - packs: first "N kg/g" token (harness size S2 is a reference — disclosed).
 *   - tents: "Minimum weight" (trail weight), matching the Lanshan/Hilleberg
 *     convention; total weight noted in the description.
 *   - sleeping bags: "Bag only" figure (excludes stuff sack), disclosed.
 *   - apparel: reference-size weight (Men's M / Women's 10), disclosed per the
 *     flat-weight rule — no size variant axis (one published number).
 *
 * VARIANTS: only SLEEPING BAGS get an axis. Macpac lists "Standard <model>" +
 * "Large <model>" as separate PDPs = a Length fit-variant of ONE product per the
 * locked REI standard → consolidated to one item with a Length[Standard,Large]
 * axis + per-length bag-only weights. Women's bags stay SEPARATE (different temp
 * rating + gender, not a size of the unisex bag). Everything else is single-
 * config (packs quote one harness-size weight; apparel one reference size).
 *
 * OFFERS: direct, unmonetized macpac.com.au PDP links (merchantId
 * "direct-macpac"). No affiliate wired.
 *
 *   node src/scripts/curate-macpac.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only (set MONGO_DB_NAME=treklist_local)");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const DATA = path.join(__dirname, "data", "macpac-products.json");

// --- helpers ---------------------------------------------------------------
const toGrams = (numStr, unit) => {
  const n = parseFloat(String(numStr).replace(/,/g, ""));
  if (isNaN(n)) return null;
  return Math.round(unit && unit.toLowerCase() === "kg" ? n * 1000 : n);
};
const firstWeight = (s) => {
  // strip parentheticals first — they carry misleading numbers like harness
  // "(S2)", "(Size M)", or a component's "(each weigh 30 g)".
  const cleaned = String(s || "").replace(/\([^)]*\)/g, " ");
  const m = /([\d,.]+)\s*(kg|g)\b/i.exec(cleaned);
  return m ? toGrams(m[1], m[2]) : null;
};
const num = (s) => {
  const m = /(-?[\d,.]+)/.exec(s || "");
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
};
// volume in litres from a name, decimal-aware ("12.5L" -> 12.5, not 5)
const volOf = (n) => {
  const m = /(\d+(?:\.\d+)?)\s*l\b/i.exec(n);
  return m ? parseFloat(m[1]) : null;
};

function parseWeight(r, itemType) {
  const w = r.spec.Weight || "";
  if (itemType === "Sleeping Bag") {
    const bo = /Bag only:?\s*([\d,.]+)\s*(kg|g)/i.exec(w);
    if (bo) return toGrams(bo[1], bo[2]);
  }
  if (itemType === "Backpacking Tent") {
    const mn = /Minimum weight:?\s*([\d,.]+)\s*(kg|g)/i.exec(w);
    if (mn) return toGrams(mn[1], mn[2]);
  }
  return firstWeight(w);
}

function gender(name, category) {
  const n = name.toLowerCase();
  const c = category || "";
  if (/kids'|junior|\bbaby\b/.test(n) || c.startsWith("kids-") || c.includes("baby") || c.includes("child"))
    return "Kids";
  if (/women/.test(n) || c.startsWith("womens-")) return "Womens";
  if (/men'|mens/.test(n) || c.startsWith("mens-")) return "Mens";
  return "Unisex";
}

// --- classifier (spec-signature -> category -> name) -----------------------
function classify(r) {
  const n = r.name.toLowerCase();
  const c = r.category || "";
  const keys = new Set(Object.keys(r.spec));
  const g = gender(r.name, c);
  if (g === "Kids") return null;
  if (/child carrier|vamoose|carrier/.test(n)) return null; // child carriers
  if (/\bbra\b|boxer/.test(n)) return null; // underwear, not a tracked base layer

  if (keys.has("Persons") && (keys.has("Fly Fabric") || keys.has("Pole Type"))) return "Backpacking Tent";
  if (keys.has("Sleeping Bag Shape") || (keys.has("Fill Power (cuin)") && keys.has("Temperature Rating") && !n.includes("quilt")))
    return "Sleeping Bag";
  if (n.includes("quilt") && (keys.has("Fill Type") || keys.has("Fill Power (cuin)"))) return "Quilt";
  if (keys.has("Harness")) {
    const v = volOf(n);
    return v && v <= 30 ? "Daypack" : "Backpack";
  }
  if (c.includes("sleeping_gear-mats") || ((keys.has("R-Value") || keys.has("R Value")) && n.includes("mat"))) {
    const wt = firstWeight(r.spec.Weight);
    if (wt && wt > 2000) return null; // car-camping self-inflating mats
    return n.includes("foam") ? "Foam Sleeping Pad" : "Inflatable Sleeping Pad";
  }
  if (c.startsWith("backpacks_bags-outdoor_adventure")) {
    if (c.includes("child_carrier")) return null;
    const v = volOf(n);
    if (c.includes("daypack") || c.includes("running") || (v && v <= 30)) {
      return v != null && v < 10 ? null : "Daypack"; // <10L isn't a daypack (e.g. running belt)
    }
    return "Backpack";
  }
  if (c === "backpacks_bags-travel-backpacks") {
    const v = volOf(n);
    return v && v <= 30 ? "Daypack" : "Backpack";
  }
  if (c.includes("down_insulated_jackets")) return "Insulated Jacket";
  if (c.includes("-vests")) return n.includes("fleece") ? "Fleece Jacket" : "Insulated Jacket";
  if (c.includes("rain_jackets")) return "Rain Jacket";
  if (c.includes("fleece_jackets") || (n.includes("fleece") && n.includes("jacket"))) return "Fleece Jacket";
  if (c.includes("merino_jackets")) return "Fleece Jacket";
  if (c.includes("thermals-tops") || (c.includes("base_layers") && !c.includes("legging") && !c.includes("underwear")))
    return "Base Layer Top";
  if (c.includes("thermals-pants_underwear") || c.includes("thermals-leggings_underwear") ||
      (c.includes("base_layers") && (c.includes("legging") || c.includes("underwear"))))
    return "Base Layer Bottom";
  if ((keys.has("Fill Type") || keys.has("Fill Power (cuin)")) && /jacket|vest|hooded/.test(n))
    return "Insulated Jacket";
  return null;
}

// --- per-type attribute mapping --------------------------------------------
const shapeMap = (s) => {
  const v = (s || "").toLowerCase();
  if (v.includes("semi")) return "Semi-Rectangular";
  if (v.includes("rectangular")) return "Rectangular";
  if (v.includes("mummy")) return "Mummy";
  return undefined;
};
const insulationFromName = (n) => (/down/i.test(n) ? "Down" : "Synthetic");
const fillPowerOf = (r) => {
  const v = num(r.spec["Fill Power (cuin)"]);
  return v && v >= 550 ? v : undefined;
};
const tempC = (r) => {
  let t;
  const lim = /Limit\s*(-?\d+)/i.exec(r.spec["Temperature Rating"] || "");
  if (lim) t = +lim[1];
  else {
    const nm = /\(\s*(-?\d+)\s*°?c\s*\)/i.exec(r.name);
    t = nm ? +nm[1] : undefined;
  }
  // schema caps tempRatingC at 16; warm-weather bags (e.g. Escapade 17°C) keep
  // the rating in the name/description instead of a clamped/invalid number.
  return t != null && t <= 16 ? t : undefined;
};

function attrsFor(itemType, r, g) {
  const n = r.name;
  const sp = r.spec;
  const A = {};
  const set = (k, v) => { if (v !== undefined && v !== null && v !== "") A[k] = v; };
  const genderAttr = g === "Kids" ? "Unisex" : g;
  switch (itemType) {
    case "Backpacking Tent":
      set("capacity", (num(sp.Persons) ? num(sp.Persons) : 0) + "-Person");
      set("seasonRating", "3-Season");
      set("tentType", (sp["Pole Count"] ? "Freestanding" : undefined));
      set("wallType", sp["Tent Inner Fabric"] ? "Double Wall" : undefined);
      set("floorAreaSqM", num(sp["Floor Area (m2)"]));
      set("vestibuleAreaSqM", num(sp["Vestibule Area (m2)"]));
      set("poleMaterial", /dac/i.test(sp["Pole Type"] || "") ? "DAC Featherlite" : (sp["Pole Type"] ? "Aluminum" : undefined));
      set("flyMaterial", sp["Fly Fabric"]);
      set("floorMaterial", sp["Floor Fabric"]);
      set("footprintIncluded", false);
      break;
    case "Backpack":
    case "Daypack": {
      set("volumeLiters", volOf(n) ?? undefined);
      set("gender", "Unisex");
      set("mainFabric", sp["Main Fabric"]);
      set("hipBeltType", "Padded");
      break;
    }
    case "Sleeping Bag":
      set("insulationType", insulationFromName(n));
      set("tempRatingC", tempC(r));
      set("shape", shapeMap(sp["Sleeping Bag Shape"]));
      set("gender", genderAttr === "Mens" ? "Unisex" : genderAttr); // bags are Unisex/Womens
      set("fillPower", fillPowerOf(r));
      set("fillWeightG", num(sp["Fill Weight (g)"]));
      break;
    case "Quilt":
      set("insulationType", insulationFromName(n));
      set("tempRatingC", tempC(r)); // often unpublished -> unset
      set("fillPower", fillPowerOf(r));
      set("fillWeightG", num(sp["Fill Weight (g)"]));
      break;
    case "Insulated Jacket":
      set("insulationType", insulationFromName(n));
      set("gender", genderAttr);
      set("fillPower", fillPowerOf(r));
      set("fillWeightG", num(sp["Fill Weight (g)"]));
      set("shellFabric", sp["Main Fabric"]);
      break;
    case "Rain Jacket":
      set("gender", genderAttr);
      set("membrane", sp["Main Fabric"]);
      break;
    case "Fleece Jacket":
      set("gender", genderAttr);
      set("fleeceType", /grid|polartec/i.test(sp["Main Fabric"] || "") ? "Grid Fleece" : (/merino/i.test(n) ? "Sweater Fleece" : "Classic Fleece"));
      set("material", sp["Main Fabric"]);
      break;
    case "Base Layer Top":
    case "Base Layer Bottom": {
      const merino = /merino/i.test(sp["Main Fabric"] || "") || /merino/i.test(n);
      set("gender", genderAttr);
      set("fabricType", merino ? "Merino Wool" : "Synthetic");
      const gsm = /\b(1\d0|2[0-9]0)\b/.exec(n); // 150/180/220 etc
      const g2 = gsm ? +gsm[1] : undefined;
      set("fabricWeightGsm", g2);
      set("weight", g2 ? (g2 <= 160 ? "Lightweight" : g2 <= 200 ? "Midweight" : "Heavyweight") : "Midweight");
      break;
    }
    case "Inflatable Sleeping Pad":
      set("rValue", num(sp["R-Value"] || sp["R Value"])); // often unpublished -> unset
      set("shape", /mummy/i.test(n) ? "Mummy" : "Rectangular");
      set("inflationMethod", "Blow Valve");
      break;
  }
  return A;
}

// --- description -----------------------------------------------------------
function describe(itemType, r, note) {
  const sp = r.spec;
  const bits = [];
  if (itemType === "Backpacking Tent") {
    bits.push(`A ${num(sp.Persons)}-person Macpac hiking tent`);
    if (sp["Pole Type"]) bits.push(`with ${sp["Pole Type"]} poles`);
    if (sp["Fly Fabric"]) bits.push(`— ${sp["Fly Fabric"].split(" (")[0]} fly`);
  } else if (itemType === "Sleeping Bag" || itemType === "Quilt") {
    if (sp["Fill Type"]) bits.push(sp["Fill Type"]);
    if (sp["Temperature Rating"]) bits.push(`Rated ${sp["Temperature Rating"]}`);
  } else if (itemType === "Backpack" || itemType === "Daypack") {
    if (sp.Harness) bits.push(`${sp.Harness} harness`);
    if (sp["Main Fabric"]) bits.push(sp["Main Fabric"].split(";")[0]);
  } else {
    if (sp["Main Fabric"]) bits.push(sp["Main Fabric"]);
  }
  let d = bits.filter(Boolean).join(". ").trim();
  if (d && !/[.!]$/.test(d)) d += ".";
  if (note) d += (d ? "\n\n" : "") + note;
  return d || `Macpac ${itemType}.`;
}

// --- build keeper records --------------------------------------------------
function buildKeepers(records) {
  const singles = [];
  const bagGroups = new Map(); // key -> {base, gender, members:[{len, r, w}]}

  for (const r of records) {
    const itemType = classify(r);
    if (!itemType) continue;
    const g = gender(r.name, r.category);
    const w = parseWeight(r, itemType);

    // consolidate unisex sleeping bags on Length
    const m = /^Macpac (Standard|Large) (.+)$/.exec(r.name);
    if (itemType === "Sleeping Bag" && m && g !== "Womens") {
      const base = m[2];
      const key = "U|" + base;
      if (!bagGroups.has(key)) bagGroups.set(key, { base, r, members: [] });
      bagGroups.get(key).members.push({ len: m[1], r, w });
      continue;
    }
    singles.push({ itemType, r, g, w });
  }

  const out = [];
  // finalize consolidated bags
  for (const grp of bagGroups.values()) {
    grp.members.sort((a, b) => (a.len === "Standard" ? -1 : 1));
    const rep = grp.members[0].r;
    const name = grp.base; // e.g. "Dragonfly 400 Down Sleeping Bag (-5°C)"
    if (grp.members.length < 2) {
      // only one length published -> plain single item, no axis
      out.push({ itemType: "Sleeping Bag", name, g: "Unisex", w: grp.members[0].w, rep,
        note: "Weight is the bag only (excludes stuff sack)." });
      continue;
    }
    const variants = grp.members.map((mem) => ({
      key: mem.len,
      options: { Length: mem.len },
      weightGrams: mem.w,
      attributes: { lengthSize: mem.len === "Large" ? "Long" : "Regular" },
    }));
    out.push({
      itemType: "Sleeping Bag",
      name,
      g: "Unisex",
      w: grp.members[0].w,
      rep,
      axisName: "Length",
      variants,
      defaultKey: "Standard",
      note: "Weight is the bag only (excludes stuff sack); Standard/Large differ by length.",
    });
  }
  // finalize singles
  for (const s of singles) {
    let name = s.r.name.replace(/^Macpac\s+/, "");
    let note = null;
    if (s.itemType === "Backpack" || s.itemType === "Daypack") {
      const m = /\((?:S\d|W\d)[^)]*\)/.exec(s.r.spec.Weight || "");
      if (m) note = `Weight is for harness/back size ${m[0].replace(/[()]/g, "")}.`;
    } else if (s.itemType === "Sleeping Bag") {
      note = "Weight is the bag only (excludes stuff sack).";
    } else if (s.itemType === "Backpacking Tent") {
      const tot = /Total weight:?\s*([\d,.]+\s*kg|[\d,.]+\s*g)/i.exec(s.r.spec.Weight || "");
      if (tot) note = `Minimum (trail) weight shown; total packed weight ${tot[1]}.`;
    } else if (/Jacket|Fleece|Base Layer|Rain/.test(s.itemType)) {
      const sz = /\(Size[^)]*\)|\(Size \d+\)/.exec(s.r.spec.Weight || "");
      note = `Weight is for the reference size (${(sz && sz[0].replace(/[()]/g, "")) || (s.g === "Womens" ? "Women's 10" : "Men's M")}); other sizes vary.`;
    }
    out.push({ itemType: s.itemType, name, g: s.g, w: s.w, rep: s.r, note });
  }
  return out;
}

(async () => {
  const records = require(DATA);
  const keepers = buildKeepers(records);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0;
  const byType = {};
  for (const k of keepers) {
    byType[k.itemType] = (byType[k.itemType] || 0) + 1;
    const existing = await C.findOne({ name: k.name, brand: /macpac/i }).lean();
    if (existing) { console.log(`${k.name}: exists — skip`); skipped++; continue; }

    const { category, subcategory } = categoryForItemType(k.itemType, k.rep.name) || {};
    const images = (k.rep.images || []).slice(0, 10);
    const deepLink = k.rep.url;
    const attributes = attrsFor(k.itemType, k.rep, k.g);
    const description = describe(k.itemType, k.rep, k.note);

    let axes = [], variants = [];
    if (k.axisName) {
      axes = [{ name: k.axisName, values: k.variants.map((v) => v.key) }];
      variants = k.variants;
    }

    console.log(
      `${k.name.slice(0, 44).padEnd(44)} ${k.itemType.padEnd(18)} ${String(k.w ?? "NULL").padStart(5)}g imgs:${images.length}${k.axisName ? ` [${k.variants.map((v) => v.key + "=" + v.weightGrams).join(",")}]` : ""}`
    );

    if (COMMIT) {
      if (!images.length) { console.log(`   !! ${k.name}: no images — skip`); continue; }
      const doc = new C({
        name: k.name,
        brand: "Macpac",
        itemType: k.itemType,
        ...(category ? { category, subcategory } : {}),
        description,
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(k.w != null ? { weightGrams: k.w } : {}),
        ...(axes.length ? { variantAxes: axes, variants, defaultVariantKey: k.defaultKey } : {}),
        ...(Object.keys(attributes).length ? { attributes } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); }
      catch (e) { console.log(`   !! ${k.name}: ${e.message}`); continue; }
      await O.create({
        network: "direct", region: "global",
        merchantId: "direct-macpac", merchantName: "Macpac",
        productId: doc._id, deepLink, priority: 0,
      });
      created++;
    }
  }
  console.log(`\nby type: ${JSON.stringify(byType)}`);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${keepers.length} keepers (${created} created, ${skipped} existing)`);
  await mongoose.disconnect();
})();
