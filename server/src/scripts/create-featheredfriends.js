/**
 * create-featheredfriends.js — Feathered Friends (featheredfriends.com), Shopify
 * (open products.json). ⚠ FF is a multi-brand RETAILER (Arc'teryx/Patagonia/OR/
 * Hilleberg/... in the feed) as well as a maker — import ONLY vendor="Feathered
 * Friends" (their own premium down gear), never the resold brands (those duplicate
 * our direct imports; the "mud" rule). FF's own line = 74 products.
 *
 * ⚠ Feed variant `grams` are ROUND SHIPPING weights (Swallow UL shows 1814g = 4 lb
 * flat across every temp+length; useless). REAL weights + temp ratings + fill
 * weights live in a spec table embedded in each product's body_html (no page scrape
 * needed) — parsed here.
 *
 * SLEEPING BAGS / QUILTS (the prize): FF sells many as one Shopify product with a
 * Temperature option (Swallow UL 20/30). Per the LOCKED variant standard, temperature
 * = product IDENTITY, not a variant → each temp becomes its own CatalogItem (Swallow
 * UL 20, Swallow UL 30), with **Length** as the only variant axis (Regular/Long,
 * Small/Medium for women's, or 68"/74"), color dropped. Per-temp, per-length real
 * weights come from the "Average Weight" table row; fill weight from "Fill Weight";
 * fill power from tags (900+/950+). Flicker "...Quilt" models -> Quilt itemType;
 * everything else -> Sleeping Bag. Women's = separate products (gender attr from name).
 *
 * DOWN GARMENTS: jackets/vests/parkas -> Insulated Jacket (gendered, Size axis, color
 * dropped). Their published weight is a size-Medium reference -> item weight + a
 * "size Medium" disclaimer in the description (the reference-size disclosure rule).
 * Down Pillow -> Pillow.
 *
 * EXCLUDED: kids' bags; home bedding (Down Comforter/Throw/Blanket/Bedding
 * Accessories); down pants + Expedition Down Suits (niche, no good itemType);
 * Closeout / Previous-Model dupes.
 *
 *   node src/scripts/create-featheredfriends.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://featheredfriends.com/products.json?limit=250";

// ---- weight-table parser (validated against all 41 non-kids bags) ----
function normLen(s) {
  s = s.toLowerCase().trim();
  if (/^reg/.test(s)) return "Regular";
  if (/^long/.test(s)) return "Long";
  if (/^small/.test(s)) return "Small";
  if (/^med/.test(s)) return "Medium";
  const m = s.match(/(\d+)\s*(?:"|inch)/);
  if (m) return m[1] + " Inch";
  return s;
}
function toGrams(str) {
  const g = str.match(/(\d[\d,]*)\s*g\b/);
  if (g) return parseInt(g[1].replace(/,/g, ""));
  const lb = str.match(/(\d+)\s*lb/);
  const oz = str.match(/([\d.]+)\s*oz/);
  if (lb || oz) return Math.round(((lb ? parseInt(lb[1]) * 16 : 0) + (oz ? parseFloat(oz[1]) : 0)) * 28.3495);
  return null;
}
function parseLenGrams(cell) {
  const o = {};
  const markers = [...cell.matchAll(/(Regular|Reg|Long|Small|Medium|Med|\d+\s*"|\d+\s*inch)/gi)];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : cell.length;
    const g = toGrams(cell.slice(start, end));
    if (g != null) o[normLen(markers[i][1])] = g;
  }
  return o;
}
function parseTable(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const tbl = tables.find((t) => /temp rating/i.test(t));
  if (!tbl) return null;
  const rows = tbl.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const cellsOf = (r) => (r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) || []).map((c) => c.replace(/<[^>]+>/g, " ").replace(/&#\d+;|&deg;|&nbsp;/g, " ").replace(/\s+/g, " ").trim());
  const map = {};
  for (const r of rows) {
    const c = cellsOf(r);
    if (c.length) map[(c[0] || "").toLowerCase()] = c.slice(1).filter((x) => x !== "");
  }
  const temps = (map["temp rating"] || []).map((s) => {
    if (/not rated/i.test(s)) return "NR";
    const m = s.match(/(-?\d+)\s*[°ºo]?\s*F/i);
    return m ? parseInt(m[1]) : null;
  });
  const avg = (map["average weight"] || []).map(parseLenGrams);
  const fill = (map["fill weight"] || []).map(parseLenGrams);
  return { temps, avg, fill };
}

const WOMENS = /\bwomen'?s\b/i;
function gallery(p) {
  return (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 8);
}
function fillPowerFromTags(tags) {
  const t = (tags || []).find((x) => /fill power/i.test(x));
  const m = t && t.match(/(\d{3})/);
  return m ? parseInt(m[1]) : undefined;
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 3; page++) {
    let json;
    for (let t = 0; t < 3 && !json; t++) {
      try {
        const res = await fetch(`${FEED}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) json = await res.json();
      } catch (e) { /* retry */ }
      if (!json) await new Promise((r) => setTimeout(r, 500));
    }
    if (!json || !json.products?.length) break;
    out.push(...json.products);
  }
  return out;
}

function bagCore(title) {
  return title
    .split(" - ")[0]
    .replace(/\bsleeping bag\b/gi, "")
    .replace(/\bmuscovy down\b/gi, "")
    .replace(/\d+\/\d+/g, "")
    .replace(/\b\d+\s*degree\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function buildBagName(core, tempF, hasTempOpt) {
  if (tempF === "NR" || tempF == null) return core;
  const re = new RegExp("(^|\\s)" + tempF + "(\\s|$)");
  if (!hasTempOpt && re.test(core)) return core;
  return (core + " " + tempF).replace(/\s+/g, " ").trim();
}

(async () => {
  const products = await fetchAll();
  const own = products.filter((p) => /feathered friends/i.test(p.vendor || ""));
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  const counts = {};
  const makeOffer = (id, handle) =>
    O.create({ network: "direct", region: "global", merchantId: "direct-featheredfriends", merchantName: "Feathered Friends", productId: id, deepLink: `https://featheredfriends.com/products/${handle}`, priority: 0 });

  async function createItem({ name, itemType, category, subcategory, description, images, weightGrams, variantAxes, variants, defaultVariantKey, attributes, handle }) {
    const existing = await C.findOne({ name, brand: /feathered friends/i, isActive: true }).lean();
    if (existing) { console.log(`${name}: already active — skip`); return; }
    counts[itemType] = (counts[itemType] || 0) + 1;
    console.log(`${name.slice(0, 40).padEnd(40)} ${itemType.padEnd(16)} ${weightGrams ?? "?"}g imgs:${images.length} ${variantAxes ? "Len[" + variants.map((v) => v.key + "=" + (v.weightGrams ?? "?")).join(",") + "]" : ""} ${JSON.stringify(attributes)}`);
    if (!COMMIT) return;
    if (!images.length) { console.log(`   !! ${name}: no images — skip`); return; }
    const doc = new C({
      name, brand: "Feathered Friends", itemType,
      ...(category ? { category, subcategory } : {}),
      description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
      ...(weightGrams != null ? { weightGrams } : {}),
      ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
      ...(attributes && Object.keys(attributes).length ? { attributes } : {}),
    });
    doc.$locals.lenientAttributes = true;
    try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); return; }
    await makeOffer(doc._id, handle);
    created++;
  }

  for (const p of own) {
    const t = p.product_type;
    const title = p.title;

    // ---- SLEEPING BAGS / QUILTS ----
    if (/^Sleeping Bag/.test(t)) {
      if (/\bkid'?s\b|fledgling|flicker 20\/30 yf/i.test(title)) continue; // kids
      const parsed = parseTable(p.body_html);
      if (!parsed) { console.log(`!! ${title}: no weight table — skip`); continue; }
      const isQuilt = /quilt/i.test(title);
      const lengthOpt = p.options.find((o) => /length/i.test(o.name));
      const lengths = lengthOpt ? lengthOpt.values : [];
      const hasTempOpt = p.options.some((o) => /temperature/i.test(o.name));
      const gender = WOMENS.test(title) ? "Womens" : "Unisex";
      const fp = fillPowerFromTags(p.tags);
      const images = gallery(p);
      const core = bagCore(title);
      const description = p.body_html.replace(/<table[\s\S]*?<\/table>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);

      for (let i = 0; i < parsed.temps.length; i++) {
        const tempF = parsed.temps[i];
        const avgMap = parsed.avg[i] || {};
        const fillMap = parsed.fill[i] || {};
        const name = buildBagName(core, tempF, hasTempOpt);

        let variantAxes, variants, defaultVariantKey, itemWeight;
        if (lengths.length) {
          variants = lengths.map((L) => ({ key: L, options: { Length: L }, weightGrams: avgMap[normLen(L)] ?? undefined }));
          variantAxes = [{ name: "Length", values: lengths }];
          defaultVariantKey = lengths[0];
          itemWeight = variants[0].weightGrams ?? null;
        } else {
          itemWeight = Object.values(avgMap)[0] ?? null;
        }

        const attributes = { insulationType: "Down", gender };
        if (fp) attributes.fillPower = fp;
        if (typeof tempF === "number") {
          attributes.tempRatingF = tempF;
          attributes.tempRatingC = Math.round(((tempF - 32) * 5) / 9);
        }
        const fw = fillMap[normLen(lengths[0] || "")] ?? Object.values(fillMap)[0];
        if (fw) attributes.fillWeightG = fw;
        if (!isQuilt && !/2 person|spoonbill/i.test(title)) attributes.shape = "Mummy";

        await createItem({
          name, itemType: isQuilt ? "Quilt" : "Sleeping Bag",
          category: "Sleep System", subcategory: isQuilt ? "Quilts" : "Sleeping Bags",
          description, images, weightGrams: itemWeight, variantAxes, variants, defaultVariantKey, attributes, handle: p.handle,
        });
      }
      continue;
    }

    // ---- DOWN GARMENTS -> Insulated Jacket ----
    if (/^Down Garment/.test(t)) {
      if (/closeout|previous model|down suit|down pants/i.test(title)) continue;
      const bodyText = p.body_html.replace(/<[^>]+>/g, " ").replace(/&#\d+;/g, " ").replace(/\s+/g, " ");
      const wm = bodyText.match(/average weight[\s\S]{0,60}?(\d[\d,]*)\s*g/i);
      const weight = wm ? parseInt(wm[1].replace(/,/g, "")) : null;
      const gender = WOMENS.test(title) ? "Womens" : /\bmen'?s\b/i.test(title) ? "Mens" : "Unisex";
      const sizeOpt = p.options.find((o) => /size/i.test(o.name));
      const fp = (bodyText.match(/(\d{3})\+?\s*fill power/i) || [])[1];
      const attributes = { insulationType: "Down", gender };
      if (fp) attributes.fillPower = parseInt(fp);
      let description = bodyText.trim().slice(0, 1400);
      if (weight) description += "\n\n* Listed weight is for size Medium; actual weight varies by size.";
      let variantAxes, variants, defaultVariantKey;
      if (sizeOpt && sizeOpt.values.length > 1) {
        variantAxes = [{ name: "Size", values: sizeOpt.values }];
        variants = sizeOpt.values.map((s) => ({ key: s, options: { Size: s } }));
        defaultVariantKey = sizeOpt.values.includes("Medium") ? "Medium" : sizeOpt.values[0];
      }
      await createItem({
        name: title.split(" - ")[0].trim(), itemType: "Insulated Jacket",
        category: gender === "Womens" ? "Women's Clothing" : gender === "Mens" ? "Men's Clothing" : "Unisex Clothing", subcategory: "Jackets",
        description, images: gallery(p), weightGrams: weight, variantAxes, variants, defaultVariantKey, attributes, handle: p.handle,
      });
      continue;
    }

    // Down Pillow = home/bedding down pillow (FF's bedding line), not a backpacking
    // pillow -> skip, same as the comforters/throws/blankets.
    // else: bedding / accessories -> skip
  }

  console.log(`\nby itemType:`, counts);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created`);
  await mongoose.disconnect();
})();
