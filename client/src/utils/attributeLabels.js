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
  loadCapacityKg: "Load Capacity (kg)",
  frameType: "Frame Type",
  backPanelType: "Back Panel",
  hipBeltType: "Hip Belt",
  hipBeltRemovable: "Removable Hip Belt",
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

  // Hydration - Water Bottles
  capacityMl: "Capacity (ml)",
  capacityOz: "Capacity (fl oz)",
  insulated: "Insulated/Vacuum",
  mouthOpening: "Mouth Opening",
  leakProof: "Leak-Proof",
  collapsible: "Collapsible/Compressible",
  filterCompatible: "Filter Compatible",

  // Hydration - Reservoirs/Bladders
  capacityL: "Capacity (L)",
  bpaFree: "BPA-Free",
  openingType: "Opening Type",
  biteValveType: "Bite Valve Type",
  hoseLength: "Hose Length (in)",
  insulatedHose: "Insulated Hose",
  reversible: "Reversible for Cleaning",
  quickDisconnect: "Quick Disconnect",

  // Clothing - Rain Jackets
  layerConstruction: "Layer Construction",
  membrane: "Membrane Technology",
  waterproofRating: "Waterproof Rating (mm)",
  breathabilityRating: "Breathability (g/m²/24hr)",
  pitZips: "Pit Zips",
  packable: "Packable/Stowable",
  pfasFree: "PFAS-Free DWR",

  // Clothing - Insulated Jackets
  shellFabric: "Shell Fabric",
  temperatureRange: "Temperature Range",

  // Clothing - Synthetic Insulation
  insulationWeightGsm: "Insulation Weight (g/m²)",
  waterResistant: "Water-Resistant Insulation",

  // Clothing - Base Layers
  weight: "Weight Class",
  fabricType: "Fabric Type",
  fabricWeightGsm: "Fabric Weight (g/m²)",
  neckStyle: "Neck Style",
  sleevesLength: "Sleeve Length",
  thumbHoles: "Thumb Holes",

  // Clothing - Gloves
  style: "Style",
  touchscreenCompatible: "Touchscreen Compatible",
  gripPalm: "Reinforced Grip Palm",

  // Footwear - Hiking Boots
  cutHeight: "Cut Height",
  waterproof: "Waterproof",
  waterproofMembrane: "Waterproof Membrane",
  upperMaterial: "Upper Material",
  soleMaterial: "Sole Material",
  ankleSupport: "Ankle Support",
  midsoleType: "Midsole Type",
  shankType: "Shank/Stability",
  weightCategory: "Weight Category",
  useType: "Intended Use",

  // Footwear - Trail Running Shoes
  bestUse: "Best Use",
  shoeType: "Trail-Running Shoe Type",
  cushioning: "Running Shoe Cushioning",
  dropMm: "Heel-to-Toe Drop (mm)",
  heelStackHeightMm: "Heel Stack Height (mm)",
  forefootStackHeightMm: "Forefoot Stack Height (mm)",
  footwearHeight: "Footwear Height",
  footwearClosure: "Footwear Closure",
  upper: "Upper",
  lining: "Lining",
  midsole: "Midsole",
  outsole: "Outsole",
  rockPlate: "Rock Plate",
  vegan: "Vegan",

  // Clothing - Base Layer Bottom
  fitStyle: "Fit Style",
  inseamLength: "Inseam Length",
  flyType: "Fly Type",

  // Clothing - Socks
  sockType: "Sock Type",
  height: "Height",
  seamlessToe: "Seamless Toe",
  archSupport: "Arch Support",

  // Clothing - Headwear
  hatType: "Hat Type",
  uvRating: "UV Protection Rating",
  brimSize: "Brim Size",
  windproof: "Windproof",

  // Clothing - Shorts
  inseamIn: "Inseam (in)",
  stretchFabric: "Stretch Fabric",
  beltLoops: "Belt Loops",
  builtInLiner: "Built-in Liner",
  uvProtection: "UV Protection",

  // Clothing - Shirts
  quickDry: "Quick-Dry",
  vented: "Vented/Mesh Panels",
  moistureWicking: "Moisture-Wicking",
  buttonStyle: "Button/Closure Style",

  // Accessories - Sunglasses
  polarized: "Polarized Lenses",
  lensCategory: "Lens Category",
  frameMaterial: "Frame Material",
  lensMaterial: "Lens Material",
  interchangeableLenses: "Interchangeable Lenses",
  nosePadsAdjustable: "Adjustable Nose Pads",
  mirroredLens: "Mirrored/Reflective Lens",

  // Sleep System - Liners
  tempBoostF: "Temperature Boost (°F)",
  zippered: "Zippered",

  // Electronics - Power Banks
  outputPortsUsbA: "USB-A Output Ports",
  outputPortsUsbC: "USB-C Output Ports",
  inputPorts: "Input Port Type",
  fastCharging: "Fast Charging Support",
  solarCapable: "Solar Charging Capable",
  wirelessCharging: "Wireless Charging (Qi)",
  waterproofRating: "Waterproof Rating",
  passthroughCharging: "Pass-Through Charging",

  // Accessories - Towels
  size: "Size",
  absorbency: "Absorbency Level",
  antimicrobial: "Antimicrobial Treatment",
  hangLoop: "Hang Loop/Snap",

  // Consolidated schema fields
  syntheticInsulationType: "Synthetic Insulation Type",

  // General attributes used across multiple categories
  pockets: "Number of Pockets",
  material: "Material",
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
