// src/config/catalogTaxonomy.js
// Locked top-level categories for CatalogItem taxonomy.
// Keep these stable (order matters for UI).

export const CATALOG_CATEGORIES = [
  "Accessories & Tools",
  "Backpacks & Bags",
  "Electronics & Power",
  "Health & Hygiene",
  "Hydration",
  "Kitchen & Cooking",
  "Men's Clothing",
  "Navigation & Planning",
  "Sleep System",
  "Travel",
  "Unisex Clothing",
  "Women's Clothing",
];

// Merge locked categories with any existing “legacy” categories found in data.
// This avoids breaking existing items that used older values.
export function buildCategoryOptions({ existing = [], current = "" } = {}) {
  const locked = Array.from(new Set(CATALOG_CATEGORIES));
  const existingClean = (existing || [])
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  const legacy = existingClean.filter((c) => !locked.includes(c));

  const opts = [...locked];

  // Ensure current value is selectable even if it’s not in locked list
  if (current && !opts.includes(current)) opts.push(current);

  // Add remaining legacy values (sorted) after locked
  legacy
    .filter((c) => !opts.includes(c))
    .sort((a, b) => a.localeCompare(b))
    .forEach((c) => opts.push(c));

  return opts;
}
