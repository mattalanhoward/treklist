// server/src/services/amazonCreatorsApi.js

// --- Amazon Creators API region definitions ---
const REGIONS = {
  NA: {
    tokenEndpoint:
      "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token",
    version: "2.1",
    marketplaces: new Set(["us", "ca"]),
  },
  EU: {
    tokenEndpoint:
      "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token",
    version: "2.2",
    marketplaces: new Set(["uk", "de", "fr", "it", "es", "nl", "se", "pl"]),
  },
  FE: {
    tokenEndpoint:
      "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
    version: "2.3",
    marketplaces: new Set(["jp"]),
  },
};

const API_BASE = "https://creatorsapi.amazon/catalog/v1";

const DEFAULT_ITEM_RESOURCES = [
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "itemInfo.features",
  "itemInfo.manufactureInfo",
  "itemInfo.productInfo",
  "images.primary.large",
  "images.primary.medium",
];

const DOMAIN_BY_MARKETPLACE = {
  us: "www.amazon.com",
  uk: "www.amazon.co.uk",
  de: "www.amazon.de",
  fr: "www.amazon.fr",
  it: "www.amazon.it",
  es: "www.amazon.es",
  nl: "www.amazon.nl",
  ca: "www.amazon.ca",
  se: "www.amazon.se",
  pl: "www.amazon.pl",
};

// Build reverse lookup: marketplace -> region key
function getRegionForMarketplace(marketplace) {
  for (const [regionKey, cfg] of Object.entries(REGIONS)) {
    if (cfg.marketplaces.has(marketplace)) return regionKey;
  }
  return null;
}

// --- Utilities ---

function assertEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return String(v).trim();
}

function getPartnerTagForMarketplace(marketplace) {
  const key = `AMAZON_PARTNER_TAG_${String(marketplace).toUpperCase()}`;
  return process.env[key] ? String(process.env[key]).trim() : null;
}

function buildAmazonAffiliateUrl({ asin, marketplace, partnerTag }) {
  const domain = DOMAIN_BY_MARKETPLACE[marketplace] || "www.amazon.com";
  const base = `https://${domain}/dp/${asin}`;
  return partnerTag ? `${base}?tag=${encodeURIComponent(partnerTag)}` : base;
}

// --- OAuth 2.0 Token Cache (per region) ---

const TOKEN_CACHE = new Map();
const TOKEN_TTL_BUFFER_MS = 60 * 1000; // refresh 60s before actual expiry

function getCachedToken(regionKey) {
  const entry = TOKEN_CACHE.get(regionKey);
  if (!entry) return null;
  if (entry.exp <= Date.now()) {
    TOKEN_CACHE.delete(regionKey);
    return null;
  }
  return entry.token;
}

function setCachedToken(regionKey, token, expiresInSeconds) {
  const ttlMs = expiresInSeconds * 1000 - TOKEN_TTL_BUFFER_MS;
  TOKEN_CACHE.set(regionKey, {
    token,
    exp: Date.now() + Math.max(ttlMs, 0),
  });
}

async function getAccessToken(regionKey) {
  const cached = getCachedToken(regionKey);
  if (cached) return cached;

  const region = REGIONS[regionKey];
  if (!region) throw new Error(`Unknown Creators API region: ${regionKey}`);

  const credentialId = assertEnv("AMAZON_CREATORS_CREDENTIAL_ID");
  const credentialSecret = assertEnv("AMAZON_CREATORS_CREDENTIAL_SECRET");

  const basicAuth = Buffer.from(
    `${credentialId}:${credentialSecret}`
  ).toString("base64");

  const resp = await fetch(region.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "creatorsapi/default",
    }).toString(),
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Creators API token endpoint returned non-JSON (status ${resp.status}): ${text}`
    );
  }

  if (!resp.ok || !json.access_token) {
    throw new Error(
      `Creators API token request failed (status ${resp.status}): ${
        json.error || json.message || text
      }`
    );
  }

  // Cognito returns: { access_token, expires_in, token_type }
  // expires_in is typically ~3570 seconds (~59.5 minutes)
  setCachedToken(regionKey, json.access_token, json.expires_in || 3570);

  return json.access_token;
}

// --- Main API Call ---

async function creatorsGetItems({
  asin,
  asins,
  marketplace,
  partnerTag,
  resources,
}) {
  const regionKey = getRegionForMarketplace(marketplace);
  if (!regionKey) throw new Error(`Unsupported marketplace: ${marketplace}`);

  if (!partnerTag) {
    throw new Error(
      `Missing partnerTag for marketplace "${marketplace}". Set AMAZON_PARTNER_TAG_${String(
        marketplace
      ).toUpperCase()}`
    );
  }

  // Allow 1..10 itemIds
  const itemIds = Array.isArray(asins) ? asins : [asin];
  const cleanItemIds = itemIds
    .map((x) =>
      String(x || "")
        .trim()
        .toUpperCase()
    )
    .filter(Boolean)
    .slice(0, 10);

  if (!cleanItemIds.length) throw new Error("Missing itemIds (ASINs)");

  const token = await getAccessToken(regionKey);
  const region = REGIONS[regionKey];
  const url = `${API_BASE}/getItems`;

  const body = JSON.stringify({
    itemIds: cleanItemIds,
    itemIdType: "ASIN",
    partnerTag,
    partnerType: "Associates",
    resources: resources || DEFAULT_ITEM_RESOURCES,
  });

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Bearer ${token}, Version ${region.version}`,
    "x-marketplace": DOMAIN_BY_MARKETPLACE[marketplace] || "www.amazon.com",
  };

  const resp = await fetch(url, { method: "POST", headers, body });
  const text = await resp.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Creators API returned non-JSON (status ${resp.status}): ${text}`
    );
  }

  if (!resp.ok) {
    const msg =
      json?.errors?.[0]?.message ||
      json?.Errors?.[0]?.Message ||
      json?.message ||
      `Creators API error (status ${resp.status})`;
    throw new Error(msg);
  }

  return json;
}

// --- Response Parser ---

function parseCreatorsItem(json) {
  // Try camelCase (Creators API) first, PascalCase (PA-API legacy) fallback
  const item =
    json?.itemsResult?.items?.[0] || json?.ItemsResult?.Items?.[0];
  if (!item) return null;

  const title =
    item?.itemInfo?.title?.displayValue ||
    item?.ItemInfo?.Title?.DisplayValue;

  const brand =
    item?.itemInfo?.byLineInfo?.brand?.displayValue ||
    item?.itemInfo?.byLineInfo?.manufacturer?.displayValue ||
    item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ||
    item?.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue;

  const features =
    item?.itemInfo?.features?.displayValues ||
    item?.ItemInfo?.Features?.DisplayValues;
  const description =
    Array.isArray(features) && features.length
      ? features.slice(0, 6).join(" \u2022 ")
      : undefined;

  const modelNumber =
    item?.itemInfo?.manufactureInfo?.model?.displayValue ||
    item?.itemInfo?.productInfo?.model?.displayValue ||
    item?.ItemInfo?.ManufactureInfo?.Model?.DisplayValue ||
    item?.ItemInfo?.ProductInfo?.Model?.DisplayValue;

  const image =
    item?.images?.primary?.large?.url ||
    item?.images?.primary?.medium?.url ||
    item?.images?.primary?.small?.url ||
    item?.Images?.Primary?.Large?.URL ||
    item?.Images?.Primary?.Medium?.URL ||
    item?.Images?.Primary?.Small?.URL;

  const detailUrl = item?.detailPageURL || item?.DetailPageURL;

  // Weight / dimensions (often missing; best-effort)
  const dims =
    item?.itemInfo?.productInfo?.itemDimensions ||
    item?.ItemInfo?.ProductInfo?.ItemDimensions;
  const length = dims?.length?.displayValue || dims?.Length?.DisplayValue;
  const width = dims?.width?.displayValue || dims?.Width?.DisplayValue;
  const height = dims?.height?.displayValue || dims?.Height?.DisplayValue;
  const dimUnit =
    dims?.length?.unit ||
    dims?.width?.unit ||
    dims?.height?.unit ||
    dims?.Length?.Unit ||
    dims?.Width?.Unit ||
    dims?.Height?.Unit;

  const weightNode =
    item?.itemInfo?.productInfo?.itemWeight ||
    item?.ItemInfo?.ProductInfo?.ItemWeight;
  const weight = weightNode?.displayValue || weightNode?.DisplayValue;
  const weightUnit = weightNode?.unit || weightNode?.Unit;

  return {
    title,
    brand,
    description,
    modelNumber,
    imageUrls: image ? [image] : [],
    detailUrl,
    rawDims: { length, width, height, unit: dimUnit },
    rawWeight: { value: weight, unit: weightUnit },
  };
}

module.exports = {
  creatorsGetItems,
  parseCreatorsItem,
  getPartnerTagForMarketplace,
  buildAmazonAffiliateUrl,
};
