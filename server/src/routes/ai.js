// server/src/routes/ai.js
const express = require("express");
const router = express.Router();
const { getClient } = require("../services/anthropicService");
const User = require("../models/user");

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

// ── Google Image Search ────────────────────────────────────────────────────────

async function fetchGoogleImage(brand, name) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) return null;

  const q = [brand, name].filter(Boolean).join(" ");
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&searchType=image&num=1&imgSize=large&imgType=photo`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (!res.ok) {
      console.warn("[Google] Image search failed:", data?.error?.message);
      return null;
    }
    return data.items?.[0]?.link ?? null;
  } catch (err) {
    console.warn("[Google] Image search error:", err.message);
    return null;
  }
}

// ── URL scraping ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 6000;

function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
    const variants = (p.variants || [])
      .slice(0, 8)
      .map((v) => {
        const wg =
          v.weight_unit && v.weight
            ? toGrams(v.weight, v.weight_unit)
            : null;
        return { title: v.title, weightGrams: wg };
      })
      .filter((v) => v.title !== "Default Title");

    return {
      source: "shopify",
      title: p.title,
      vendor: p.vendor,
      description: stripHtml(p.body_html || "").slice(0, 600),
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
      if (ogImage) shopifyData.imageUrl = ogImage;
      return shopifyData;
    }
    if (htmlData) {
      if (specWeight.weightGrams) htmlData.weightGrams = specWeight.weightGrams;
      if (ogImage) htmlData.imageUrl = ogImage;
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

// ── Route ─────────────────────────────────────────────────────────────────────

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
- name: model name without brand (string, required). Include size/variant only if explicitly specified in the query
- brand: manufacturer name with correct capitalization (string or null)
- itemType: specific product type in plain English, e.g. "Canister Stove", "Frameless Backpack", "Inflatable Sleeping Pad" (string or null)
- weightGrams: always null — do not guess weights, they change between model years
- category: exactly one of these values or null: ${CATALOG_CATEGORIES.join(", ")}
- description: a specific, technical 1–2 sentence description mentioning key specs for the product type (string or null)
- link: the official manufacturer product page URL — only if you are certain of the exact current URL, otherwise null

DESCRIPTION — be specific, never generic:
• Sleeping pads: R-value, insulation type, packed size
• Sleeping bags: temperature rating, fill type, fill power if known
• Backpacks: volume in liters, frame type
• Tents/shelters: capacity, pole material, freestanding or not
• Footwear: waterproofing, boot height
• Cooking: fuel type, boil time
Never write sentences like "designed for outdoor adventures" or "perfect for hiking".${descLangInstruction}

Return only valid JSON. No explanation, no markdown.`;

  try {
    // If query is a URL, fetch real product data first
    const isUrl = /^https?:\/\//i.test(query.trim());
    let userMessage = query.trim();
    let scrapedImageUrl = null;

    if (isUrl) {
      const pageData = await fetchProductPage(query.trim());
      const formatted = formatPageDataForPrompt(pageData);
      if (formatted) {
        userMessage = `URL: ${query.trim()}\n\n${formatted}`;
      }
      if (pageData?.imageUrl) scrapedImageUrl = pageData.imageUrl;
      // If fetch failed, fall through with just the URL — Claude will still parse the slug
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = message.content[0]?.text?.trim();
    if (!text) return res.status(500).json({ error: "Empty AI response" });

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let raw;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    const rawLink = typeof raw.link === "string" ? raw.link.trim() : null;
    const resultName = typeof raw.name === "string" ? raw.name.trim() : null;
    const resultBrand = typeof raw.brand === "string" ? raw.brand.trim() || null : null;

    if (!resultName) {
      return res.status(422).json({ error: "Could not extract item name from query" });
    }

    // Try to get product image: scraped URL → Google Image Search → AI link og:image
    let imageUrl = scrapedImageUrl;
    if (!imageUrl) {
      imageUrl = await fetchGoogleImage(resultBrand, resultName);
    }
    if (!imageUrl && rawLink && /^https?:\/\//i.test(rawLink)) {
      const linkData = await fetchProductPage(rawLink);
      if (linkData?.imageUrl) imageUrl = linkData.imageUrl;
    }

    const result = {
      name: resultName,
      brand: resultBrand,
      itemType: typeof raw.itemType === "string" ? raw.itemType.trim() || null : null,
      weightGrams: null,
      category: CATALOG_CATEGORIES.includes(raw.category) ? raw.category : null,
      description:
        typeof raw.description === "string" ? raw.description.trim() || null : null,
      link: rawLink && /^https?:\/\//i.test(rawLink) ? rawLink : null,
      imageUrl,
    };

    res.json(result);
  } catch (err) {
    console.error("[Anthropic] fill-item failed:", err.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

module.exports = router;
