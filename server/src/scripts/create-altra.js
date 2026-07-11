/**
 * create-altra.js — Altra (altrarunning.com), Shopify (open `products.json`, behind
 * Cloudflare but not blocked). Targeted create (NOT the generic ingest importer):
 * `product_type` is empty on every product and variant `grams` is 0 everywhere, so
 * itemType + weight can't come from the feed. Real specs (Weight/Drop/Stack Height/
 * Cushion/Best For/Upper/Midsole/Outsole) live in a consistent "All Details"
 * accordion on each live product page — scraped + parsed generically (same regex
 * across every product, unlike Bonfus's inconsistent per-product layout).
 *
 * Scope decisions (2026-07-08, agreed with user across 3 rounds):
 * - Feed has 315 gendered shoe listings; 149 are fully out of stock (0 purchasable
 *   variants) -> dropped, keeping the 166 in-stock ones.
 * - Of those, kept only the LATEST generation per model line per gender (old gens
 *   like Lone Peak 7/8, Timp 4/5, Torin 6/7/8 stay listed for sale alongside the
 *   newest but are noise for a gear catalog) plus that generation's real
 *   construction sub-variants (GTX/BOA/Hiker/Mid/ALL-WTHR are different shoes, not
 *   color reskins). Dropped one-off collabs (SOAR, "and wander", "X Pleasures").
 * - The schema only has itemType "Trail Running Shoes" (no "Road Running Shoes") —
 *   Altra's own SHOP_*_SHOES_ROAD tags cleanly separate everyday/road models
 *   (Escalante, Torin, Paradigm, Solstice XT, Vanish, Provision, Rivera, VIA
 *   Olympus, FWD VIA, Motiv FLX, Experience Flow/Form) from trail/hiking models
 *   (Lone Peak, Timp, Olympus 275, Mont Blanc, Superior, King MT, Experience Wild,
 *   LP Alpine, Voyager) — kept only the latter, since road shoes don't fit the
 *   schema type and are out of scope for a backpacking app. Final: 40 items.
 * - No variant axes modeled (Size, and Width on Lone Peak 9+) — weight is ONE
 *   number per shoe regardless of size everywhere on the site (industry-standard
 *   reference-size convention), matching the existing "Trail Running Shoes"
 *   precedent in this catalog (La Sportiva Wildcat 2.0 GTX has no variantAxes
 *   either) — so no flat-weight-across-axis disclaimer is needed here (no selector
 *   implies false per-size precision, unlike Bonfus's real Pack Size axis).
 * - 4 items (Lone Peak ALL-WTHR Low 2 both genders, Mont Blanc plain both genders)
 *   have NO published weight anywhere on their page — imported with weightGrams
 *   null rather than fabricated, per the project's no-weight policy.
 * - Images: the Shopify feed only tags the HERO shot of each colorway with
 *   `variant_ids`; the 5 ALT gallery shots for that same colorway are unlinked but
 *   share the same filename prefix (e.g. AL0A85RG88D-HERO / -ALT1..5) — matched by
 *   prefix to recover the full 5-6 photo gallery for one representative color.
 * - Apparel (hoodies, socks, gaiter) intentionally NOT included in this pass —
 *   Altra's core identity here is footwear; apparel deferred as a follow-up.
 *
 *   node src/scripts/create-altra.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED_BASE = "https://www.altrarunning.com/en-us/products.json?limit=250";

// The hand-curated keep list (see header comment for how this was derived).
const HANDLES = [
  "mens-experience-wild-3-al0a85v0",
  "womens-experience-wild-3-al0a85uz",
  "mens-king-mt-2-al0a85s3",
  "womens-king-mt-2-al0a85s4",
  "mens-lone-peak-9-al0a85rg",
  "womens-lone-peak-9-al0a85rh",
  "mens-lone-peak-9-gtx-al0a85ut",
  "womens-lone-peak-9-gtx-al0a85sn",
  "mens-lone-peak-all-wthr-low-2-al0a7r6j",
  "womens-lone-peak-all-wthr-low-2-al0a7r7i",
  "mens-lone-peak-all-wthr-mid-2-al0a7r6u",
  "womens-lone-peak-all-wthr-mid-2-al0a7r7j",
  "mens-lone-peak-hiker-3-al0a85pj",
  "womens-lone-peak-hiker-3-al0a85pt",
  "mens-lp-alpine-al0a546y",
  "womens-lp-alpine-al0a5482",
  "mens-mont-blanc-al0a547k",
  "womens-mont-blanc-al0a548d",
  "mens-mont-blanc-carbon-al0a82ca",
  "womens-mont-blanc-carbon-al0a85pf",
  "mens-mont-blanc-speed-al0a85rz",
  "womens-mont-blanc-speed-al0a85s0",
  "mens-olympus-275-al0a85rt",
  "womens-olympus-275-al0a85ru",
  "mens-olympus-275-hilo-al0a85wt",
  "womens-olympus-275-hilo-al0a85xy",
  "mens-superior-7-al0a85q7",
  "womens-superior-7-al0a85q8",
  "mens-timp-6-al0a85t6",
  "womens-timp-6-al0a85us",
  "mens-timp-6-gtx-al0a85sp",
  "womens-timp-6-gtx-al0a85u4",
  "mens-timp-6-mid-gtx-al0a85ur",
  "womens-timp-6-mid-gtx-al0a85u3",
  "mens-timp-hiker-al0a82cc",
  "womens-timp-hiker-al0a82cn",
  "mens-timp-hiker-gtx-al0a85p7",
  "womens-timp-hiker-gtx-al0a85p8",
  "mens-voyager-al0a85sq",
  "womens-voyager-al0a85tv",
];

async function fetchAllProducts() {
  const byHandle = {};
  for (let page = 1; page <= 3; page++) {
    let json;
    for (let tries = 0; tries < 3 && !json; tries++) {
      try {
        const res = await fetch(`${FEED_BASE}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) json = await res.json();
      } catch (e) {
        /* retry */
      }
      if (!json) await new Promise((r) => setTimeout(r, 500));
    }
    if (!json || !json.products?.length) break;
    for (const p of json.products) byHandle[p.handle] = p;
  }
  return byHandle;
}

async function fetchSpecs(handle, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://www.altrarunning.com/products/${handle}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const html = await res.text();
        const fields = {};
        const re1 = /accordion-content__field__label[^>]*>([^<]+)<\/span>\s*<span class="accordion-content__field_value">\s*([\s\S]*?)<\/span>/g;
        let m;
        while ((m = re1.exec(html))) {
          fields[m[1].replace(/:$/, "").replace(/™/g, "").trim()] = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        }
        const re2 = /accordion__preview__label[^>]*>([^<]+)<\/span>\s*<span class="accordion__preview__value">\s*([\s\S]*?)<\/span>\s*<\/div>/g;
        while ((m = re2.exec(html))) {
          fields[m[1].replace(/:$/, "").trim()] = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        }
        return fields;
      }
    } catch (e) {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  console.log(`   !! ${handle}: spec fetch failed after ${tries} tries — continuing with no specs`);
  return {};
}

function parseGrams(w) {
  if (!w) return null;
  const m = w.match(/([\d.]+)\s*g\b/i);
  return m ? Math.round(parseFloat(m[1])) : null;
}
function parseMm(v) {
  if (!v) return undefined;
  const m = v.match(/([\d.]+)\s*mm/i);
  return m ? parseFloat(m[1]) : undefined;
}
function mapCushioning(c) {
  return { High: "Maximum Cushion", Mid: "Moderate Cushion", Low: "Minimal Cushion" }[c];
}
function deriveBestUse(bestFor) {
  if (!bestFor) return undefined;
  if (/trail running|trail racing/i.test(bestFor)) return "Trail Running";
  if (/hiking/i.test(bestFor)) return "Hiking";
  return undefined;
}
function getGallery(p) {
  const colorOpt = p.options.find((o) => o.name === "Color");
  if (!colorOpt) return [];
  for (const color of colorOpt.values) {
    const variantIds = p.variants.filter((v) => v.option1 === color).map((v) => v.id);
    const heroImg = p.images.find((img) => img.variant_ids.some((id) => variantIds.includes(id)));
    if (!heroImg) continue;
    const prefix = heroImg.src.split("/").pop().split("-")[0];
    const gallery = p.images.filter((img) => img.src.includes("/" + prefix + "-") || img.src.includes("/" + prefix + "."));
    if (gallery.length) return gallery.map((g) => g.src).slice(0, 10);
  }
  return [];
}

(async () => {
  const feed = await fetchAllProducts();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  for (const handle of HANDLES) {
    const p = feed[handle];
    if (!p) {
      console.log(`!! ${handle}: not found in feed — skip`);
      continue;
    }
    const name = p.title.replace(/^MEN'S|^WOMEN'S/, (s) => (s === "MEN'S" ? "Men's" : "Women's"));
    const existing = await C.findOne({ name, brand: /altra/i }).lean();
    if (existing) {
      console.log(`${name}: already exists — skip`);
      continue;
    }

    await new Promise((r) => setTimeout(r, 350));
    const specs = await fetchSpecs(handle);
    const weightGrams = parseGrams(specs.Weight);
    const dropMm = parseMm(specs["Heel To Toe Drop"]);
    const heelStackHeightMm = parseMm(specs["Stack Height"]);
    const isMidOrHiker = /\b(mid|hiker)\b/i.test(name);
    const isWaterproof = /gore-?tex/i.test(specs.Upper || "") || /waterproof/i.test(specs["Best For"] || "");

    const attributes = {
      gender: /^Men's/i.test(name) ? "Mens" : "Womens",
      bestUse: deriveBestUse(specs["Best For"]),
      cushioning: mapCushioning(specs.Cushion),
      dropMm,
      heelStackHeightMm,
      forefootStackHeightMm: dropMm === 0 ? heelStackHeightMm : undefined,
      footwearHeight: isMidOrHiker ? "Ankle" : "Low",
      footwearClosure: "Lace-up",
      waterproof: isWaterproof,
      waterproofMembrane: isWaterproof ? (/gore-?tex/i.test(specs.Upper || "") ? "GORE-TEX" : "Proprietary") : "None",
      upper: specs.Upper || undefined,
      midsole: specs.Midsole || undefined,
      outsole: specs.Outsole || undefined,
    };
    Object.keys(attributes).forEach((k) => attributes[k] === undefined && delete attributes[k]);

    const images = getGallery(p);
    const deepLink = `https://www.altrarunning.com/products/${handle}`;

    console.log(
      `${name.padEnd(35)} ${weightGrams ?? "?"}g  drop:${dropMm ?? "?"}mm  imgs:${images.length}  cushion:${attributes.cushioning || "?"}  bestUse:${attributes.bestUse || "?"}`
    );

    // The scraped Weight is per SINGLE shoe at a manufacturer sample size (Altra
    // doesn't publish which size), not the pair and not the user's size — disclose
    // it so the number isn't mistaken for a verified per-size or pair weight (the
    // same misread caused the archived legacy pair-weight bug). Only when a weight
    // exists. Same terse "\n\n* ...; ... varies ..." template as Bonfus/Atom.
    let description = p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1900);
    if (weightGrams != null) {
      description += "\n\n* Listed weight is per single shoe at a manufacturer sample size; actual weight varies by size.";
    }

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${name}: no images — skip`);
        continue;
      }
      const doc = new C({
        name,
        brand: "Altra",
        itemType: "Trail Running Shoes",
        category: "Footwear",
        description,
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(weightGrams != null ? { weightGrams } : {}),
        attributes,
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
        merchantId: "direct-altra",
        merchantName: "Altra",
        productId: doc._id,
        deepLink,
        priority: 0,
      });
      created++;
      console.log(`   ✓ created (_id ${doc._id}) + direct offer`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created`);
  await mongoose.disconnect();
})();
