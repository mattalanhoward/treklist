// server/src/services/itemTypeDetector.js
//
// Keyword-based detection of category + itemType from Amazon product data.
// Returns the best match with a confidence score, or null.

// Each entry: { keywords, category (optional for clothing), itemType, detectGender? }
// Multi-word keyword phrases score higher (specificity bonus).
// Order matters within an entry — first keyword matched wins for that entry.
const KEYWORD_MAP = [
  // --- Sleep System ---
  { keywords: ["sleeping bag"], category: "Sleep System", itemType: "Sleeping Bag" },
  { keywords: ["quilt", "top quilt", "backpacking quilt"], category: "Sleep System", itemType: "Quilt" },
  { keywords: ["inflatable sleeping pad", "inflatable pad", "air pad", "air sleeping pad"], category: "Sleep System", itemType: "Inflatable Sleeping Pad" },
  { keywords: ["foam sleeping pad", "foam pad", "z-lite", "zlite", "ccf pad", "closed cell"], category: "Sleep System", itemType: "Foam Sleeping Pad" },
  { keywords: ["sleeping bag liner", "bag liner", "sleep liner", "sheet liner"], category: "Sleep System", itemType: "Sleeping Bag Liner" },
  { keywords: ["camp pillow", "backpacking pillow", "inflatable pillow", "camping pillow", "travel pillow"], category: "Sleep System", itemType: "Pillow" },

  // --- Backpacks & Bags ---
  { keywords: ["backpacking pack", "hiking backpack", "backpack", "rucksack"], category: "Backpacks & Bags", itemType: "Backpack" },
  { keywords: ["daypack", "day pack"], category: "Backpacks & Bags", itemType: "Daypack" },
  { keywords: ["hip pack", "fanny pack", "waist pack", "belt pack"], category: "Backpacks & Bags", itemType: "Hip Pack" },

  // --- Kitchen & Cooking ---
  { keywords: ["backpacking pot", "cook pot", "titanium pot", "camping pot", "cooking pot"], category: "Kitchen & Cooking", itemType: "Backpacking Pot" },
  { keywords: ["backpacking stove", "canister stove", "camp stove", "camping stove", "pocket stove"], category: "Kitchen & Cooking", itemType: "Backpacking Stove (Canister)" },
  { keywords: ["coffee mug", "camp mug", "titanium mug", "camping mug", "camp cup"], category: "Kitchen & Cooking", itemType: "Coffee Mug" },
  { keywords: ["spork", "titanium spork", "camping utensil", "hiking utensil"], category: "Kitchen & Cooking", itemType: "Utensil" },
  { keywords: ["fuel canister", "stove fuel", "isobutane", "butane fuel", "gas canister"], category: "Kitchen & Cooking", itemType: "Stove Fuel" },

  // --- Shelter ---
  { keywords: ["backpacking tent", "camping tent", "ultralight tent", "hiking tent", "tent"], category: "Shelter", itemType: "Backpacking Tent" },
  { keywords: ["tarp shelter", "ultralight tarp", "camping tarp"], category: "Shelter", itemType: "Tarp Shelter" },
  { keywords: ["tent stakes", "tent pegs", "ultralight stakes", "titanium stakes"], category: "Shelter", itemType: "Tent Stakes" },
  { keywords: ["ground sheet", "groundsheet", "tent footprint", "footprint"], category: "Shelter", itemType: "Ground Sheet" },

  // --- Electronics & Power ---
  { keywords: ["headlamp", "head lamp", "head torch"], category: "Electronics & Power", itemType: "Headlamp" },
  { keywords: ["camp lantern", "camping lantern", "tent lantern"], category: "Electronics & Power", itemType: "Camp Lantern" },
  { keywords: ["power bank", "battery pack", "portable charger", "portable battery"], category: "Electronics & Power", itemType: "Power Bank" },
  { keywords: ["travel charger", "usb charger", "wall charger", "charging adapter"], category: "Electronics & Power", itemType: "Travel Charger" },

  // --- Hydration ---
  { keywords: ["water filter", "water purifier", "water filtration"], category: "Hydration", itemType: "Water Filter" },
  { keywords: ["water bottle", "nalgene", "hydro flask"], category: "Hydration", itemType: "Water Bottle" },
  { keywords: ["hydration reservoir", "hydration bladder", "water bladder", "hydration pack"], category: "Hydration", itemType: "Hydration Reservoir" },

  // --- Footwear ---
  { keywords: ["hiking boots", "hiking boot", "backpacking boots", "trekking boots"], category: "Footwear", itemType: "Hiking Boots" },
  { keywords: ["trail running shoes", "trail runners", "trail running shoe", "trail shoe"], category: "Footwear", itemType: "Trail Running Shoes" },
  { keywords: ["hiking sandals", "camp sandals", "sport sandals", "sandals"], category: "Footwear", itemType: "Sandals" },

  // --- Clothing (gender-detected) ---
  { keywords: ["rain jacket", "waterproof jacket", "rain shell", "hardshell jacket"], itemType: "Rain Jacket", detectGender: true },
  { keywords: ["rain pants", "waterproof pants", "rain trousers"], itemType: "Rain Pants", detectGender: true },
  { keywords: ["rain poncho", "poncho"], itemType: "Rain Poncho", detectGender: true },
  { keywords: ["insulated jacket", "down jacket", "puffy jacket", "puffer jacket", "synthetic jacket", "puffer"], itemType: "Insulated Jacket", detectGender: true },
  { keywords: ["fleece jacket", "fleece pullover", "midlayer", "mid-layer", "fleece"], itemType: "Fleece Jacket", detectGender: true },
  { keywords: ["base layer top", "thermal top", "baselayer top", "merino top", "thermal shirt"], itemType: "Base Layer Top", detectGender: true },
  { keywords: ["base layer bottom", "thermal bottom", "baselayer bottom", "long underwear", "thermal legging", "thermal tights"], itemType: "Base Layer Bottom", detectGender: true },
  { keywords: ["underwear", "boxer brief", "briefs", "boxers"], itemType: "Underwear", detectGender: true },
  { keywords: ["hiking socks", "merino socks", "wool socks", "trail socks", "trekking socks"], itemType: "Hiking Socks", detectGender: true },
  { keywords: ["sun hat", "trucker hat", "beanie", "headwear", "baseball cap", "hiking hat"], itemType: "Hat/Headwear", detectGender: true },
  { keywords: ["hiking shorts", "trail shorts", "running shorts"], itemType: "Hiking Shorts", detectGender: true },
  { keywords: ["convertible pants", "zip-off pants", "zip off pants"], itemType: "Convertible Pants", detectGender: true },
  { keywords: ["hiking pants", "trail pants", "trekking pants", "hiking trousers"], itemType: "Hiking Pants", detectGender: true },
  { keywords: ["hiking shirt", "sun hoodie", "sun shirt", "hiking tee"], itemType: "Hiking Shirt", detectGender: true },
  { keywords: ["insulated gloves", "hiking gloves", "winter gloves"], itemType: "Gloves (Insulated)", detectGender: true },

  // --- Accessories & Tools ---
  { keywords: ["trekking poles", "hiking poles", "walking poles", "trekking pole"], category: "Accessories & Tools", itemType: "Trekking Poles" },
  { keywords: ["sunglasses", "hiking sunglasses", "sport sunglasses"], category: "Accessories & Tools", itemType: "Sunglasses" },
  { keywords: ["bear canister", "bear can", "bear vault"], category: "Accessories & Tools", itemType: "Bear Canister" },
  { keywords: ["pocket knife", "folding knife", "camp knife"], category: "Accessories & Tools", itemType: "Pocket Knife" },
  { keywords: ["mosquito head net", "bug net", "head net", "insect net"], category: "Accessories & Tools", itemType: "Mosquito Head Net" },
  { keywords: ["umbrella", "hiking umbrella", "trekking umbrella"], category: "Accessories & Tools", itemType: "Umbrella" },

  // --- Travel ---
  { keywords: ["travel towel", "camp towel", "microfiber towel", "quick dry towel", "packable towel"], category: "Travel", itemType: "Travel Towel" },

  // --- Health & Hygiene ---
  { keywords: ["toiletry bag", "toiletry kit", "toiletries"], category: "Health & Hygiene", itemType: "Toiletry" },
  { keywords: ["first aid kit", "first aid"], category: "Health & Hygiene", itemType: "First Aid Kit" },
  { keywords: ["blister prevention", "blister kit", "moleskin", "blister pad"], category: "Health & Hygiene", itemType: "Blister Prevention" },
];

// Gender keywords used when detectGender is true
const MENS_KEYWORDS = ["men's", "mens", " male ", " men ", "for men"];
const WOMENS_KEYWORDS = ["women's", "womens", " female ", " women ", "for women"];

function detectGenderCategory(text) {
  const isMens = MENS_KEYWORDS.some((k) => text.includes(k));
  const isWomens = WOMENS_KEYWORDS.some((k) => text.includes(k));

  if (isMens && !isWomens) return "Men's Clothing";
  if (isWomens && !isMens) return "Women's Clothing";
  return "Unisex Clothing";
}

function detectItemType(title, features = []) {
  const text = [title || "", ...(features || [])]
    .join(" ")
    .toLowerCase();

  if (!text.trim()) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Score by word count (multi-word = more specific = higher confidence)
        const score = keyword.split(/\s+/).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
        break; // Only count best keyword per entry
      }
    }
  }

  if (!bestMatch) return null;

  let category = bestMatch.category;

  if (bestMatch.detectGender) {
    category = detectGenderCategory(text);
  }

  return {
    category,
    itemType: bestMatch.itemType,
    confidence: bestScore >= 2 ? "high" : "medium",
  };
}

module.exports = { detectItemType };
