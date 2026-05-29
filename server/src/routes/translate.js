const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

const SUPPORTED_LANGS = new Set(["en", "nl", "de", "fr", "it", "es"]);

router.post("/", authMiddleware, async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return res.status(400).json({ message: "text and targetLang required" });
  if (!SUPPORTED_LANGS.has(targetLang)) return res.status(400).json({ message: "Unsupported language" });

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) return res.status(500).json({ message: "Translation not configured" });

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Google Translate error:", err);
      return res.status(502).json({ message: "Translation service error" });
    }

    const data = await response.json();
    const translated = data.data?.translations?.[0]?.translatedText;
    const detectedLang = data.data?.translations?.[0]?.detectedSourceLanguage;

    res.json({ translated, detectedSourceLanguage: detectedLang });
  } catch (err) {
    console.error("Translate route error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
