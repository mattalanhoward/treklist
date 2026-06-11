// server/src/utils/tokenRegex.js
// Shared search-token helpers for catalog text matching.

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a regex for a search token that tolerates missing hyphens.
// "xmid" and "x-mid" both produce /x[-]?m[-]?i[-]?d/i so they match "X-Mid".
function tokenRegex(token) {
  const normalized = token.replace(/[-\s]+/g, "");
  const pattern = normalized.split("").map((c) => escapeRegex(c)).join("[-]?");
  return new RegExp(pattern, "i");
}

module.exports = { escapeRegex, tokenRegex };
