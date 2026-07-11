/**
 * create-blackdiamond.js — Black Diamond (blackdiamondequipment.com), Shopify (open
 * products.json, 1071 products). Targeted create: BD is mostly climbing + ski gear;
 * we import only a hand-picked set of backpacking-relevant product_types PLUS the
 * climbing gear the user explicitly asked for (helmets, harnesses) and the
 * mountaineering + small-accessory buckets they selected (crampons, ice axes,
 * microspikes, UL bivy, headlamp batteries). Full scope decision + the "back and
 * forth on categories" is logged in CATALOG_CURATION_HANDOFF.md.
 *
 * Kept product_types (feed weights are REAL and often per-size — used directly,
 * unlike LiteAF/Bonfus/Altra where the feed weight was junk): Headlamps, Lanterns,
 * Hiking/Trekking/Running Poles, Hiking Packs, Tent, Gaiters, Helmets, Harnesses,
 * Crampons, Ice Axes, Traction Devices, Bivy Sacks, Batteries.
 *
 * Excluded: all ski gear, pure climbing hardware (carabiners/quickdraws/protection/
 * ropes/belay/chalk/big wall/crash pads/climbing packs/ice screws+tools), all
 * apparel, rock climbing shoes, running/hydration packs + approach shoes (user
 * declined), spare parts, duffels, gift cards. Per-item junk also dropped:
 * Past-Season, kids', "Package" bundles, Satellite Bag.
 *
 * itemType mapping — the backpacking-core types map to real schema itemTypes and get
 * their name-parseable headline attribute (headlamp lumens, pack volume, tent
 * capacity, pole material/soldAs). The climbing/mountaineering gear (helmets,
 * harnesses, crampons, ice axes, microspikes, bivy, batteries) has NO matching
 * schema itemType in a backpacking app -> "Other" (gender/model stays in the name).
 * Deeper attrs (headlamp burn time/IP rating, pole lengths/lock, tent season rating,
 * lantern battery) are a PHASE-2 spec-page scrape — noted in the handoff, not done
 * here (matches the OR/Nemo "structure now, deep attrs later" precedent).
 *
 * ⚠ Gaiter feed weight is a flat placeholder 200g across every model AND every size
 *   (clearly a default) -> nulled, not trusted (no-weight policy). ⚠ Storm+ Headlamp
 *   feed weight is 8200g (obvious data error; the near-identical Storm is 145g) ->
 *   corrected to 145.
 *
 *   node src/scripts/create-blackdiamond.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED_BASE = "https://www.blackdiamondequipment.com/products.json?limit=250";
const JUNK = /past season|kids'|kid's|big kids|package|satellite bag|\bdonation\b|gift card|egift/i;
// Non-product / out-of-scope items caught by an in-scope product_type but that
// aren't the gear we want: pole replacement straps, a headlamp bundle SKU, a
// climbing gear sling (not a harness), the kids' headlamp, and the Big Wall hooped
// bivy (user wanted the UL Spotlight bivy only — but it's out of stock, so 0 bivies
// this pass; revisit if Spotlight restocks).
const NAME_EXCLUDE = /FKT Straps|\bBundle\b|Gear Sling|Wiz Kid|Hooped Bivy/i;
// Old thin manual BD entries (Jan–Mar 2026) that this feed import supersedes with a
// richer version (real feed weights, Size variants, full image galleries). Archived
// before import — same archive-legacy-keep-fresh call the user made for Altra's
// duplicate legacy entries (reversible; the archived ghost lingers, harmless).
const SUPERSEDE = ["Alpine Carbon Cork Hiking Poles", "Storm 450", "Distance Carbon Z Poles", "Distance Carbon FLZ Poles"];

// product_type -> how to type/categorize it. modelSize=model a Size variant axis
// (color always collapsed). attrs(product) returns base attributes for the item.
const TYPE_CONFIG = {
  Headlamps: { itemType: "Headlamp", category: "Electronics & Power", subcategory: "Headlamps", modelSize: true, attrs: (p) => withLumens({}, p.title) },
  Lanterns: { itemType: "Camp Lantern", category: "Electronics & Power", subcategory: "Lighting", modelSize: true, attrs: (p) => withLumens({}, p.title) },
  "Hiking Poles": { itemType: "Trekking Poles", category: "Accessories & Tools", subcategory: "Trekking Poles", modelSize: true, attrs: (p) => poleAttrs(p.title) },
  "Trekking Poles": { itemType: "Trekking Poles", category: "Accessories & Tools", subcategory: "Trekking Poles", modelSize: true, attrs: (p) => poleAttrs(p.title) },
  "Running Poles": { itemType: "Trekking Poles", category: "Accessories & Tools", subcategory: "Trekking Poles", modelSize: true, attrs: (p) => poleAttrs(p.title) },
  "Hiking Packs": { itemType: null /* derived per-item */, packLike: true, modelSize: true },
  Tent: { itemType: "Backpacking Tent", category: "Shelter", subcategory: "Tents", modelSize: false, attrs: (p) => tentAttrs(p.title) },
  Gaiters: { itemType: "Hat/Headwear", category: "Unisex Clothing", subcategory: "Headwear", modelSize: true, nullWeight: true, attrs: () => ({}) },
  Helmets: { itemType: "Other", category: "Accessories & Tools", modelSize: true, attrs: () => null },
  Harnesses: { itemType: "Other", category: "Accessories & Tools", modelSize: true, attrs: () => null },
  Crampons: { itemType: "Other", category: "Accessories & Tools", modelSize: true, attrs: () => null },
  "Ice Axes": { itemType: "Other", category: "Accessories & Tools", modelSize: true, attrs: () => null },
  "Traction Devices": { itemType: "Other", category: "Accessories & Tools", modelSize: true, attrs: () => null },
  "Bivy Sacks": { itemType: "Other", category: "Shelter", modelSize: false, attrs: () => null },
  Batteries: { itemType: "Other", category: "Electronics & Power", modelSize: false, attrs: () => null },
};

function withLumens(base, title) {
  const nums = (title.match(/\d{3,4}/g) || []).map(Number).filter((n) => n >= 100 && n <= 9999);
  if (nums.length) base.maxLumens = Math.max(...nums);
  return base;
}
function poleAttrs(title) {
  // BD's in-scope poles are all either full-carbon or full-aluminum shafts (no
  // alu/carbon hybrids); "Carbon Cork" = carbon shaft with a cork grip, still carbon.
  return { soldAs: "Pair", material: /carbon/i.test(title) ? "Carbon Fiber" : "Aluminum" };
}
function tentAttrs(title) {
  const base = {};
  const m = title.match(/(\d+)\s*Person/i);
  if (m) base.capacity = `${m[1]}-Person`;
  return base;
}
function packInfo(title) {
  const isWaist = /waist pack|hip pack/i.test(title);
  const m = title.match(/\b(\d{1,3})\b/);
  const vol = m ? Number(m[1]) : undefined;
  const gender = /women'?s/i.test(title) ? "Womens" : "Unisex";
  let itemType, category, subcategory, attrs = {};
  if (isWaist) {
    itemType = "Hip Pack";
    category = "Backpacks & Bags";
    subcategory = "Day Packs & Accessories";
    if (vol != null) attrs.volumeLiters = vol;
  } else {
    itemType = vol != null && vol < 20 ? "Daypack" : "Backpack";
    category = "Backpacks & Bags";
    subcategory = itemType === "Daypack" ? "Day Packs & Accessories" : "Backpacking Packs";
    if (vol != null) attrs.volumeLiters = vol;
    attrs.gender = gender;
  }
  return { itemType, category, subcategory, attrs };
}

// Feed weight, with the known bad values corrected/nulled.
function fixWeight(grams, product) {
  if (product.product_type === "Gaiters") return null; // flat 200 placeholder
  if (/Storm\+ Headlamp/i.test(product.title)) return 145; // 8200 data error
  return grams && grams > 0 ? grams : null;
}

function gallery(p) {
  const first = p.images?.[0];
  if (!first) return [];
  const fn = first.src.split("/").pop().split("?")[0];
  const parts = fn.split("_");
  if (parts.length >= 3) {
    const prefix = parts.slice(0, 2).join("_") + "_";
    const g = p.images.filter((im) => im.src.split("/").pop().startsWith(prefix)).map((im) => im.src);
    if (g.length) return g.slice(0, 10);
  }
  return p.images.map((im) => im.src).slice(0, 10);
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 6; page++) {
    let json;
    for (let t = 0; t < 3 && !json; t++) {
      try {
        const res = await fetch(`${FEED_BASE}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) json = await res.json();
      } catch (e) {
        /* retry */
      }
      if (!json) await new Promise((r) => setTimeout(r, 500));
    }
    if (!json || !json.products?.length) break;
    out.push(...json.products);
  }
  return out;
}

(async () => {
  const products = await fetchAll();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const inScope = products.filter(
    (p) => TYPE_CONFIG[p.product_type] && p.variants.some((v) => v.available) && !JUNK.test(p.title) && !NAME_EXCLUDE.test(p.title)
  );

  if (COMMIT) {
    const arch = await C.updateMany(
      { brand: /black diamond/i, name: { $in: SUPERSEDE }, isActive: true },
      { $set: { isActive: false } }
    );
    console.log(`archived ${arch.modifiedCount} superseded legacy BD item(s)\n`);
  }

  let created = 0;
  const counts = {};
  for (const p of inScope) {
    const cfg = TYPE_CONFIG[p.product_type];
    const name = p.title.trim();
    // Only skip on an ACTIVE existing item (an archived/superseded ghost with the
    // same name shouldn't block the fresh richer version).
    const existing = await C.findOne({ name, brand: /black diamond/i, isActive: true }).lean();
    if (existing) {
      console.log(`${name}: already active — skip`);
      continue;
    }

    // resolve itemType/category/attrs (packs derive per-item)
    let itemType, category, subcategory, baseAttrs;
    if (cfg.packLike) {
      const info = packInfo(name);
      ({ itemType, category, subcategory } = info);
      baseAttrs = info.attrs;
    } else {
      itemType = cfg.itemType;
      category = cfg.category;
      subcategory = cfg.subcategory;
      baseAttrs = cfg.attrs ? cfg.attrs(p) : null;
    }

    // Size variants (color always collapsed)
    let variantAxes, variants, defaultVariantKey, itemWeight;
    const sizeIdx = p.options.findIndex((o) => o.name === "Size");
    const modelSize = cfg.modelSize && sizeIdx >= 0 && p.options[sizeIdx].values.length > 1;
    if (modelSize) {
      const optKey = "option" + (sizeIdx + 1);
      const sizes = p.options[sizeIdx].values;
      variants = sizes.map((s) => {
        const vs = p.variants.filter((v) => v[optKey] === s);
        const av = vs.find((v) => v.available) || vs[0];
        return { key: s, options: { Size: s }, weightGrams: fixWeight(av?.grams, p) ?? undefined };
      });
      variantAxes = [{ name: "Size", values: sizes }];
      const firstAvail = p.variants.find((v) => v.available);
      defaultVariantKey = firstAvail ? firstAvail[optKey] : sizes[0];
      const defVar = variants.find((v) => v.key === defaultVariantKey) || variants[0];
      itemWeight = defVar.weightGrams ?? null;
    } else {
      const firstAvail = p.variants.find((v) => v.available) || p.variants[0];
      itemWeight = fixWeight(firstAvail?.grams, p);
    }

    const images = gallery(p);
    const deepLink = `https://www.blackdiamondequipment.com/products/${p.handle}`;
    const description = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);

    counts[itemType] = (counts[itemType] || 0) + 1;
    console.log(
      `${name.slice(0, 40).padEnd(40)} ${String(itemType).padEnd(16)} ${itemWeight ?? "?"}g  imgs:${images.length}  ${
        modelSize ? `Size[${variants.map((v) => v.key + "=" + (v.weightGrams ?? "?")).join(", ")}]` : "one-size"
      }${baseAttrs && Object.keys(baseAttrs).length ? "  " + JSON.stringify(baseAttrs) : ""}`
    );

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${name}: no images — skip`);
        continue;
      }
      const doc = new C({
        name,
        brand: "Black Diamond",
        itemType,
        ...(category ? { category, subcategory } : {}),
        description,
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(itemWeight != null ? { weightGrams: itemWeight } : {}),
        ...(modelSize ? { variantAxes, variants, defaultVariantKey } : {}),
        ...(baseAttrs && Object.keys(baseAttrs).length ? { attributes: baseAttrs } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try {
        await doc.save();
      } catch (e) {
        console.log(`   !! ${name}: ${e.message}`);
        continue;
      }
      await O.create({
        network: "direct",
        region: "global",
        merchantId: "direct-blackdiamond",
        merchantName: "Black Diamond",
        productId: doc._id,
        deepLink,
        priority: 0,
      });
      created++;
    }
  }
  console.log(`\nby itemType:`, counts);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created}/${inScope.length} created`);
  await mongoose.disconnect();
})();
