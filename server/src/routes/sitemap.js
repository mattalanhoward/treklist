const express = require("express");
const router = express.Router();
const Community = require("../models/community");
const ShareToken = require("../models/ShareToken");

const BASE_URL = "https://treklist.co";
const APP_URL = "https://app.treklist.co";

const STATIC_URLS = [
  { loc: `${BASE_URL}/`, changefreq: "weekly", priority: "1.0" },
  // Legal
  { loc: `${BASE_URL}/legal/privacy`, changefreq: "monthly", priority: "0.3" },
  { loc: `${BASE_URL}/legal/terms`, changefreq: "monthly", priority: "0.3" },
  { loc: `${BASE_URL}/legal/cookies`, changefreq: "monthly", priority: "0.3" },
  { loc: `${BASE_URL}/legal/imprint`, changefreq: "monthly", priority: "0.3" },
  { loc: `${BASE_URL}/legal/affiliate-disclosure`, changefreq: "monthly", priority: "0.3" },
];

function urlEntry({ loc, changefreq, priority }) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

router.get("/", async (req, res) => {
  try {
    const [communities, shareTokens] = await Promise.all([
      Community.find({ isArchived: false }).select("slug").lean(),
      ShareToken.find({ revokedAt: null }).select("token").lean(),
    ]);

    const entries = [
      ...STATIC_URLS.map(urlEntry),
      ...communities.map((c) =>
        urlEntry({ loc: `${BASE_URL}/community/${c.slug}`, changefreq: "daily", priority: "0.7" })
      ),
      ...shareTokens.map((t) =>
        urlEntry({ loc: `${APP_URL}/share/${t.token}/`, changefreq: "weekly", priority: "0.8" })
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Error generating sitemap");
  }
});

module.exports = router;
