/**
 * ingest-shopify-catalog.js
 *
 * Pulls any public Shopify store's products.json feed and maps each product
 * into the CatalogItem schema shape. Works for single-brand stores (Zpacks,
 * Hyberg) and multi-brand retailers (Garage Grown Gear), where each product's
 * brand comes from its Shopify `vendor`.
 *
 * DRY-RUN by default — it prints a sample + stats so you can judge mapping
 * quality and writes NOTHING. Pass --commit to upsert into the catalog.
 *
 * Usage (dry-run / inspect):
 *   node src/scripts/ingest-shopify-catalog.js --domain garagegrowngear.com
 *   node src/scripts/ingest-shopify-catalog.js --domain zpacks.com --brand Zpacks
 *   node src/scripts/ingest-shopify-catalog.js --domain hyberg.de --json
 *   node src/scripts/ingest-shopify-catalog.js --domain garagegrowngear.com --sample 12
 *
 * Usage (write):
 *   node src/scripts/ingest-shopify-catalog.js --domain zpacks.com --brand Zpacks --commit
 *   node src/scripts/ingest-shopify-catalog.js --domain zpacks.com --brand Zpacks --commit \
 *        --db TrekList --confirm TrekList
 *
 * Flags:
 *   --domain <host>     Shopify store host (required)
 *   --brand <name>      Force brand for ALL items (use for single-brand stores
 *                       whose vendor field is wrong/empty). Omit to use per-product vendor.
 *   --sample <n>        How many items to print (default 8)
 *   --json              Dump all mapped docs as JSON instead of the sample
 *   --find <regex>      Print full variant tables for products whose name matches
 *   --commit            WRITE: upsert each mapped product into the catalog
 *   --db <name>         Target DB (overrides MONGO_DB_NAME; default = local)
 *   --confirm <name>    Required to --commit to a non-local DB (must equal --db)
 *   --created-by <id>   User _id to stamp on NEW items (default: first isAdmin user)
 *   --merchant-name <s> Display name for the buy-link merchant (default: --brand
 *                       value, else the domain slug). Use for multi-brand stores.
 *
 * WRITE/MERGE semantics (upsert keyed by itemGroupId = "<domainslug>-<productId>"):
 *   NEW item   → inserted with a name-inferred itemType (inferItemType) and lenient
 *                attribute validation, so feed imports land typed but not blocked on
 *                missing required attributes.
 *   EXISTING   → feed-sourced FACTS are refreshed (name, brand, category, images,
 *                weight, variants, tags); the CURATED layer is PRESERVED
 *                (itemType, attributes, isActive, modelNumber, dimensions, curated
 *                description/externalIds). The feed never overwrites curation.
 *   Price/offers are NOT written here — CatalogItem has no price field; offers live
 *   in MerchantOffer (a separate, later pass).
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);
const { inferItemType, categoryForItemType } = require("../config/inferItemType");

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
};
const DOMAIN = (flag("--domain", "zpacks.com") || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const BRAND_OVERRIDE = flag("--brand", null);
const DUMP_JSON = args.includes("--json");
const SAMPLE = parseInt(flag("--sample", "8"), 10);
const COMMIT = args.includes("--commit");

// The store/merchant the deep links point at. merchantId = stable domain slug
// (also the itemGroupId prefix); merchantName = display name (defaults to the
// brand override, else the slug). For multi-brand stores pass --merchant-name.
const MERCHANT_ID = DOMAIN.replace(/\..*$/, "");
const MERCHANT_NAME = flag("--merchant-name", null) || BRAND_OVERRIDE || MERCHANT_ID;

// -----------------------------------------------------------------------------
// DB TARGET + PRODUCTION GUARD (mirrors normalize-itemtypes.js)
// --db <name> overrides MONGO_DB_NAME; a --commit to any non-local DB requires
// --confirm <dbName> to match, so a prod write can never happen by a stray env.
// -----------------------------------------------------------------------------
const DB = flag("--db", null) || process.env.MONGO_DB_NAME;
const CREATED_BY = flag("--created-by", null);
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && flag("--confirm", null) !== DB) {
  console.error(
    `\nRefusing to --commit to non-local DB "${DB}".\n` +
      `Re-run with:  --db ${DB} --commit --confirm ${DB}\n`,
  );
  process.exit(1);
}

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
  const v0 = (p.variants && p.variants[0]) || {};
  const images = (p.images || []).map((i) => i.src).filter(Boolean);
  const brand = cleanBrand(p.vendor);
  // Classify onto the schema taxonomy (NAME-based; feed product_type is not our
  // taxonomy) and derive category/subcategory from that itemType so the item is
  // reachable by the catalog's category/subcategory/brand filters. Raw Shopify
  // product_type is used only as a weak secondary hint to inferItemType.
  const itemType = inferItemType(p.title, p.product_type) || null;
  const { category, subcategory } = categoryForItemType(itemType, p.title);
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
    itemType,
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
// WRITE / MERGE PATH
// ---------------------------------------------------------------------------

// Internal-only fields the dry-run uses for reporting; never persisted.
const INTERNAL_KEYS = ["_sourceUrl", "_rawVariantCount", "_priceUSD"];
function stripInternal(m) {
  const out = { ...m };
  for (const k of INTERNAL_KEYS) delete out[k];
  return out;
}

// Feed-sourced FACTS we refresh on an existing item. The curated layer
// (itemType, category, subcategory, attributes, isActive, modelNumber,
// dimensions, curated description/externalIds) is intentionally NOT in this
// list — the feed never overwrites curation. category/subcategory are derived
// from the curated itemType, so preserving itemType preserves them too.
function applyFeedRefresh(existing, doc) {
  existing.name = doc.name;
  existing.brand = doc.brand;
  existing.weightGrams = doc.weightGrams;
  existing.variantAxes = doc.variantAxes;
  existing.variants = doc.variants;
  existing.defaultVariantKey = doc.defaultVariantKey;
  existing.tags = doc.tags;
  if (doc.imageUrls && doc.imageUrls.length) existing.imageUrls = doc.imageUrls;
  // Fill-if-empty: don't clobber a curated description or sku.
  if (doc.description && !existing.description) existing.description = doc.description;
  if (doc.externalIds && doc.externalIds.sku && !(existing.externalIds && existing.externalIds.sku)) {
    existing.externalIds = existing.externalIds || {};
    existing.externalIds.sku = doc.externalIds.sku;
  }
}

async function resolveCreatedBy() {
  if (CREATED_BY) return CREATED_BY;
  const User = require("../models/user");
  const admin = await User.findOne({ isAdmin: true }).select("_id email").lean();
  if (!admin) {
    throw new Error(
      "No isAdmin user found to stamp createdBy. Pass --created-by <userId>.",
    );
  }
  return admin._id;
}

// Upsert the store's product page as a buy-link offer. region "global" so it
// shows for users in any region (the catalog route fetches region ∈ {global,
// userRegion}). Keyed by (network, region, merchantId, productId) so re-imports
// just refresh the deep link. network "direct" = a brand/store link, not an
// affiliate network.
async function upsertOffer(MerchantOffer, productId, deepLink) {
  if (!deepLink) return false;
  await MerchantOffer.findOneAndUpdate(
    { network: "direct", region: "global", merchantId: MERCHANT_ID, productId },
    {
      $set: { merchantName: MERCHANT_NAME, deepLink },
      $setOnInsert: {
        network: "direct",
        region: "global",
        merchantId: MERCHANT_ID,
        productId,
        priority: 0,
      },
    },
    { upsert: true },
  );
  return true;
}

async function writeCatalogItems(mapped) {
  const CatalogItem = require("../models/catalogItem");
  const MerchantOffer = require("../models/merchantOffer");
  const createdBy = await resolveCreatedBy();

  let inserted = 0;
  let updated = 0;
  let offersUpserted = 0;
  let failed = 0;
  const failures = [];

  for (const m of mapped) {
    const doc = stripInternal(m);
    const sourceUrl = m._sourceUrl; // stripped from doc; the buy-link target
    if (!doc.itemGroupId) {
      failed++;
      failures.push([doc.name, "missing itemGroupId"]);
      continue;
    }
    try {
      let id;
      const existing = await CatalogItem.findOne({ itemGroupId: doc.itemGroupId });
      if (existing) {
        applyFeedRefresh(existing, doc);
        existing.$locals.lenientAttributes = true; // don't block on curated-but-incomplete attrs
        await existing.save();
        id = existing._id;
        updated++;
      } else {
        // doc.itemType + taxonomy category/subcategory were set in toCatalogItem.
        const ci = new CatalogItem({ ...doc, createdBy });
        ci.$locals.lenientAttributes = true;
        await ci.save();
        id = ci._id;
        inserted++;
      }
      if (await upsertOffer(MerchantOffer, id, sourceUrl)) offersUpserted++;
    } catch (e) {
      failed++;
      failures.push([doc.name, e.message]);
    }
  }

  console.log("\n---------------- WRITE RESULT ----------------");
  console.log(`DB:             ${mongoose.connection.name}`);
  console.log(`inserted:       ${inserted}`);
  console.log(`updated:        ${updated}`);
  console.log(`offers upserted: ${offersUpserted}  (network=direct region=global merchant="${MERCHANT_NAME}")`);
  console.log(`failed:         ${failed}`);
  if (failures.length) {
    console.log("\nFAILURES:");
    for (const [name, msg] of failures) console.log(`  ✗ ${name}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main (dry-run by default; --commit writes)
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
      await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
      const CatalogItem = require("../models/catalogItem");
      const total = await CatalogItem.countDocuments({});
      console.log(`\n---------------- DB: ${mongoose.connection.name} ----------------`);
      console.log(`current total CatalogItems: ${total}`);
      console.log(`this feed would yield:      ${mapped.length}`);

      if (COMMIT) {
        await writeCatalogItems(mapped);
      }
      await mongoose.disconnect();
    } catch (e) {
      console.log("\n(DB step failed:", e.message, ")");
      try { await mongoose.disconnect(); } catch { /* ignore */ }
      if (COMMIT) process.exit(1);
    }
  } else if (COMMIT) {
    console.error("\nMONGO_URI not set — cannot --commit.");
    process.exit(1);
  }

  if (!COMMIT) {
    console.log("\n(NOTHING WAS WRITTEN — dry-run. Pass --commit to write.)");
  }
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
