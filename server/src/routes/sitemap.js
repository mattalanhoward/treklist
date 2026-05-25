const express = require("express");
const router = express.Router();
const Community = require("../models/community");

const BASE_URL = "https://treklist.co";

const STATIC_URLS = [
  { loc: `${BASE_URL}/`, changefreq: "weekly", priority: "1.0" },
  // Featured gear lists (curated — add/remove manually)
  { loc: `${BASE_URL}/share/DEeOxfDkvBClbMqB/`, changefreq: "monthly", priority: "0.8" },
  { loc: `${BASE_URL}/share/5dnOar4EfadBxPy6/`, changefreq: "monthly", priority: "0.8" },
  { loc: `${BASE_URL}/share/x8WJwraT13LDbmDb/`, changefreq: "monthly", priority: "0.8" },
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
    const communities = await Community.find({ isArchived: false }).select("slug").lean();

    const entries = [
      ...STATIC_URLS.map(urlEntry),
      ...communities.map((c) =>
        urlEntry({ loc: `${BASE_URL}/community/${c.slug}`, changefreq: "daily", priority: "0.7" })
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
