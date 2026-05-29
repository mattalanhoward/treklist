const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { translateLimiter } = require("../middleware/rateLimiters");
const { translateToLang } = require("../utils/googleTranslate");

const SUPPORTED_LANGS = new Set(["en", "nl", "de", "fr", "it", "es"]);

router.post("/", authMiddleware, translateLimiter, async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return res.status(400).json({ message: "text and targetLang required" });
  if (text.length > 5000) return res.status(400).json({ message: "Text too long" });
  if (!SUPPORTED_LANGS.has(targetLang)) return res.status(400).json({ message: "Unsupported language" });
  if (!process.env.GOOGLE_TRANSLATE_API_KEY) return res.status(500).json({ message: "Translation not configured" });

  try {
    const translated = await translateToLang(text, targetLang);
    res.json({ translated });
  } catch (err) {
    console.error("Translate route error:", err);
    res.status(502).json({ message: "Translation service error" });
  }
});

module.exports = router;
