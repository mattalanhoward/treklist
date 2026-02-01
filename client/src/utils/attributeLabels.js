// client/src/utils/attributeLabels.js
// =============================================================================
// ATTRIBUTE LABEL UTILITIES
// =============================================================================
// Converts raw attribute keys (e.g., "volumeLiters") to human-readable labels
// (e.g., "Volume (L)") for display in catalog previews and item modals.
//
// Usage:
//   import { getAttributeLabel, formatAttributeValue } from "../utils/attributeLabels";
//
//   getAttributeLabel("volumeLiters", "Daypack")  // → "Volume (L)"
//   getAttributeLabel("unknownKey", "Daypack")    // → "Unknown Key" (fallback)
//   formatAttributeValue("hydrationCompatible", true) // → "Yes"
// =============================================================================

// Label lookup map - covers all schema fields across all item types
// This is a flat map since most keys are unique across schemas
const ATTRIBUTE_LABELS = {
  // Sleep System - Sleeping Bags
  tempRatingF: "Temperature Rating (°F)",
  fillPower: "Fill Power",
  shape: "Shape",
  gender: "Gender/Fit",
  lengthSize: "Length/Size",
  fillWeightOz: "Fill Weight (oz)",
  zipperSide: "Zipper Side",
  hoodType: "Hood Type",
  waterResistantDown: "Water-Resistant Down",
  rdsDown: "RDS Certified",
  insulationType: "Insulation Type",

  // Sleep System - Quilts
  widthSize: "Width/Size",
  attachmentSystem: "Attachment System",
  footboxType: "Footbox Type",

  // Sleep System - Pads
  rValue: "R-Value",
  thicknessIn: "Thickness (in)",
  inflationMethod: "Inflation Method",
  seasonRating: "Season Rating",
  padType: "Pad Type",

  // Backpacks
  volumeLiters: "Volume (L)",
  frameType: "Frame Type",
  backPanelType: "Back Panel",
  hipBeltType: "Hip Belt",
  waterResistance: "Water Resistance",
  mainFabric: "Main Fabric",
  torsoFitRange: "Torso Fit Range",
  hydrationCompatible: "Hydration Compatible",
  rainCoverIncluded: "Rain Cover Included",
  laptopSleeveSize: "Laptop Sleeve (in)",

  // Kitchen - Pots
  volumeMl: "Volume (ml)",
  diameterCm: "Diameter (cm)",
  heightCm: "Height (cm)",
  lidType: "Lid Type",
  handles: "Handles",
  graduations: "Measurement Graduations",
  pourSpout: "Pour Spout",
  coating: "Coating",

  // Kitchen - Stoves
  boilTime: "Boil Time - 1L (min)",
  burnTime: "Burn Time per 100g (min)",
  outputBtu: "Output (BTU)",
  igniterBuiltIn: "Built-in Igniter",
  potSupport: "Pot Support",
  windscreen: "Windscreen",
  regulatorValve: "Pressure Regulator",

  // Trekking Poles
  soldAs: "Sold As",
  adjustmentType: "Adjustment Type",
  lockingMechanism: "Locking Mechanism",
  minLengthCm: "Min Length (cm)",
  maxLengthCm: "Max Length (cm)",
  collapsedLengthCm: "Collapsed Length (cm)",
  sections: "Sections",
  gripMaterial: "Grip Material",
  strapType: "Strap Type",
  basketsIncluded: "Baskets Included",
  tipType: "Tip Type",

  // Shelter - Tents
  capacity: "Capacity",
  tentType: "Tent Type",
  wallType: "Wall Type",
  floorAreaSqM: "Floor Area (sq m)",
  vestibuleAreaSqM: "Vestibule Area (sq m)",
  peakHeightCm: "Peak Height (cm)",
  doors: "Doors",
  vestibules: "Vestibules",
  poleMaterial: "Pole Material",
  flyMaterial: "Fly Material",
  floorMaterial: "Floor Material",
  footprintIncluded: "Footprint Included",

  // Shelter - Tarps
  coverageAreaSqM: "Coverage Area (sq m)",
  lengthCm: "Length (cm)",
  widthCm: "Width (cm)",
  material: "Material",
  guyoutPoints: "Guyout Points",
  tieoutsIncluded: "Guylines Included",
  stakesIncluded: "Stakes Included",

  // Electronics - Headlamps
  maxLumens: "Max Output (lumens)",
  batteryType: "Battery Type",
  maxBeamDistance: "Max Beam Distance (m)",
  batteryCapacityMah: "Battery Capacity (mAh)",
  burnTimeHigh: "Burn Time - High (hrs)",
  burnTimeLow: "Burn Time - Low (hrs)",
  beamType: "Beam Type",
  redLightMode: "Red Light Mode",
  lockoutMode: "Lockout Mode",
  ipRating: "IP Rating",

  // Hydration - Water Filters
  filterType: "Filter Type",
  poreSize: "Pore Size (microns)",
  flowRate: "Flow Rate (L/min)",
  filterLifeL: "Filter Life (L)",
  removesViruses: "Removes Viruses",
  removesBacteria: "Removes Bacteria",
  removesProtozoa: "Removes Protozoa",
  backflushable: "Backflushable",
};

/**
 * Convert a camelCase or PascalCase key to Title Case with spaces.
 * e.g., "volumeLiters" → "Volume Liters", "hydrationCompatible" → "Hydration Compatible"
 */
function camelToTitleCase(str) {
  if (!str) return "";
  return (
    str
      // Insert space before uppercase letters
      .replace(/([A-Z])/g, " $1")
      // Capitalize first letter
      .replace(/^./, (char) => char.toUpperCase())
      .trim()
  );
}

/**
 * Get a human-readable label for an attribute key.
 *
 * @param {string} key - The attribute key (e.g., "volumeLiters")
 * @param {string} [itemType] - Optional item type for context (not currently used, but available for future)
 * @returns {string} Human-readable label (e.g., "Volume (L)")
 */
export function getAttributeLabel(key, itemType = null) {
  if (!key) return "";

  // Check lookup table first
  if (ATTRIBUTE_LABELS[key]) {
    return ATTRIBUTE_LABELS[key];
  }

  // Fallback: convert camelCase to Title Case
  return camelToTitleCase(key);
}

/**
 * Format an attribute value for display.
 * Handles booleans, nulls, and other special cases.
 *
 * @param {string} key - The attribute key
 * @param {any} value - The attribute value
 * @returns {string} Formatted display value
 */
export function formatAttributeValue(key, value) {
  if (value === null || value === undefined) return "—";
  if (value === "") return "—";

  // Boolean values (actual booleans)
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  // String booleans (from Mongoose Map serialization or old data)
  if (value === "true" || value === "True" || value === "TRUE") {
    return "Yes";
  }
  if (value === "false" || value === "False" || value === "FALSE") {
    return "No";
  }

  // Arrays (rare, but handle gracefully)
  if (Array.isArray(value)) {
    return value.join(", ") || "—";
  }

  return String(value);
}

/**
 * Transform raw attributes object into display-ready array of [label, value] pairs.
 *
 * @param {Object|Map} attributes - Raw attributes from CatalogItem/GlobalItem
 * @param {string} [itemType] - Optional item type for context
 * @returns {Array<[string, string]>} Array of [label, formattedValue] pairs
 */
export function formatAttributesForDisplay(attributes, itemType = null) {
  if (!attributes) return [];

  // Handle both Map and plain object
  const entries =
    attributes instanceof Map
      ? Array.from(attributes.entries())
      : Object.entries(attributes);

  return entries
    .filter(([k, v]) => {
      // Filter out empty keys
      if (!k || !String(k).trim()) return false;
      // Keep booleans (even false), filter out empty strings/null/undefined
      if (typeof v === "boolean") return true;
      if (v === null || v === undefined || String(v).trim() === "")
        return false;
      return true;
    })
    .map(([k, v]) => [
      getAttributeLabel(k, itemType),
      formatAttributeValue(k, v),
    ]);
}
