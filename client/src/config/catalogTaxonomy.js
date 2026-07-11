// src/config/catalogTaxonomy.js
// Locked top-level categories for CatalogItem taxonomy.
// Keep these stable (order matters for UI).

export const CATALOG_CATEGORIES = [
  "Accessories & Tools",
  "Backpacks & Bags",
  "Electronics & Power",
  "Footwear",
  "Health & Hygiene",
  "Hydration",
  "Kitchen & Cooking",
  "Men's Clothing",
  "Navigation & Planning",
  "Shelter",
  "Sleep System",
  "Travel",
  "Unisex Clothing",
  "Women's Clothing",
];

// UI helper: translate a canonical category value
// Usage: tCategory(t, "Backpacks & Bags") -> "Rugzakken & tassen" (nl) or fallback to the value
export function tCategory(t, value) {
  if (!value) return "";
  return t?.(`catalog.categories.${value}`, value) ?? value;
}

// UI helper: translate a canonical item type value
// Usage: tItemType(t, "Sleeping Bag") -> "Sac de couchage" (fr) or fallback to the value
export function tItemType(t, value) {
  if (!value) return "";
  return t?.(`catalog.itemTypes.${value}`, value) ?? value;
}

// Locked subcategories per top-level category.
// Keep these stable — add new values here when expanding the catalog.
export const CATALOG_SUBCATEGORIES = {
  "Accessories & Tools": [
    "Climbing Gear",
    "Dry Bags",
    "Fire",
    "Food Storage",
    "Insect Protection",
    "Knives",
    "Micro Spikes",
    "Organization",
    "Rain Gear",
    "Tools",
    "Trekking Poles",
  ],
  "Backpacks & Bags": ["Backpacking Packs", "Day Packs & Accessories"],
  "Electronics & Power": [
    "Batteries",
    "Charging & Power Banks",
    "Headlamps",
    "Headphones & Earbuds",
    "Lighting",
    "Torch Lights",
    "Phones & GPS",
    "Photo & Video",
    "Wearables & GPS",
  ],
  Footwear: ["Men's Footwear", "Unisex Footwear", "Women's Footwear"],
  "Health & Hygiene": [
    "First Aid",
    "Foot Care",
    "Men's Personal Care",
    "Personal Care",
    "Soap Bar Case",
    "Toilet",
    "Toiletry Sets",
    "Wag Bags",
    "Women's Personal Care",
  ],
  Hydration: ["Hydration Containers", "Water", "Water Treatment"],
  "Kitchen & Cooking": [
    "Coffee",
    "Cookware",
    "Fuel - Isobutane",
    "Stoves",
    "Utensils",
  ],
  "Men's Clothing": [
    "Base Layers",
    "Gaiters",
    "Hands",
    "Jackets",
    "Long-Sleeved T-Shirt",
    "Neck Gaiter",
    "Pants",
    "Rain Gear",
    "Shirts",
    "Shorts",
    "Socks",
    "Underwear",
  ],
  "Navigation & Planning": ["Guidebooks & Maps"],
  Shelter: ["Backpacking Tarps", "Ground Sheet", "Tent Stakes", "Tents"],
  "Sleep System": [
    "Pillows",
    "Quilts",
    "Sleeping Bag Accessories",
    "Sleeping Bag Liners",
    "Sleeping Bags",
    "Sleeping Pad Accessories",
    "Sleeping Pads",
  ],
  Travel: ["Documents", "Personal Care", "Towels", "Wallet"],
  "Unisex Clothing": [
    "Accessories",
    "Base Layers",
    "Gaiters",
    "Hands",
    "Headwear",
    "Jackets",
    "Long-Sleeved T-Shirt",
    "Neck Gaiter",
    "Pants",
    "Rain Gear",
    "Shirts",
    "Shorts",
    "Socks",
    "Underwear",
  ],
  "Women's Clothing": [
    "Base Layers",
    "Gaiters",
    "Hands",
    "Jackets",
    "Long-Sleeved T-Shirt",
    "Neck Gaiter",
    "Pants",
    "Rain Gear",
    "Shirts",
    "Shorts",
    "Socks",
    "Underwear",
  ],
};

// UI helper: translate a canonical subcategory value
// Usage: tSubcategory(t, "Sleeping Bags") -> "Sacs de couchage" (fr) or fallback to the value
export function tSubcategory(t, value) {
  if (!value) return "";
  return t?.(`catalog.subcategories.${value}`, value) ?? value;
}

// Returns options for a <select>, legacy-safe.
// If the item's current subcategory isn't in the locked list, it's appended so the
// form doesn't silently lose the value.
export function buildSubcategoryOptions(category, { current = "" } = {}) {
  const locked = CATALOG_SUBCATEGORIES[category] ?? [];
  const opts = Array.from(new Set([...locked]));
  if (current && !opts.includes(current)) opts.push(current);
  return opts;
}

// Merge locked categories with any existing "legacy" categories found in data.
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
