// server/src/routes/ai.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { getClient } = require("../services/anthropicService");
const { findCatalogMatches } = require("../services/catalogMatch");
const AffiliateProduct = require("../models/affiliateProduct");
const User = require("../models/user");

// Per-user limit — every request here costs Anthropic tokens
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: "rate_limited", message: "Too many AI requests — try again in a minute." },
  }),
);

const CATALOG_CATEGORIES = [
  "Accessories & Tools",
  "Backpacks & Bags",
  "Electronics & Power",
  "Footwear",
  "Health & Hygiene",
  "Hydration",
  "Kitchen & Cooking",
  "Men's Clothing",
  "Navigation & Planning",
  "Shelter",
  "Sleep System",
  "Travel",
  "Unisex Clothing",
  "Women's Clothing",
];

const LANGUAGE_NAMES = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
};

// ── Structured AI output ───────────────────────────────────────────────────────
// JSON schema enforced via output_config.format — the API guarantees the
// response parses against this, so no fence-stripping or parse retries needed.

const nullable = (type) => ({ anyOf: [{ type }, { type: "null" }] });

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: nullable("string"),
    brand: nullable("string"),
    itemType: nullable("string"),
    weightGrams: nullable("integer"),
    category: { anyOf: [{ type: "string", enum: CATALOG_CATEGORIES }, { type: "null" }] },
    description: nullable("string"),
  },
  required: ["name", "brand", "itemType", "weightGrams", "category", "description"],
  additionalProperties: false,
};

const ITEM_OUTPUT_CONFIG = { format: { type: "json_schema", schema: ITEM_SCHEMA } };

function parseStructuredItem(message) {
  const text = message.content?.find((b) => b.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null; // only reachable on a safety refusal — schema is enforced otherwise
  }
}

// ── Image URL validation ───────────────────────────────────────────────────────
// Never hand the client a dead image link. Hard failures (404/410/403) drop the
// URL; timeouts and HEAD-unsupported responses keep it — slow CDNs aren't dead.

async function validateImageUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok || res.status === 405 ? url : null;
  } catch {
    return url;
  }
}

// ── fill-item result cache ─────────────────────────────────────────────────────
// Popular queries ("Nemo Tensor", "Xmid 2") repeat across users; cache the AI
// extraction (keyed by language + normalized query). Catalog matches are NOT
// cached — they're recomputed per request so new catalog items show up.

const FILL_CACHE_MAX = 500;
const FILL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const fillCache = new Map();

function fillCacheGet(key) {
  const entry = fillCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > FILL_CACHE_TTL_MS) {
    fillCache.delete(key);
    return null;
  }
  fillCache.delete(key); // LRU: re-insert on read
  fillCache.set(key, entry);
  return entry.value;
}

function fillCacheSet(key, value) {
  if (fillCache.size >= FILL_CACHE_MAX) {
    fillCache.delete(fillCache.keys().next().value);
  }
  fillCache.set(key, { at: Date.now(), value });
}

// ── URL scraping ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 6000;

function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Remove query params from image URLs — CDN params (crop, width, height) conflict with our display logic
function cleanImageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

// Convert weight value + unit to grams
function toGrams(value, unit = "") {
  const n = parseFloat(value);
  if (!n || isNaN(n)) return null;
  const u = (unit || "").toLowerCase().replace(/[^a-z]/g, "");
  if (u === "kg" || u === "kilogram" || u === "kilograms") return Math.round(n * 1000);
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return Math.round(n * 453.592);
  if (u === "oz" || u === "ounce" || u === "ounces") return Math.round(n * 28.3495);
  // default assume grams
  return Math.round(n);
}

// Try Shopify product JSON endpoint — works for any Shopify store
async function tryShopifyJson(url, signal) {
  if (!url.includes("/products/")) return null;
  const base = url.split("?")[0].replace(/\/$/, "");
  const jsonUrl = base.endsWith(".json") ? base : `${base}.json`;
  try {
    const res = await fetch(jsonUrl, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Treklist/1.0)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.product;
    if (!p) return null;

    // Collect unique variant titles + weights
    const allVariants = (p.variants || [])
      .slice(0, 8)
      .map((v) => {
        const wg =
          v.weight_unit && v.weight
            ? toGrams(v.weight, v.weight_unit)
            : null;
        return { title: v.title, weightGrams: wg };
      });
    const variants = allVariants.filter((v) => v.title !== "Default Title");

    return {
      source: "shopify",
      title: p.title,
      vendor: p.vendor,
      description: stripHtml(p.body_html || "").slice(0, 600),
      // Single-variant products: the variant weight IS the product weight
      // (often shipping weight — a page spec-table weight overrides it later)
      weightGrams: allVariants.length === 1 ? allVariants[0].weightGrams : undefined,
      variants,
    };
  } catch {
    return null;
  }
}

// Extract weight and key specs from plain page text
// Prioritises "Minimum Weight" over "Packed Weight" — that's what hikers track
function extractSpecsFromText(text) {
  // "Minimum Weight  1 lb 2 oz / 505 g"  or  "Minimum Weight\n505 g"
  const minW =
    text.match(/minimum\s+weight[^\d]{0,60}(\d+)\s*g\b/i) ||
    text.match(/\d+\s*lb\s+\d+\s*oz\s*\/\s*(\d+)\s*g\b/i);
  if (minW) return { weightGrams: parseInt(minW[1], 10) };

  // Any "weight" label near a gram value
  const anyW = text.match(/\bweight[^\d]{0,60}(\d+)\s*g\b/i);
  if (anyW) return { weightGrams: parseInt(anyW[1], 10) };

  // Metric: "Weight: 1.13 kg"
  const kg = text.match(/\bweight[^\d]{0,60}(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kg) return { weightGrams: Math.round(parseFloat(kg[1]) * 1000) };

  // Imperial: "Weight: 2 lb 7.5 oz" (oz part optional)
  const lboz = text.match(/\bweight[^\d]{0,60}(\d+)\s*lbs?\b(?:[^\d]{0,10}(\d+(?:\.\d+)?)\s*oz)?/i);
  if (lboz) {
    const grams =
      parseFloat(lboz[1]) * 453.592 + (lboz[2] ? parseFloat(lboz[2]) * 28.3495 : 0);
    return { weightGrams: Math.round(grams) };
  }

  return {};
}

// Extract schema.org Product JSON-LD from HTML
function extractSchemaOrg(html) {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(match[1]);
      const items = Array.isArray(ld) ? ld : [ld];
      for (const item of items) {
        if (item["@type"] === "Product" || item["@type"] === "product") {
          const w = item.weight || item.netWeight;
          let weightGrams = null;
          if (w) {
            weightGrams = toGrams(w.value ?? w, w.unitCode ?? w.unitText ?? "g");
          }
          return {
            source: "schema",
            title: item.name,
            brand: item.brand?.name ?? null,
            description: (item.description || "").slice(0, 600),
            weightGrams,
          };
        }
      }
    } catch {
      // skip malformed JSON-LD
    }
  }
  return null;
}

// Fallback: extract og:title + meta description + og:image
function extractMeta(html) {
  const ogTitle = html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
  const metaDesc = html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1];
  const ogImage = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  return ogTitle ? { source: "meta", title: ogTitle, description: metaDesc ?? null, imageUrl: ogImage ?? null } : null;
}

async function fetchProductPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Fetch Shopify JSON and HTML in parallel
    const [shopify, htmlRes] = await Promise.allSettled([
      tryShopifyJson(url, controller.signal),
      fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
      }),
    ]);

    const shopifyData = shopify.status === "fulfilled" ? shopify.value : null;

    let htmlData = null;
    let pageText = "";
    let ogImage = null;
    if (htmlRes.status === "fulfilled" && htmlRes.value.ok) {
      const html = await htmlRes.value.text();
      pageText = stripHtml(html);
      const meta = extractMeta(html);
      htmlData = extractSchemaOrg(html) ?? meta ?? null;
      ogImage = meta?.imageUrl ?? null;
    }

    // Spec table weight wins over Shopify API weight — it's what the brand publishes
    const specWeight = extractSpecsFromText(pageText);

    if (shopifyData) {
      if (specWeight.weightGrams) shopifyData.weightGrams = specWeight.weightGrams;
      if (ogImage) shopifyData.imageUrl = cleanImageUrl(ogImage);
      return shopifyData;
    }
    if (htmlData) {
      if (specWeight.weightGrams) htmlData.weightGrams = specWeight.weightGrams;
      if (ogImage) htmlData.imageUrl = cleanImageUrl(ogImage);
      return htmlData;
    }
    // No structured data but we have a weight from the page
    if (specWeight.weightGrams) return { source: "text", weightGrams: specWeight.weightGrams };
    return null;
  } catch (err) {
    if (err.name !== "AbortError") console.warn("[AI] URL fetch failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatPageDataForPrompt(data) {
  if (!data) return null;
  const lines = [];
  if (data.title) lines.push(`Product title: ${data.title}`);
  if (data.vendor || data.brand) lines.push(`Brand: ${data.vendor ?? data.brand}`);
  if (data.weightGrams) {
    lines.push(`Minimum weight from spec table: ${data.weightGrams}g — use this exact value, do not substitute a variant weight`);
    // When we have a confirmed page weight, omit the variants list.
    // Listing all variants causes the wrong one to be selected.
  } else if (data.variants?.length) {
    // No page weight — list variants so Claude can choose the standard size
    lines.push("Variants (choose the standard/Regular size unless the URL specifies otherwise):");
    data.variants.forEach((v) => {
      const w = v.weightGrams ? ` — ${v.weightGrams}g` : "";
      lines.push(`  • ${v.title}${w}`);
    });
  }
  if (data.description) lines.push(`\nProduct description:\n${data.description}`);
  return lines.join("\n");
}

// ── Routes ─────────────────────────────────────────────────────────────────────

router.post("/fill-item", async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return res.status(400).json({ error: "Query is required" });
  }

  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({ error: "AI not available — ANTHROPIC_API_KEY not set" });
  }

  const userRecord = await User.findById(req.userId).select("language").lean();
  const userLang = userRecord?.language || "en";
  const languageName = LANGUAGE_NAMES[userLang] || "English";
  const descLangInstruction =
    userLang === "en"
      ? ""
      : `\nWrite the \`description\` field in ${languageName}. All other fields (name, brand, category) remain in their standard format.`;

  const systemPrompt = `You are an expert outdoor gear product database. You have detailed knowledge of hiking, backpacking, camping, and outdoor gear including weights, specs, and technical details.

Given a product name query, return a JSON object with these exact fields:
- name: model name without brand and without generic product-type words like "Backpack", "Tent", "Stove" — those belong in itemType (string, required). Include size/variant only if explicitly specified in the query
- brand: manufacturer name with correct capitalization (string or null)
- itemType: specific product type in plain English, e.g. "Canister Stove", "Frameless Backpack", "Inflatable Sleeping Pad" (string or null)
- weightGrams: integer grams ONLY if a weight appears in the product data provided above (choose the standard/Regular variant when several are listed); otherwise null — never use weights from memory, they change between model years
- category: exactly one of these values or null: ${CATALOG_CATEGORIES.join(", ")}
- description: a specific, technical 1–2 sentence description mentioning key specs for the product type (string or null)

DESCRIPTION — be specific, never generic:
• Sleeping pads: R-value, insulation type, packed size
• Sleeping bags: temperature rating, fill type, fill power if known
• Backpacks: volume in liters, frame type
• Tents/shelters: capacity, pole material, freestanding or not
• Footwear: waterproofing, boot height
• Cooking: fuel type, boil time
Only state specs you are confident about — omit a spec entirely rather than guess (e.g. never claim a tent is freestanding or name pole materials unless certain).
Never write sentences like "designed for outdoor adventures" or "perfect for hiking".${descLangInstruction}`;

  const trimmedQuery = query.trim();
  const cacheKey = `${userLang}:${trimmedQuery.toLowerCase()}`;

  try {
    let result = fillCacheGet(cacheKey);

    if (!result) {
      // If query is a URL, fetch real product data first
      const isUrl = /^https?:\/\//i.test(trimmedQuery);
      let userMessage = trimmedQuery;
      let scrapedImageUrl = null;
      let scrapedWeight = null;
      let affiliateImage = null;

      // Bare merchant item number (e.g. Decathlon "8975262") — resolve it
      // through the affiliate feed so the AI gets a real product name
      if (!isUrl && /^\d{5,}$/.test(trimmedQuery)) {
        const affiliate = await AffiliateProduct.findOne({ merchantProductId: trimmedQuery }).lean();
        if (affiliate) {
          userMessage = `Product: ${[affiliate.brand, affiliate.name].filter(Boolean).join(" ")}`;
          if (affiliate.description) {
            userMessage += `\n\n${String(affiliate.description).slice(0, 400)}`;
          }
          affiliateImage = affiliate.imageUrl || affiliate.imageUrls?.[0] || null;
        }
      }

      if (isUrl) {
        // Amazon mobile/sharing redirect URLs contain no product info — fail early with a clear message
        if (/amazon\.[a-z.]+\/hz\/mobile\/mission/i.test(trimmedQuery)) {
          return res.status(400).json({
            error: "amazon_redirect",
            message: "This is an Amazon sharing link, not a product page. Please open the product on Amazon and copy the URL from your browser's address bar.",
          });
        }

        const pageData = await fetchProductPage(trimmedQuery);
        const formatted = formatPageDataForPrompt(pageData);
        if (formatted) {
          userMessage = `URL: ${trimmedQuery}\n\n${formatted}`;
        }
        if (pageData?.imageUrl) scrapedImageUrl = pageData.imageUrl;
        if (pageData?.weightGrams) scrapedWeight = pageData.weightGrams;
        // If fetch failed, fall through with just the URL — Claude will still parse the slug
      }

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        output_config: ITEM_OUTPUT_CONFIG,
        messages: [{ role: "user", content: userMessage }],
      });

      const raw = parseStructuredItem(message);
      if (!raw) {
        return res.status(500).json({ error: "ai_failed", message: "AI request failed" });
      }

      const resultName = (typeof raw.name === "string" ? raw.name.trim() : null) || trimmedQuery;
      const resultBrand = typeof raw.brand === "string" ? raw.brand.trim() || null : null;

      result = {
        name: resultName,
        brand: resultBrand,
        itemType: typeof raw.itemType === "string" ? raw.itemType.trim() || null : null,
        // Scraped weight wins; else the weight the model copied from page data
        weightGrams:
          scrapedWeight ??
          (typeof raw.weightGrams === "number" ? Math.round(raw.weightGrams) : null),
        category: CATALOG_CATEGORIES.includes(raw.category) ? raw.category : null,
        description:
          typeof raw.description === "string" ? raw.description.trim() || null : null,
        link: isUrl ? trimmedQuery : null,
        imageUrl: await validateImageUrl(scrapedImageUrl || affiliateImage),
      };
      fillCacheSet(cacheKey, result);
    }

    // Catalog matches are computed fresh (never cached) so new items show up.
    // Image fallback: scraped og:image → top catalog match's curated image.
    const catalogMatches = await findCatalogMatches(result);
    if (!result.imageUrl && catalogMatches[0]?.imageUrls?.[0]) {
      result = { ...result, imageUrl: catalogMatches[0].imageUrls[0] };
    }

    res.json({ ...result, catalogMatches });
  } catch (err) {
    console.error("[Anthropic] fill-item failed:", err.message);
    res.status(500).json({ error: "ai_failed", message: "AI request failed" });
  }
});

// ── POST /scan-item ────────────────────────────────────────────────────────────
// Body: { image: string (data URL) }
// Returns the same shape as /fill-item

router.post("/scan-item", async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: "image required" });
  }

  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({ error: "AI not available — ANTHROPIC_API_KEY not set" });
  }

  const userRecord = await User.findById(req.userId).select("language").lean();
  const userLang = userRecord?.language || "en";
  const languageName = LANGUAGE_NAMES[userLang] || "English";
  const descLangInstruction =
    userLang === "en"
      ? ""
      : `\nWrite the \`description\` field in ${languageName}. All other fields stay in standard format.`;

  const systemPrompt = `You are an expert product database with deep knowledge of outdoor gear (hiking, backpacking, camping) as well as general consumer products. Items do not need to be outdoor gear — identify whatever product is shown.

Given product information (text or image), return a JSON object with these exact fields:
- name: model name without brand prefix and without generic product-type words like "Backpack", "Tent", "Stove" — those belong in itemType (string, required)
- brand: manufacturer name with correct capitalization (string or null)
- itemType: specific product type in plain English, e.g. "Canister Stove", "Frameless Backpack", "Inflatable Sleeping Pad" (string or null)
- weightGrams: weight in grams as an integer if clearly known, otherwise null — do not guess
- category: exactly one of these values or null: ${CATALOG_CATEGORIES.join(", ")}
- description: specific 1–2 sentence technical description mentioning key specs (string or null)

DESCRIPTION rules:
• Sleeping pads: R-value, insulation type, packed size
• Sleeping bags: temperature rating, fill type, fill power if known
• Backpacks: volume in liters, frame type
• Tents/shelters: capacity, pole material, freestanding or not
• Stoves: fuel type, boil time if known
• Never write generic phrases like "designed for outdoor adventures"${descLangInstruction}

If you cannot identify the item at all, set name to null.`;

  try {
    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/s);
    if (!base64Match) {
      return res.status(400).json({ error: "invalid_image", message: "Invalid image format" });
    }
    const mediaType = base64Match[1];
    const base64Data = base64Match[2];
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) {
      return res.status(400).json({ error: "unsupported_image", message: "Unsupported image type. Use JPEG, PNG, or WebP." });
    }
    const messages = [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
        { type: "text", text: "Identify this product. Look for visible brand logos, model numbers, tags, labels, or distinguishing physical features. Return the JSON as specified." },
      ],
    }];

    // Escalation ladder: Haiku handles most scans cheaply; when it can't
    // identify the item, retry once with Sonnet before giving up.
    let raw = null;
    for (const model of ["claude-haiku-4-5", "claude-sonnet-4-6"]) {
      const message = await anthropic.messages.create({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        output_config: ITEM_OUTPUT_CONFIG,
        messages,
      });
      const parsed = parseStructuredItem(message);
      if (parsed && typeof parsed.name === "string" && parsed.name.trim()) {
        raw = parsed;
        break;
      }
    }

    if (!raw) {
      return res.status(422).json({
        error: "not_identified",
        message: "Could not identify an item in this photo",
      });
    }

    const result = {
      name: raw.name.trim(),
      brand: typeof raw.brand === "string" ? raw.brand.trim() || null : null,
      itemType: typeof raw.itemType === "string" ? raw.itemType.trim() || null : null,
      weightGrams: typeof raw.weightGrams === "number" ? Math.round(raw.weightGrams) : null,
      category: CATALOG_CATEGORIES.includes(raw.category) ? raw.category : null,
      description: typeof raw.description === "string" ? raw.description.trim() || null : null,
      link: null,
      imageUrl: null,
    };

    // Image: top catalog match's curated photo (the client also has the user's
    // own photo as a fallback via photoUrl).
    const catalogMatches = await findCatalogMatches(result);
    if (catalogMatches[0]?.imageUrls?.[0]) {
      result.imageUrl = catalogMatches[0].imageUrls[0];
    }

    res.json({ ...result, catalogMatches });
  } catch (err) {
    console.error("[Anthropic] scan-item failed:", err.message);
    res.status(500).json({ error: "ai_failed", message: "AI request failed" });
  }
});

module.exports = router;
