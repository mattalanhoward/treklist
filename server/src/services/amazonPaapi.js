// server/src/services/amazonPaapi.js
const crypto = require("crypto");

const SERVICE = "ProductAdvertisingAPI";
const REGION = "us-east-1"; // PA-API signing region commonly used

const MARKETPLACE_HOST = {
  us: "webservices.amazon.com",
  uk: "webservices.amazon.co.uk",
  de: "webservices.amazon.de",
  fr: "webservices.amazon.fr",
  it: "webservices.amazon.it",
  es: "webservices.amazon.es",
  nl: "webservices.amazon.nl",
  ca: "webservices.amazon.ca",
  se: "webservices.amazon.se",
  pl: "webservices.amazon.pl",
};

function assertEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return String(v).trim();
}

function getPartnerTagForMarketplace(marketplace) {
  // Recommended: set one per marketplace you use
  // e.g. AMAZON_PARTNER_TAG_US="talljoehikes-20"
  //      AMAZON_PARTNER_TAG_UK="talljoehikes-21"
  const key = `AMAZON_PARTNER_TAG_${String(marketplace).toUpperCase()}`;
  return process.env[key] ? String(process.env[key]).trim() : null;
}

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc);
}
function sha256(data, enc) {
  return crypto.createHash("sha256").update(data, "utf8").digest(enc);
}

function toAmzDate(date = new Date()) {
  // YYYYMMDDTHHMMSSZ
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function getSignatureKey(secret, dateStamp, region, service) {
  const kDate = hmac("AWS4" + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  return kSigning;
}

async function paapiGetItems({
  asin,
  asins,
  marketplace,
  partnerTag,
  resources,
}) {
  const accessKey = assertEnv("AMAZON_PAAPI_ACCESS_KEY");
  const secretKey = assertEnv("AMAZON_PAAPI_SECRET_KEY");

  const host = MARKETPLACE_HOST[marketplace];
  if (!host) throw new Error(`Unsupported marketplace: ${marketplace}`);

  if (!partnerTag) {
    throw new Error(
      `Missing partnerTag for marketplace "${marketplace}". Set AMAZON_PARTNER_TAG_${String(
        marketplace
      ).toUpperCase()}`
    );
  }

  // ✅ Allow 1..10 ItemIds
  const itemIds = Array.isArray(asins) ? asins : [asin];
  const cleanItemIds = itemIds
    .map((x) =>
      String(x || "")
        .trim()
        .toUpperCase()
    )
    .filter(Boolean)
    .slice(0, 10);

  if (!cleanItemIds.length) throw new Error("Missing ItemIds (ASINs)");

  const url = `https://${host}/paapi5/getitems`;
  const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

  const body = JSON.stringify({
    ItemIds: cleanItemIds,
    ItemIdType: "ASIN",
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: `www.${host.replace("webservices.", "")}`,
    Resources: resources,
  });

  const amzDate = toAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = "/paapi5/getitems";
  const canonicalQuerystring = "";
  const canonicalHeaders =
    "content-encoding:amz-1.0\n" +
    "content-type:application/json; charset=utf-8\n" +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders =
    "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const payloadHash = sha256(body, "hex");

  const canonicalRequest =
    "POST\n" +
    canonicalUri +
    "\n" +
    canonicalQuerystring +
    "\n" +
    canonicalHeaders +
    "\n" +
    signedHeaders +
    "\n" +
    payloadHash;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign =
    algorithm +
    "\n" +
    amzDate +
    "\n" +
    credentialScope +
    "\n" +
    sha256(canonicalRequest, "hex");

  const signingKey = getSignatureKey(secretKey, dateStamp, REGION, SERVICE);
  const signature = hmac(signingKey, stringToSign, "hex");

  const authorizationHeader =
    `${algorithm} ` +
    `Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const headers = {
    "Content-Encoding": "amz-1.0",
    "Content-Type": "application/json; charset=utf-8",
    Host: host,
    "X-Amz-Date": amzDate,
    "X-Amz-Target": target,
    Authorization: authorizationHeader,
  };

  const resp = await fetch(url, { method: "POST", headers, body });
  const text = await resp.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `PA-API returned non-JSON (status ${resp.status}): ${text}`
    );
  }

  if (!resp.ok) {
    const msg =
      json?.Errors?.[0]?.Message ||
      json?.message ||
      `PA-API error (status ${resp.status})`;
    throw new Error(msg);
  }

  return json;
}

function pickFirst(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function parsePaapiItem(json) {
  const item = json?.ItemsResult?.Items?.[0];
  if (!item) return null;

  const title = item?.ItemInfo?.Title?.DisplayValue;
  const brand =
    item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ||
    item?.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue;

  // “Description” – PA-API often provides Features array; we join them
  const features = item?.ItemInfo?.Features?.DisplayValues;
  const description =
    Array.isArray(features) && features.length
      ? features.slice(0, 6).join(" • ")
      : undefined;

  const modelNumber =
    item?.ItemInfo?.ManufactureInfo?.Model?.DisplayValue ||
    item?.ItemInfo?.ProductInfo?.Model?.DisplayValue;

  const image =
    item?.Images?.Primary?.Large?.URL ||
    item?.Images?.Primary?.Medium?.URL ||
    item?.Images?.Primary?.Small?.URL;

  // Offers
  const listing = item?.Offers?.Listings?.[0];

  // Detail page url (may or may not include tag)
  const detailUrl = item?.DetailPageURL;

  // Weight/dimensions (often missing in PA-API; keep best-effort)
  const dims = item?.ItemInfo?.ProductInfo?.ItemDimensions;
  const length = dims?.Length?.DisplayValue;
  const width = dims?.Width?.DisplayValue;
  const height = dims?.Height?.DisplayValue;
  const dimUnit = dims?.Length?.Unit || dims?.Width?.Unit || dims?.Height?.Unit;

  const weight = item?.ItemInfo?.ProductInfo?.ItemWeight?.DisplayValue;
  const weightUnit = item?.ItemInfo?.ProductInfo?.ItemWeight?.Unit;

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

function buildAmazonAffiliateUrl({ asin, marketplace, partnerTag }) {
  // You control the tag here. This avoids “why am I building the link?”
  // If Amazon returns DetailPageURL without tag, you still get a tagged url.
  const domainByMarketplace = {
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
  const domain = domainByMarketplace[marketplace] || "www.amazon.com";
  const base = `https://${domain}/dp/${asin}`;

  // Partner tag param is traditionally `tag=...`
  return partnerTag ? `${base}?tag=${encodeURIComponent(partnerTag)}` : base;
}

module.exports = {
  paapiGetItems,
  parsePaapiItem,
  getPartnerTagForMarketplace,
  buildAmazonAffiliateUrl,
};
