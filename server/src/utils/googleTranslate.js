const SUPPORTED_LANGS = ["nl", "de", "fr", "it", "es"];

async function detectLanguage(text) {
  if (!text) return null;
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text.slice(0, 200) }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data?.detections?.[0]?.[0]?.language || null;
}

async function translateToLang(text, targetLang) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
  });
  if (!response.ok) throw new Error(`Google Translate error for ${targetLang}`);
  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText || text;
}

// Returns { nl: { description }, de: { description }, fr: { description }, it: { description }, es: { description } }
async function translateAllLanguages(text) {
  if (!text) return {};
  const entries = await Promise.all(
    SUPPORTED_LANGS.map(async (lang) => {
      const translated = await translateToLang(text, lang);
      return [lang, { description: translated }];
    })
  );
  return Object.fromEntries(entries);
}

module.exports = { translateAllLanguages, translateToLang, detectLanguage, SUPPORTED_LANGS };
