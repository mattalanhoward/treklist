/**
 * ingest-shopify-catalog.js  (TRIAL / DRY-RUN by default)
 *
 * Pulls any public Shopify store's products.json feed and maps each product
 * into the CatalogItem schema shape. Works for single-brand stores (Zpacks,
 * Hyberg) and multi-brand retailers (Garage Grown Gear), where each product's
 * brand comes from its Shopify `vendor`.
 *
 * By default it writes NOTHING — it prints a sample + stats so you can judge
 * mapping quality.
 *
 * Usage:
 *   node src/scripts/ingest-shopify-catalog.js --domain garagegrowngear.com
 *   node src/scripts/ingest-shopify-catalog.js --domain zpacks.com --brand Zpacks
 *   node src/scripts/ingest-shopify-catalog.js --domain hyberg.de --json
 *   node src/scripts/ingest-shopify-catalog.js --domain garagegrowngear.com --sample 12
 *
 * Flags:
 *   --domain <host>   Shopify store host (required)
 *   --brand <name>    Force brand for ALL items (use for single-brand stores
 *                     whose vendor field is wrong/empty). Omit to use per-product vendor.
 *   --sample <n>      How many items to print (default 8)
 *   --json            Dump all mapped docs as JSON instead of the sample
 *
 * No DB write path is implemented yet on purpose — this is the trial.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
};
const DOMAIN = (flag("--domain", "zpacks.com") || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const BRAND_OVERRIDE = flag("--brand", null);
const DUMP_JSON = args.includes("--json");
const SAMPLE = parseInt(flag("--sample", "8"), 10);

// Tags / product_types / titles that mark internal, resale, or non-gear noise.
const JUNK_TAG = /^(dummy|criteo-exclude|all-bargains|backpack-bargains|return|package_protection)$/i;
const JUNK_TYPE = /(dummy|resale|materials|return|package_protection|bargain|gift\s*card)/i;
const JUNK_TITLE = /(bargain|gift card|\bdummy\b|sample sale|e-?gift)/i;

// ---------------------------------------------------------------------------
// Fetch every page of products.json
//
// NOTE: we shell out to curl instead of using Node's global fetch. Cloudflare-
// fronted Shopify stores (e.g. Garage Grown Gear) detect Node/undici's TLS
// fingerprint as a bot and silently return a *trimmed* page (185 vs 250) — even
// with identical URL + browser headers. curl's TLS fingerprint passes, so it
// gets the full set. Plain stores (Zpacks) work either way; curl is the safe
// universal choice.
// ---------------------------------------------------------------------------
async function fetchPage(page) {
  const url = `https://${DOMAIN}/products.json?limit=250&page=${page}`;
  const { stdout } = await execFileP(
    "curl",
    ["-s", "--max-time", "30", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", url],
    { maxBuffer: 50 * 1024 * 1024 },
  );
  const data = JSON.parse(stdout);
  return data.products || [];
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 40; page++) {
    const products = await fetchPage(page);
    if (!products.length) break;
    out.push(...products);
    if (products.length < 250) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function htmlToText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCategory(productType) {
  const parts = String(productType || "")
    .split(/[:>/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return { category: undefined, subcategory: undefined };
  return { category: parts[0], subcategory: parts.slice(1).join(" / ") || undefined };
}

// A multi-brand vendor like "related_to_8282762117333" is junk, not a brand.
function cleanBrand(vendor) {
  if (BRAND_OVERRIDE) return BRAND_OVERRIDE;
  const v = String(vendor || "").trim();
  if (!v || /^related_to_|^\d+$/i.test(v)) return undefined;
  return v;
}

function isJunk(p) {
  if (JUNK_TYPE.test(p.product_type || "")) return true;
  if (JUNK_TITLE.test(p.title || "")) return true;
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",");
  if (tags.length && tags.every((t) => JUNK_TAG.test(String(t).trim()))) return true;
  return false;
}

function cleanTags(tags) {
  const arr = Array.isArray(tags) ? tags : String(tags || "").split(",");
  return arr.map((t) => String(t).trim()).filter((t) => t && !JUNK_TAG.test(t));
}

// Axes we never expose as selectable variants: Color (doesn't change weight)
// and Shopify's placeholder "Title / Default Title" single-option.
function isMeaningfulAxis(opt) {
  const name = String(opt.name || "").trim();
  if (/^colou?r$/i.test(name)) return false;
  if (/^title$/i.test(name) && (opt.values || []).length <= 1) return false;
  return true;
}

// Build variantAxes + variants[] from a Shopify product, collapsing Color.
// Each variant gets its OWN weight (Shopify `grams`). variants that differ only
// by a dropped axis (color) collapse into one — they share the same weight.
function buildVariants(p) {
  const options = p.options || [];
  // Shopify variant fields are option1/option2/option3 by option position.
  const meaningful = options
    .map((o, i) => ({ name: String(o.name).trim(), field: `option${i + 1}`, values: o.values || [] }))
    .filter(isMeaningfulAxis);

  const variantAxes = meaningful.map((a) => ({ name: a.name, values: a.values }));

  const groups = new Map();
  for (const v of p.variants || []) {
    const optionValues = {};
    for (const a of meaningful) optionValues[a.name] = v[a.field];
    const key = meaningful.map((a) => optionValues[a.name]).filter(Boolean).join(" / ");
    if (groups.has(key)) continue; // first (color) wins; weights are identical
    const grams = Number(v.grams);
    groups.set(key, {
      key,
      options: optionValues,
      weightGrams: Number.isFinite(grams) && grams > 0 ? grams : undefined,
      sku: v.sku ? String(v.sku) : undefined,
    });
  }
  const variants = [...groups.values()];

  // Default = a "Standard"/"Regular" variant if present, else the first.
  const def =
    variants.find((x) => /\b(standard|regular)\b/i.test(x.key)) || variants[0];

  return { variantAxes, variants, defaultVariantKey: def ? def.key : undefined };
}

// ---------------------------------------------------------------------------
// Shopify product -> CatalogItem shape
// ---------------------------------------------------------------------------
function toCatalogItem(p) {
  const { category, subcategory } = mapCategory(p.product_type);
  const v0 = (p.variants && p.variants[0]) || {};
  const images = (p.images || []).map((i) => i.src).filter(Boolean);
  const brand = cleanBrand(p.vendor);
  let { variantAxes, variants, defaultVariantKey } = buildVariants(p);
  let weightGrams;

  // A variant selector only earns its place if ≥2 variants carry DISTINCT
  // weights. Configurable products (Zpacks packs: 216 combos, no weights) have
  // nothing weight-meaningful to select, so collapse them to a single base
  // product — the user sets their exact weight via the normal override. This is
  // data-driven (weight presence), not a pack-specific hack.
  const weighted = variants.filter((v) => v.weightGrams);
  const distinctWeights = new Set(weighted.map((v) => v.weightGrams)).size;
  if (distinctWeights < 2) {
    weightGrams = weighted.length === 1 ? weighted[0].weightGrams : undefined;
    variantAxes = [];
    variants = [];
    defaultVariantKey = undefined;
  } else {
    const defVariant = variants.find((x) => x.key === defaultVariantKey);
    weightGrams = defVariant ? defVariant.weightGrams : undefined;
  }

  return {
    name: p.title,
    brand,
    brandLC: brand ? brand.toLowerCase() : undefined,
    category,
    subcategory,
    itemType: null, // needs admin/AI categorization against attributeSchemas.js
    description: htmlToText(p.body_html).slice(0, 600),
    imageUrls: images,
    weightGrams,
    variantAxes,
    variants,
    defaultVariantKey,
    attributes: {},
    tags: cleanTags(p.tags),
    externalIds: { sku: v0.sku ? String(v0.sku) : undefined },
    itemGroupId: `${DOMAIN.replace(/\..*$/, "")}-${p.id}`,
    _sourceUrl: `https://${DOMAIN}/products/${p.handle}`,
    _rawVariantCount: (p.variants || []).length,
    _priceUSD: v0.price,
  };
}

// ---------------------------------------------------------------------------
// Main (dry-run)
// ---------------------------------------------------------------------------
(async () => {
  console.log(`Fetching ${DOMAIN} products.json ...`);
  const raw = await fetchAll();
  const kept = raw.filter((p) => !isJunk(p));
  const mapped = kept.map(toCatalogItem);

  if (DUMP_JSON) {
    console.log(JSON.stringify(mapped, null, 2));
    return;
  }

  const withWeight = mapped.filter((m) => m.weightGrams).length;
  const withImage = mapped.filter((m) => m.imageUrls.length).length;
  const withCat = mapped.filter((m) => m.category).length;
  const withSku = mapped.filter((m) => m.externalIds.sku).length;
  const withBrand = mapped.filter((m) => m.brand).length;
  const multiVar = mapped.filter((m) => m.variants.length > 1).length;
  const colorCollapsed = mapped.filter((m) => m._rawVariantCount > m.variants.length).length;

  console.log(`\n================ ${DOMAIN} IMPORT TRIAL (dry-run) ================`);
  console.log(`fetched:        ${raw.length}`);
  console.log(`after junk skip: ${mapped.length}  (dropped ${raw.length - mapped.length})`);
  console.log(`with brand:     ${withBrand}/${mapped.length}`);
  console.log(`with weight:    ${withWeight}/${mapped.length}`);
  console.log(`with image:     ${withImage}/${mapped.length}`);
  console.log(`with category:  ${withCat}/${mapped.length}`);
  console.log(`with sku:       ${withSku}/${mapped.length}`);
  console.log(`multi-variant:  ${multiVar} (color collapsed on ${colorCollapsed})`);

  // Brand distribution (the multi-brand payoff)
  const byBrand = {};
  for (const m of mapped) byBrand[m.brand || "(no brand)"] = (byBrand[m.brand || "(no brand)"] || 0) + 1;
  const brands = Object.entries(byBrand).sort((a, b) => b[1] - a[1]);
  console.log(`\n---------------- BRAND DISTRIBUTION (${brands.length} brands) ----------------`);
  brands.slice(0, 20).forEach(([b, n]) => console.log(`  ${String(n).padStart(4)}  ${b}`));
  if (brands.length > 20) console.log(`  ... and ${brands.length - 20} more brands`);

  // --find <regex> targets specific products (e.g. "sleeping bag|quilt") and
  // prints their full variant table; otherwise show the first N as a sample.
  const FIND = flag("--find", null);
  const shown = FIND
    ? mapped.filter((m) => new RegExp(FIND, "i").test(m.name))
    : mapped.slice(0, SAMPLE);

  console.log(`\n---------------- ${FIND ? `MATCHING /${FIND}/ (${shown.length})` : `SAMPLE (${SAMPLE} items)`} ----------------`);
  for (const m of shown) {
    const weights = m.variants.map((v) => v.weightGrams).filter(Boolean);
    const range = weights.length ? `${Math.min(...weights)}–${Math.max(...weights)} g` : "—";
    console.log(`\n• ${m.name}`);
    console.log(`   brand:    ${m.brand || "— (MISSING)"}`);
    console.log(`   category: ${m.category || "—"}${m.subcategory ? " / " + m.subcategory : ""}`);
    console.log(`   link:     ${m._sourceUrl}`);
    console.log(`   image:    ${m.imageUrls[0] || "—"}`);
    console.log(`   price:    $${m._priceUSD || "—"}  | raw variants: ${m._rawVariantCount} → collapsed: ${m.variants.length}`);
    if (m.variantAxes.length) {
      console.log(`   axes:     ${m.variantAxes.map((a) => `${a.name}(${a.values.length})`).join(" × ")}`);
      console.log(`   weight:   ${range}  | default: "${m.defaultVariantKey}" (${m.weightGrams || "—"} g)`);
      if (FIND) {
        for (const v of m.variants) {
          console.log(`       - ${v.key}  →  ${v.weightGrams || "—"} g${v.sku ? "  [sku " + v.sku + "]" : ""}`);
        }
      }
    } else {
      console.log(`   weight:   ${m.weightGrams ? m.weightGrams + " g" : "—"} (single variant)`);
    }
  }

  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
      const CatalogItem = require("../models/catalogItem");
      const total = await CatalogItem.countDocuments({});
      console.log("\n---------------- LOCAL DB ----------------");
      console.log(`current total CatalogItems: ${total}`);
      console.log(`this feed would yield:      ${mapped.length}`);
      await mongoose.disconnect();
    } catch (e) {
      console.log("\n(could not check local DB:", e.message, ")");
    }
  }

  console.log("\n(NOTHING WAS WRITTEN — this is a dry-run trial.)");
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
