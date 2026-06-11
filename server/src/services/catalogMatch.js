// server/src/services/catalogMatch.js
// Match AI-extracted item fields ({name, brand, itemType}) against the catalog.
//
// The catalog search requires every token to match some field, but AI
// extraction often appends generic words ("Exos 58 Backpack") that aren't in
// any catalog field and silently produce zero matches. This service retries
// progressively looser queries until something hits:
//   1. all name + brand tokens (deduped)
//   2. minus tokens that appear in itemType ("Backpack", "Stove", ...)
//   3. minus trailing tokens, one at a time, down to two tokens
const CatalogItem = require("../models/catalogItem");
const { tokenRegex } = require("../utils/tokenRegex");

const MATCH_FIELDS =
  "name brand category subcategory itemType description weightGrams imageUrls tags";
const MAX_ATTEMPTS = 4;

function tokenize(str) {
  return String(str || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function buildAttempts({ name, brand, itemType }) {
  const seen = new Set();
  const base = [];
  for (const tok of [...tokenize(name), ...tokenize(brand)]) {
    const key = tok.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      base.push(tok);
    }
  }
  if (base.length === 0) return [];

  const attempts = [base];
  const typeWords = new Set(tokenize(itemType).map((t) => t.toLowerCase()));
  if (typeWords.size > 0) {
    const stripped = base.filter((t) => !typeWords.has(t.toLowerCase()));
    if (stripped.length > 0 && stripped.length < base.length) attempts.push(stripped);
  }
  let current = attempts[attempts.length - 1];
  while (current.length > 2 && attempts.length < MAX_ATTEMPTS) {
    current = current.slice(0, -1);
    attempts.push(current);
  }
  return attempts.slice(0, MAX_ATTEMPTS);
}

function tokenQuery(tokens) {
  const fields = (regex) => [
    { name: regex },
    { brand: regex },
    { tags: regex },
    { subcategory: regex },
  ];
  if (tokens.length === 1) return { $or: fields(tokenRegex(tokens[0])) };
  return { $and: tokens.map((t) => ({ $or: fields(tokenRegex(t)) })) };
}

// Best-effort: returns [] on any failure rather than throwing.
async function findCatalogMatches(extracted, limit = 4) {
  try {
    for (const tokens of buildAttempts(extracted || {})) {
      const items = await CatalogItem.find({ isActive: true, ...tokenQuery(tokens) })
        .collation({ locale: "en", strength: 2 })
        .sort({ brand: 1, name: 1 })
        .limit(limit)
        .select(MATCH_FIELDS)
        .lean();
      if (items.length > 0) return items;
    }
  } catch (err) {
    console.warn("[catalogMatch] lookup failed:", err.message);
  }
  return [];
}

module.exports = { findCatalogMatches };
