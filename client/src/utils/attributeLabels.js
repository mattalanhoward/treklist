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
  tempRatingC: "Temperature Rating (°C)",
  tempRatingF: "Temperature Rating (°F)",
  fillPower: "Fill Power",
  shape: "Shape",
  gender: "Gender/Fit",
  lengthSize: "Length/Size",
  fillWeightG: "Fill Weight (g)",
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
  thicknessCm: "Thickness (cm)",
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
  diameterIn: "Diameter (in)",
  heightCm: "Height (cm)",
  heightIn: "Height (in)",
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
  floorAreaSqFt: "Floor Area (sq ft)",
  vestibuleAreaSqM: "Vestibule Area (sq m)",
  vestibuleAreaSqFt: "Vestibule Area (sq ft)",
  peakHeightCm: "Peak Height (cm)",
  peakHeightIn: "Peak Height (in)",
  doors: "Doors",
  vestibules: "Vestibules",
  poleMaterial: "Pole Material",
  flyMaterial: "Fly Material",
  floorMaterial: "Floor Material",
  footprintIncluded: "Footprint Included",

  // Shelter - Tarps
  coverageAreaSqM: "Coverage Area (sq m)",
  coverageAreaSqFt: "Coverage Area (sq ft)",
  lengthCm: "Length (cm)",
  lengthIn: "Length (in)",
  widthCm: "Width (cm)",
  widthIn: "Width (in)",
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
  hoseLength: "Hose Length (cm)",
  hoseLengthIn: "Hose Length (in)",
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
  inseamCm: "Inseam (cm)",
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
  tempBoostC: "Temperature Boost (°C)",
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

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------
const CM_TO_IN = (cm) => Math.round((cm / 2.54) * 10) / 10;
const IN_TO_CM = (inches) => Math.round(inches * 2.54 * 10) / 10;
const SQM_TO_SQFT = (sqm) => Math.round((sqm / 0.0929) * 10) / 10;
const SQFT_TO_SQM = (sqft) => Math.round(sqft * 0.0929 * 100) / 100;
const C_TO_F = (c) => Math.round(c * (9 / 5) + 32);
const F_TO_C = (f) => Math.round((f - 32) * (5 / 9));
const C_TO_F_DELTA = (c) => Math.round(c * (9 / 5));
const F_TO_C_DELTA = (f) => Math.round(f * (5 / 9));
const G_TO_OZ = (g) => Math.round((g / 28.3495) * 10) / 10;
const OZ_TO_G = (oz) => Math.round(oz * 28.3495);

// Metric/imperial pairs — used to filter display and convert on the fly
const UNIT_PAIRS = [
  { metric: "tempRatingC", imperial: "tempRatingF", toImperial: C_TO_F, toMetric: F_TO_C },
  { metric: "tempBoostC", imperial: "tempBoostF", toImperial: C_TO_F_DELTA, toMetric: F_TO_C_DELTA },
  { metric: "fillWeightG", imperial: "fillWeightOz", toImperial: G_TO_OZ, toMetric: OZ_TO_G },
  { metric: "thicknessCm", imperial: "thicknessIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "floorAreaSqM", imperial: "floorAreaSqFt", toImperial: SQM_TO_SQFT, toMetric: SQFT_TO_SQM },
  { metric: "vestibuleAreaSqM", imperial: "vestibuleAreaSqFt", toImperial: SQM_TO_SQFT, toMetric: SQFT_TO_SQM },
  { metric: "coverageAreaSqM", imperial: "coverageAreaSqFt", toImperial: SQM_TO_SQFT, toMetric: SQFT_TO_SQM },
  { metric: "inseamCm", imperial: "inseamIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "peakHeightCm", imperial: "peakHeightIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "lengthCm", imperial: "lengthIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "widthCm", imperial: "widthIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "diameterCm", imperial: "diameterIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "heightCm", imperial: "heightIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
  { metric: "hoseLength", imperial: "hoseLengthIn", toImperial: CM_TO_IN, toMetric: IN_TO_CM },
];

function getExcludedKeys(measurementSystem) {
  const side = measurementSystem === "imperial" ? "metric" : "imperial";
  return new Set(UNIT_PAIRS.map((p) => p[side]));
}

/**
 * Ensure both sides of each unit pair exist. If only one side is present,
 * compute the other on the fly so the user always sees their preferred unit.
 */
function ensurePairValues(attrsObj) {
  for (const pair of UNIT_PAIRS) {
    const hasMetric =
      attrsObj[pair.metric] != null &&
      String(attrsObj[pair.metric]).trim() !== "";
    const hasImperial =
      attrsObj[pair.imperial] != null &&
      String(attrsObj[pair.imperial]).trim() !== "";

    if (hasMetric && !hasImperial && pair.toImperial) {
      const val = Number(attrsObj[pair.metric]);
      if (Number.isFinite(val)) {
        attrsObj[pair.imperial] = pair.toImperial(val);
      }
    } else if (hasImperial && !hasMetric && pair.toMetric) {
      const val = Number(attrsObj[pair.imperial]);
      if (Number.isFinite(val)) {
        attrsObj[pair.metric] = pair.toMetric(val);
      }
    }
  }
  return attrsObj;
}

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
 * @param {string} [measurementSystem] - "metric" or "imperial" — filters unit pairs
 * @returns {Array<[string, string]>} Array of [label, formattedValue] pairs
 */
export function formatAttributesForDisplay(
  attributes,
  itemType = null,
  measurementSystem = "metric",
) {
  if (!attributes) return [];

  // Build a plain object, filling in any missing pair counterparts on the fly
  const raw =
    attributes instanceof Map
      ? Object.fromEntries(attributes)
      : { ...attributes };
  const attrsObj = ensurePairValues(raw);

  const excluded = getExcludedKeys(measurementSystem);

  return Object.entries(attrsObj)
    .filter(([k, v]) => {
      if (!k || !String(k).trim()) return false;
      if (excluded.has(k)) return false;
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
