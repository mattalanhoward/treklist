const SUPPORTED_LANGS = ["nl", "de", "fr", "it", "es"];

const BASE = "https://translation.googleapis.com/language/translate/v2";

function getApiKey() {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new Error("GOOGLE_TRANSLATE_API_KEY is not set");
  return key;
}

// Key passed as query param per Google's REST API requirement — ensure your
// HTTP client / APM does not log outbound URLs in production.
async function detectLanguage(text) {
  if (!text) return null;
  const apiKey = getApiKey();
  const response = await fetch(`${BASE}/detect?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text.slice(0, 200) }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data?.detections?.[0]?.[0]?.language || null;
}

async function translateToLang(text, targetLang) {
  const apiKey = getApiKey();
  const response = await fetch(`${BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
  });
  if (!response.ok) throw new Error(`Google Translate error for ${targetLang}`);
  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText || text;
}

// Returns { nl: { description }, de: { description }, ... } — missing languages
// are omitted rather than aborting the whole call if one language fails.
async function translateAllLanguages(text) {
  if (!text) return {};
  const results = await Promise.allSettled(
    SUPPORTED_LANGS.map(async (lang) => [lang, { description: await translateToLang(text, lang) }])
  );
  return Object.fromEntries(
    results.filter((r) => r.status === "fulfilled").map((r) => r.value)
  );
}

module.exports = { translateAllLanguages, translateToLang, detectLanguage, SUPPORTED_LANGS };
