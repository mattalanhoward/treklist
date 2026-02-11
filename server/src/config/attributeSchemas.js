// server/src/config/attributeSchemas.js
// =============================================================================
// ATTRIBUTE SCHEMAS FOR TREKLIST CATALOG ITEMS
// =============================================================================
//
// This file defines structured, validated attributes for each item type.
// Think of it like REI's product specs - each item type has specific fields.
//
// USAGE:
//   const { getSchemaForItemType, validateAttributes } = require('./attributeSchemas');
//   const schema = getSchemaForItemType('Sleeping Bag (Down)');
//   const { valid, errors, derived } = validateAttributes('Sleeping Bag (Down)', attrs);
//
// =============================================================================

// -----------------------------------------------------------------------------
// FIELD TYPE DEFINITIONS
// -----------------------------------------------------------------------------
// Each field has:
//   - type: 'number' | 'enum' | 'boolean' | 'string'
//   - required: boolean (is this field mandatory?)
//   - label: string (human-readable label for UI)
//   - options: array (for enum types - valid values)
//   - min/max: number (for number types - validation bounds)
//   - derived: boolean (can this be auto-calculated?)
//   - unit: string (display unit like 'L', '°F', 'cm')
// -----------------------------------------------------------------------------

const SCHEMAS = {
  // ===========================================================================
  // SLEEP SYSTEM
  // ===========================================================================

  "Sleeping Bag": {
    fields: {
      insulationType: {
        type: "enum",
        required: true,
        label: "Insulation Type",
        options: ["Down", "Synthetic"],
      },
      tempRatingC: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        unit: "°C",
        min: -51,
        max: 16,
      },
      tempRatingF: {
        type: "number",
        required: false,
        label: "Temperature Rating",
        unit: "°F",
        derived: true,
        min: -60,
        max: 60,
      },
      // Down-specific fields (optional, only used when insulationType = "Down")
      fillPower: {
        type: "enum",
        required: false,
        label: "Fill Power",
        options: [550, 600, 650, 700, 750, 800, 850, 900, 950, 1000],
      },
      fillWeightG: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "g",
        min: 0,
        max: 2268,
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "oz",
        derived: true,
        min: 0,
        max: 80,
      },
      waterResistantDown: {
        type: "boolean",
        required: false,
        label: "Water-Resistant Down",
      },
      rdsDown: {
        type: "boolean",
        required: false,
        label: "RDS Certified Down",
      },
      // Synthetic-specific field (optional, only used when insulationType = "Synthetic")
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
        // e.g., "Climashield Apex", "PrimaLoft Gold", "Thermic Micro"
      },
      // Shared fields
      shape: {
        type: "enum",
        required: true,
        label: "Shape",
        options: ["Mummy", "Semi-Rectangular", "Rectangular", "Spoon"],
      },
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      lengthSize: {
        type: "enum",
        required: false,
        label: "Length/Size",
        options: ["Short", "Regular", "Long", "Extra Long"],
      },
      zipperSide: {
        type: "enum",
        required: false,
        label: "Zipper Side",
        options: ["Left", "Right", "Both", "None"],
      },
      hoodType: {
        type: "enum",
        required: false,
        label: "Hood Type",
        options: ["Insulated Hood", "Draft Collar Only", "Hoodless"],
      },
    },
    derive: (attrs) => {
      // Auto-calculate Fahrenheit from Celsius
      if (attrs.tempRatingC != null && attrs.tempRatingF == null) {
        attrs.tempRatingF = Math.round(attrs.tempRatingC * (9 / 5) + 32);
      }
      // Auto-calculate ounces from grams
      if (attrs.fillWeightG != null && attrs.fillWeightOz == null) {
        attrs.fillWeightOz =
          Math.round((attrs.fillWeightG / 28.3495) * 10) / 10;
      }
      return attrs;
    },
  },

  Quilt: {
    fields: {
      insulationType: {
        type: "enum",
        required: true,
        label: "Insulation Type",
        options: ["Down", "Synthetic"],
      },
      tempRatingC: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        unit: "°C",
        min: -29,
        max: 16,
      },
      tempRatingF: {
        type: "number",
        required: false,
        label: "Temperature Rating",
        unit: "°F",
        derived: true,
      },
      // Down-specific fields (optional, only used when insulationType = "Down")
      fillPower: {
        type: "enum",
        required: false,
        label: "Fill Power",
        options: [750, 800, 850, 900, 950, 1000],
      },
      fillWeightG: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "g",
        min: 0,
        max: 1134,
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "oz",
        derived: true,
        min: 0,
        max: 40,
      },
      waterResistantDown: {
        type: "boolean",
        required: false,
        label: "Water-Resistant Down",
      },
      rdsDown: {
        type: "boolean",
        required: false,
        label: "RDS Certified Down",
      },
      // Synthetic-specific field
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
        // e.g., "Climashield Apex", "PrimaLoft Gold"
      },
      // Shared fields
      widthSize: {
        type: "enum",
        required: false,
        label: "Width/Size",
        options: ["Slim", "Regular", "Wide", "Extra Wide"],
      },
      lengthSize: {
        type: "enum",
        required: false,
        label: "Length/Size",
        options: ["Short", "Regular", "Long", "Extra Long"],
      },
      attachmentSystem: {
        type: "enum",
        required: false,
        label: "Attachment System",
        options: [
          "Pad Straps",
          "Snap/Clip",
          "Drawcord",
          "Sewn Footbox",
          "Open Footbox",
        ],
      },
      footboxType: {
        type: "enum",
        required: false,
        label: "Footbox Type",
        options: ["Sewn Closed", "Snap Open", "Drawcord", "Zippered"],
      },
    },
    derive: (attrs) => {
      if (attrs.tempRatingC != null && attrs.tempRatingF == null) {
        attrs.tempRatingF = Math.round(attrs.tempRatingC * (9 / 5) + 32);
      }
      if (attrs.fillWeightG != null && attrs.fillWeightOz == null) {
        attrs.fillWeightOz =
          Math.round((attrs.fillWeightG / 28.3495) * 10) / 10;
      }
      return attrs;
    },
  },

  "Inflatable Sleeping Pad": {
    fields: {
      rValue: {
        type: "number",
        required: true,
        label: "R-Value",
        min: 0,
        max: 10,
      },
      thicknessCm: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "cm",
        min: 1.3,
        max: 15.2,
      },
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "in",
        derived: true,
        min: 0.5,
        max: 6,
      },
      lengthSize: {
        type: "enum",
        required: false,
        label: "Size",
        options: ["Short", "Regular", "Long", "Extra Long"],
      },
      widthSize: {
        type: "enum",
        required: false,
        label: "Width",
        options: ["Narrow", "Regular", "Wide", "Extra Wide"],
      },
      shape: {
        type: "enum",
        required: false,
        label: "Shape",
        options: ["Rectangular", "Mummy", "Semi-Rectangular"],
      },
      inflationMethod: {
        type: "enum",
        required: false,
        label: "Inflation Method",
        options: ["Blow Valve", "Pump Sack", "Built-in Pump", "Self-Inflating"],
      },
      seasonRating: {
        type: "enum",
        required: false,
        label: "Season Rating",
        options: ["3-Season", "4-Season", "Summer Only"],
      },
    },
    derive: (attrs) => {
      // Convert cm to inches
      if (attrs.thicknessCm != null && attrs.thicknessIn == null) {
        attrs.thicknessIn = Math.round((attrs.thicknessCm / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  "Foam Sleeping Pad": {
    fields: {
      rValue: {
        type: "number",
        required: true,
        label: "R-Value",
        min: 0,
        max: 6,
      },
      thicknessCm: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "cm",
        min: 0.6,
        max: 5.1,
      },
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "in",
        derived: true,
        min: 0.25,
        max: 2,
      },
      lengthSize: {
        type: "enum",
        required: false,
        label: "Size",
        options: ["Short", "Regular", "Long"],
      },
      padType: {
        type: "enum",
        required: false,
        label: "Pad Type",
        options: ["Closed-Cell Foam", "Accordion Fold", "Roll", "Egg Crate"],
      },
    },
    derive: (attrs) => {
      if (attrs.thicknessCm != null && attrs.thicknessIn == null) {
        attrs.thicknessIn = Math.round((attrs.thicknessCm / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  Pillow: {
    fields: {
      bestUse: {
        type: "enum",
        required: false,
        label: "Best Use",
        options: ["Backpacking", "Car Camping", "Travel"],
      },
      pillowType: {
        type: "enum",
        required: true,
        label: "Pillow Type",
        options: ["Traditional Pillow", "Compressible", "Stuff Sack"],
      },
      inflatable: {
        type: "boolean",
        required: false,
        label: "Inflatable",
      },
      pillowFill: {
        type: "enum",
        required: false,
        label: "Pillow Fill",
        options: ["Air", "Down", "Synthetic", "Foam", "Compressible"],
      },
      stuffSackIncluded: {
        type: "boolean",
        required: false,
        label: "Stuff Sack Included",
      },
      material: {
        type: "string",
        required: false,
        label: "Material",
        // e.g., "20-denier laminated polyester"
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // BACKPACKS
  // ===========================================================================

  Backpack: {
    fields: {
      volumeLiters: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "L",
        min: 20,
        max: 80,
      },
      loadCapacityKg: {
        type: "number",
        required: false,
        label: "Load Capacity",
        unit: "kg",
        min: 5,
        max: 35,
        step: 0.1,
      },
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      frameType: {
        type: "enum",
        required: false,
        label: "Frame Type",
        options: [
          "Frameless",
          "Internal Frame",
          "Removable Frame",
          "Stays Only",
        ],
      },
      backPanelType: {
        type: "enum",
        required: false,
        label: "Back Panel",
        options: ["Foam", "Mesh", "Framesheet", "Pad Sleeve"],
      },
      hipBeltType: {
        type: "enum",
        required: false,
        label: "Hip Belt",
        options: ["Padded", "Webbing Only", "None"],
      },
      hipBeltRemovable: {
        type: "boolean",
        required: false,
        label: "Removable Hip Belt",
      },
      waterResistance: {
        type: "enum",
        required: false,
        label: "Water Resistance",
        options: ["None", "DWR Coated", "Water Resistant", "Waterproof"],
      },
      mainFabric: {
        type: "string",
        required: false,
        label: "Main Fabric",
        // e.g., "DCF", "X-Pac VX21", "Robic Nylon", "Dyneema"
      },
      torsoFitRange: {
        type: "string",
        required: false,
        label: "Torso Fit Range",
        // e.g., "15-19 in", "S/M/L"
      },
      hydrationCompatible: {
        type: "boolean",
        required: false,
        label: "Hydration Compatible",
      },
      rainCoverIncluded: {
        type: "boolean",
        required: false,
        label: "Rain Cover Included",
      },
    },
    derive: (attrs) => attrs,
  },

  Daypack: {
    fields: {
      volumeLiters: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "L",
        min: 10,
        max: 40,
      },
      loadCapacityKg: {
        type: "number",
        required: false,
        label: "Load Capacity",
        unit: "kg",
        min: 5,
        max: 25,
        step: 0.1,
      },
      gender: {
        type: "enum",
        required: false,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      frameType: {
        type: "enum",
        required: false,
        label: "Frame Type",
        options: ["Frameless", "Internal Frame", "Foam Back"],
      },
      hipBeltType: {
        type: "enum",
        required: false,
        label: "Hip Belt",
        options: ["Padded", "Webbing Only", "None"],
      },
      hipBeltRemovable: {
        type: "boolean",
        required: false,
        label: "Removable Hip Belt",
      },
      waterResistance: {
        type: "enum",
        required: false,
        label: "Water Resistance",
        options: ["None", "DWR Coated", "Water Resistant", "Waterproof"],
      },
      laptopSleeveSize: {
        type: "number",
        required: false,
        label: "Laptop Sleeve",
        unit: "in",
        min: 0,
        max: 17,
      },
      hydrationCompatible: {
        type: "boolean",
        required: false,
        label: "Hydration Compatible",
      },
      rainCoverIncluded: {
        type: "boolean",
        required: false,
        label: "Rain Cover Included",
      },
    },
    derive: (attrs) => attrs,
  },

  "Hip Pack": {
    fields: {
      volumeLiters: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "L",
        min: 1,
        max: 15,
        step: 0.5,
      },
      waterResistant: {
        type: "boolean",
        required: false,
        label: "Water Resistant",
      },
      keyHook: {
        type: "boolean",
        required: false,
        label: "Key Hook",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // COOKING / KITCHEN
  // ===========================================================================

  "Backpacking Pot": {
    fields: {
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Titanium", "Aluminum", "Stainless Steel"],
      },
      volumeMl: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "ml",
        min: 200,
        max: 3000,
      },
      volumeOz: {
        type: "number",
        required: false,
        label: "Volume",
        unit: "fl oz",
        derived: true,
      },
      diameterCm: {
        type: "number",
        required: false,
        label: "Diameter",
        unit: "cm",
        min: 5,
        max: 20,
      },
      diameterIn: {
        type: "number",
        required: false,
        label: "Diameter",
        unit: "in",
        derived: true,
        min: 2,
        max: 8,
      },
      heightCm: {
        type: "number",
        required: false,
        label: "Height",
        unit: "cm",
        min: 3,
        max: 20,
      },
      heightIn: {
        type: "number",
        required: false,
        label: "Height",
        unit: "in",
        derived: true,
        min: 1,
        max: 8,
      },
      // Aluminum-specific (optional)
      coating: {
        type: "enum",
        required: false,
        label: "Coating",
        options: ["Hard Anodized", "Non-Stick", "Ceramic", "Uncoated"],
      },
      lidType: {
        type: "enum",
        required: false,
        label: "Lid Type",
        options: ["Solid Lid", "Strainer Lid", "Fry Pan Lid", "No Lid"],
      },
      handles: {
        type: "enum",
        required: false,
        label: "Handles",
        options: [
          "Bail Handle",
          "Folding Handles",
          "Pot Gripper Required",
          "Silicone Grip",
        ],
      },
      graduations: {
        type: "boolean",
        required: false,
        label: "Measurement Graduations",
      },
      pourSpout: {
        type: "boolean",
        required: false,
        label: "Pour Spout",
      },
    },
    derive: (attrs) => {
      // Convert ml to fl oz
      if (attrs.volumeMl != null && attrs.volumeOz == null) {
        attrs.volumeOz = Math.round((attrs.volumeMl / 29.574) * 10) / 10;
      }
      if (attrs.diameterCm != null && attrs.diameterIn == null) {
        attrs.diameterIn =
          Math.round((attrs.diameterCm / 2.54) * 10) / 10;
      }
      if (attrs.heightCm != null && attrs.heightIn == null) {
        attrs.heightIn = Math.round((attrs.heightCm / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  "Backpacking Stove (Canister)": {
    fields: {
      boilTime: {
        type: "number",
        required: false,
        label: "Boil Time (1L)",
        unit: "min",
        min: 1,
        max: 15,
      },
      burnTime: {
        type: "number",
        required: false,
        label: "Burn Time (per 100g)",
        unit: "min",
        min: 10,
        max: 120,
      },
      outputBtu: {
        type: "number",
        required: false,
        label: "Output",
        unit: "BTU",
        min: 5000,
        max: 20000,
      },
      igniterBuiltIn: {
        type: "boolean",
        required: false,
        label: "Built-in Igniter",
      },
      potSupport: {
        type: "enum",
        required: false,
        label: "Pot Support",
        options: ["Integrated", "Folding Arms", "Separate Stand"],
      },
      windscreen: {
        type: "enum",
        required: false,
        label: "Windscreen",
        options: ["Integrated", "Included Separate", "Not Included"],
      },
      regulatorValve: {
        type: "boolean",
        required: false,
        label: "Pressure Regulator",
      },
    },
    derive: (attrs) => attrs,
  },

  "Coffee Mug": {
    fields: {
      volumeMl: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "ml",
        min: 100,
        max: 600,
      },
      volumeOz: {
        type: "number",
        required: false,
        label: "Volume",
        unit: "fl oz",
        derived: true,
      },
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Titanium", "Stainless Steel", "Aluminum", "Plastic", "Silicone (Collapsible)", "Enamel"],
      },
    },
    derive: (attrs) => {
      if (attrs.volumeMl != null && attrs.volumeOz == null) {
        attrs.volumeOz = Math.round((attrs.volumeMl / 29.574) * 10) / 10;
      }
      return attrs;
    },
  },

  // ===========================================================================
  // TREKKING POLES
  // ===========================================================================

  "Trekking Poles": {
    fields: {
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Carbon Fiber", "Aluminum", "Hybrid"],
      },
      soldAs: {
        type: "enum",
        required: true,
        label: "Sold As",
        options: ["Single", "Pair"],
      },
      adjustmentType: {
        type: "enum",
        required: false,
        label: "Adjustment Type",
        options: [
          "Fixed Length",
          "Folding",
          "Telescoping",
          "Folding + Telescoping",
        ],
      },
      lockingMechanism: {
        type: "enum",
        required: false,
        label: "Locking Mechanism",
        options: ["Lever Lock", "Twist Lock", "Push Button", "None (Fixed)"],
      },
      minLengthCm: {
        type: "number",
        required: false,
        label: "Min Length",
        unit: "cm",
        min: 30,
        max: 100,
      },
      maxLengthCm: {
        type: "number",
        required: false,
        label: "Max Length",
        unit: "cm",
        min: 100,
        max: 150,
      },
      collapsedLengthCm: {
        type: "number",
        required: false,
        label: "Collapsed Length",
        unit: "cm",
        min: 30,
        max: 70,
      },
      sections: {
        type: "enum",
        required: false,
        label: "Sections",
        options: [2, 3, 4, 5],
      },
      gripMaterial: {
        type: "enum",
        required: false,
        label: "Grip Material",
        options: ["Cork", "EVA Foam", "Rubber", "Dual-Density"],
      },
      strapType: {
        type: "enum",
        required: false,
        label: "Strap Type",
        options: ["Padded", "Webbing", "None"],
      },
      basketsIncluded: {
        type: "boolean",
        required: false,
        label: "Baskets Included",
      },
      tipType: {
        type: "enum",
        required: false,
        label: "Tip Type",
        options: ["Carbide", "Rubber", "Interchangeable"],
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // SHELTER
  // ===========================================================================

  "Backpacking Tent": {
    fields: {
      capacity: {
        type: "enum",
        required: true,
        label: "Capacity",
        options: ["1-Person", "2-Person", "3-Person", "4-Person"],
      },
      seasonRating: {
        type: "enum",
        required: true,
        label: "Season Rating",
        options: ["3-Season", "3+ Season", "4-Season"],
      },
      tentType: {
        type: "enum",
        required: false,
        label: "Tent Type",
        options: [
          "Freestanding",
          "Semi-Freestanding",
          "Non-Freestanding",
          "Trekking Pole Tent",
        ],
      },
      wallType: {
        type: "enum",
        required: false,
        label: "Wall Type",
        options: ["Double Wall", "Single Wall", "Hybrid"],
      },
      floorAreaSqM: {
        type: "number",
        required: false,
        label: "Floor Area",
        unit: "sq m",
        min: 1.4,
        max: 9.3,
      },
      floorAreaSqFt: {
        type: "number",
        required: false,
        label: "Floor Area",
        unit: "sq ft",
        derived: true,
      },
      vestibuleAreaSqM: {
        type: "number",
        required: false,
        label: "Vestibule Area",
        unit: "sq m",
        min: 0,
        max: 2.8,
      },
      vestibuleAreaSqFt: {
        type: "number",
        required: false,
        label: "Vestibule Area",
        unit: "sq ft",
        derived: true,
      },
      peakHeightCm: {
        type: "number",
        required: false,
        label: "Peak Height",
        unit: "cm",
        min: 76,
        max: 152,
      },
      peakHeightIn: {
        type: "number",
        required: false,
        label: "Peak Height",
        unit: "in",
        derived: true,
        min: 30,
        max: 60,
      },
      doors: {
        type: "enum",
        required: false,
        label: "Number of Doors",
        options: [1, 2],
      },
      vestibules: {
        type: "enum",
        required: false,
        label: "Number of Vestibules",
        options: [0, 1, 2],
      },
      poleMaterial: {
        type: "enum",
        required: false,
        label: "Pole Material",
        options: [
          "Aluminum",
          "Carbon Fiber",
          "DAC Featherlite",
          "Easton",
          "Trekking Poles",
        ],
      },
      flyMaterial: {
        type: "string",
        required: false,
        label: "Fly Material",
        // e.g., "20D Silnylon", "DCF", "15D Ripstop"
      },
      floorMaterial: {
        type: "string",
        required: false,
        label: "Floor Material",
      },
      footprintIncluded: {
        type: "boolean",
        required: false,
        label: "Footprint Included",
      },
    },
    derive: (attrs) => {
      if (attrs.floorAreaSqM != null && attrs.floorAreaSqFt == null) {
        attrs.floorAreaSqFt =
          Math.round((attrs.floorAreaSqM / 0.0929) * 10) / 10;
      }
      if (attrs.vestibuleAreaSqM != null && attrs.vestibuleAreaSqFt == null) {
        attrs.vestibuleAreaSqFt =
          Math.round((attrs.vestibuleAreaSqM / 0.0929) * 10) / 10;
      }
      if (attrs.peakHeightCm != null && attrs.peakHeightIn == null) {
        attrs.peakHeightIn =
          Math.round((attrs.peakHeightCm / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  "Tarp Shelter": {
    fields: {
      shape: {
        type: "enum",
        required: false,
        label: "Shape",
        options: ["Rectangular", "Catenary Cut", "Hex", "A-Frame", "Pyramid"],
      },
      coverageAreaSqM: {
        type: "number",
        required: false,
        label: "Coverage Area",
        unit: "sq m",
        min: 1.9,
        max: 13.9,
      },
      coverageAreaSqFt: {
        type: "number",
        required: false,
        label: "Coverage Area",
        unit: "sq ft",
        derived: true,
      },
      lengthCm: {
        type: "number",
        required: false,
        label: "Length",
        unit: "cm",
      },
      lengthIn: {
        type: "number",
        required: false,
        label: "Length",
        unit: "in",
        derived: true,
      },
      widthCm: {
        type: "number",
        required: false,
        label: "Width",
        unit: "cm",
      },
      widthIn: {
        type: "number",
        required: false,
        label: "Width",
        unit: "in",
        derived: true,
      },
      material: {
        type: "string",
        required: false,
        label: "Material",
        // e.g., "DCF 0.5oz", "Silpoly", "Silnylon"
      },
      guyoutPoints: {
        type: "number",
        required: false,
        label: "Guyout Points",
        min: 4,
        max: 20,
      },
      tieoutsIncluded: {
        type: "boolean",
        required: false,
        label: "Guylines Included",
      },
      stakesIncluded: {
        type: "boolean",
        required: false,
        label: "Stakes Included",
      },
    },
    derive: (attrs) => {
      if (attrs.coverageAreaSqM != null && attrs.coverageAreaSqFt == null) {
        attrs.coverageAreaSqFt =
          Math.round((attrs.coverageAreaSqM / 0.0929) * 10) / 10;
      }
      if (attrs.lengthCm != null && attrs.lengthIn == null) {
        attrs.lengthIn = Math.round((attrs.lengthCm / 2.54) * 10) / 10;
      }
      if (attrs.widthCm != null && attrs.widthIn == null) {
        attrs.widthIn = Math.round((attrs.widthCm / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  // ===========================================================================
  // HEADLAMPS / LIGHTING
  // ===========================================================================

  Headlamp: {
    fields: {
      maxLumens: {
        type: "number",
        required: true,
        label: "Max Output",
        unit: "lumens",
        min: 10,
        max: 2000,
      },
      maxBeamDistance: {
        type: "number",
        required: false,
        label: "Max Beam Distance",
        unit: "m",
        min: 10,
        max: 200,
      },
      batteryType: {
        type: "enum",
        required: true,
        label: "Battery Type",
        options: [
          "Rechargeable (USB-C)",
          "Rechargeable (Micro USB)",
          "Rechargeable (Proprietary)",
          "AAA",
          "AA",
          "CR123A",
          "Hybrid",
        ],
      },
      batteryCapacityMah: {
        type: "number",
        required: false,
        label: "Battery Capacity",
        unit: "mAh",
        min: 500,
        max: 5000,
      },
      burnTimeHigh: {
        type: "number",
        required: false,
        label: "Burn Time (High)",
        unit: "hrs",
        min: 0.5,
        max: 20,
      },
      burnTimeLow: {
        type: "number",
        required: false,
        label: "Burn Time (Low)",
        unit: "hrs",
        min: 5,
        max: 500,
      },
      beamType: {
        type: "enum",
        required: false,
        label: "Beam Type",
        options: ["Spot", "Flood", "Spot + Flood", "Adjustable"],
      },
      redLightMode: {
        type: "boolean",
        required: false,
        label: "Red Light Mode",
      },
      lockoutMode: {
        type: "boolean",
        required: false,
        label: "Lockout Mode",
      },
      ipRating: {
        type: "enum",
        required: false,
        label: "IP Rating",
        options: ["IPX4", "IPX5", "IPX6", "IPX7", "IPX8", "IP67", "IP68"],
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // WATER / HYDRATION
  // ===========================================================================

  "Water Filter": {
    fields: {
      filterType: {
        type: "enum",
        required: true,
        label: "Filter Type",
        options: [
          "Squeeze",
          "Pump",
          "Gravity",
          "Straw",
          "Bottle",
          "UV",
          "Chemical",
        ],
      },
      poreSize: {
        type: "number",
        required: false,
        label: "Pore Size",
        unit: "microns",
        min: 0.01,
        max: 1,
        step: 0.01,
      },
      flowRate: {
        type: "number",
        required: false,
        label: "Flow Rate",
        unit: "L/min",
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      filterLifeL: {
        type: "number",
        required: false,
        label: "Filter Life",
        unit: "L",
        min: 500,
        max: 500000,
      },
      removesViruses: {
        type: "boolean",
        required: false,
        label: "Removes Viruses",
      },
      removesBacteria: {
        type: "boolean",
        required: false,
        label: "Removes Bacteria",
      },
      removesProtozoa: {
        type: "boolean",
        required: false,
        label: "Removes Protozoa",
      },
      backflushable: {
        type: "boolean",
        required: false,
        label: "Backflushable",
      },
    },
    derive: (attrs) => attrs,
  },

  "Water Bottle": {
    fields: {
      capacityMl: {
        type: "number",
        required: true,
        label: "Capacity",
        unit: "ml",
        min: 250,
        max: 2000,
      },
      capacityOz: {
        type: "number",
        required: false,
        label: "Capacity",
        unit: "fl oz",
        derived: true,
      },
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: [
          "Plastic (BPA-Free)",
          "Stainless Steel",
          "Aluminum",
          "Glass",
          "Silicone (Collapsible)",
        ],
      },
      insulated: {
        type: "boolean",
        required: false,
        label: "Insulated/Vacuum",
      },
      mouthOpening: {
        type: "enum",
        required: false,
        label: "Mouth Opening",
        options: ["Wide Mouth", "Narrow Mouth", "Sport Cap", "Straw"],
      },
      leakProof: {
        type: "boolean",
        required: false,
        label: "Leak-Proof",
      },
      collapsible: {
        type: "boolean",
        required: false,
        label: "Collapsible/Compressible",
      },
      filterCompatible: {
        type: "boolean",
        required: false,
        label: "Filter Compatible",
      },
    },
    derive: (attrs) => {
      // Convert ml to fl oz
      if (attrs.capacityMl != null && attrs.capacityOz == null) {
        attrs.capacityOz = Math.round((attrs.capacityMl / 29.574) * 10) / 10;
      }
      return attrs;
    },
  },

  "Hydration Reservoir": {
    fields: {
      capacityL: {
        type: "enum",
        required: true,
        label: "Capacity",
        unit: "L",
        options: [1, 1.5, 2, 2.5, 3],
      },
      material: {
        type: "enum",
        required: false,
        label: "Material",
        options: ["TPU", "LDPE", "Polyurethane", "Silicone"],
      },
      bpaFree: {
        type: "boolean",
        required: false,
        label: "BPA-Free",
      },
      openingType: {
        type: "enum",
        required: false,
        label: "Opening Type",
        options: ["Slide-Top", "Wide-Mouth Screw", "QuickLink", "Roll-Top"],
      },
      biteValveType: {
        type: "enum",
        required: false,
        label: "Bite Valve Type",
        options: ["Standard", "High-Flow", "Lockable", "On/Off Switch"],
      },
      hoseLength: {
        type: "number",
        required: false,
        label: "Hose Length",
        unit: "cm",
        min: 75,
        max: 130,
      },
      hoseLengthIn: {
        type: "number",
        required: false,
        label: "Hose Length",
        unit: "in",
        derived: true,
        min: 30,
        max: 52,
      },
      insulatedHose: {
        type: "boolean",
        required: false,
        label: "Insulated Hose",
      },
      reversible: {
        type: "boolean",
        required: false,
        label: "Reversible for Cleaning",
      },
      quickDisconnect: {
        type: "boolean",
        required: false,
        label: "Quick Disconnect",
      },
    },
    derive: (attrs) => {
      if (attrs.hoseLength != null && attrs.hoseLengthIn == null) {
        attrs.hoseLengthIn =
          Math.round((attrs.hoseLength / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  // ===========================================================================
  // CLOTHING - OUTERWEAR
  // ===========================================================================

  "Rain Jacket": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      layerConstruction: {
        type: "enum",
        required: true,
        label: "Layer Construction",
        options: ["2-Layer", "2.5-Layer", "3-Layer"],
      },
      membrane: {
        type: "string",
        required: false,
        label: "Membrane Technology",
        // e.g., "GORE-TEX", "eVent", "HydroWall", "Proprietary"
      },
      waterproofRating: {
        type: "number",
        required: false,
        label: "Waterproof Rating",
        unit: "mm",
        min: 5000,
        max: 30000,
      },
      breathabilityRating: {
        type: "number",
        required: false,
        label: "Breathability (MVTR)",
        unit: "g/m²/24hr",
        min: 5000,
        max: 40000,
      },
      pitZips: {
        type: "boolean",
        required: false,
        label: "Pit Zips",
      },
      hoodType: {
        type: "enum",
        required: false,
        label: "Hood Type",
        options: [
          "Fixed Hood",
          "Adjustable Hood",
          "Helmet-Compatible",
          "Stowable Hood",
          "No Hood",
        ],
      },
      pockets: {
        type: "number",
        required: false,
        label: "Number of Pockets",
        min: 0,
        max: 6,
      },
      packable: {
        type: "boolean",
        required: false,
        label: "Packable/Stowable",
      },
      pfasFree: {
        type: "boolean",
        required: false,
        label: "PFAS-Free DWR",
      },
    },
    derive: (attrs) => attrs,
  },

  "Rain Pants": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      layerConstruction: {
        type: "enum",
        required: true,
        label: "Layer Construction",
        options: ["2-Layer", "2.5-Layer", "3-Layer"],
      },
      membrane: {
        type: "string",
        required: false,
        label: "Membrane Technology",
        // e.g., "GORE-TEX", "eVent", "HydroWall", "Proprietary"
      },
      waterproofRating: {
        type: "number",
        required: false,
        label: "Waterproof Rating",
        unit: "mm",
        min: 5000,
        max: 30000,
      },
      breathabilityRating: {
        type: "number",
        required: false,
        label: "Breathability (MVTR)",
        unit: "g/m²/24hr",
        min: 5000,
        max: 40000,
      },
      sideZips: {
        type: "enum",
        required: false,
        label: "Side Zippers",
        options: ["Full-Length", "Partial (Ankle)", "None"],
      },
      waistType: {
        type: "enum",
        required: false,
        label: "Waist Type",
        options: ["Elastic Waist", "Elastic with Drawcord", "Belt Loops", "Snap Waist"],
      },
      ankleAdjustment: {
        type: "boolean",
        required: false,
        label: "Ankle Drawcord/Adjustment",
      },
      pockets: {
        type: "number",
        required: false,
        label: "Number of Pockets",
        min: 0,
        max: 6,
      },
      packable: {
        type: "boolean",
        required: false,
        label: "Packable/Stowable",
      },
      pfasFree: {
        type: "boolean",
        required: false,
        label: "PFAS-Free DWR",
      },
    },
    derive: (attrs) => attrs,
  },

  "Insulated Jacket": {
    fields: {
      insulationType: {
        type: "enum",
        required: true,
        label: "Insulation Type",
        options: ["Down", "Synthetic"],
      },
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      // Down-specific fields (optional, only used when insulationType = "Down")
      fillPower: {
        type: "enum",
        required: false,
        label: "Fill Power",
        options: [550, 600, 650, 700, 750, 800, 850, 900, 950],
      },
      fillWeightG: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "g",
        min: 28,
        max: 340,
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "oz",
        derived: true,
        min: 1,
        max: 12,
      },
      waterResistantDown: {
        type: "boolean",
        required: false,
        label: "Hydrophobic/Water-Resistant Down",
      },
      rdsDown: {
        type: "boolean",
        required: false,
        label: "RDS Certified Down",
      },
      // Synthetic-specific fields
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
        // e.g., "PrimaLoft Gold", "Climashield Apex", "Coreloft"
      },
      insulationWeightGsm: {
        type: "number",
        required: false,
        label: "Insulation Weight",
        unit: "g/m²",
        min: 40,
        max: 200,
      },
      waterResistant: {
        type: "boolean",
        required: false,
        label: "Water-Resistant Insulation",
      },
      // Shared fields
      shellFabric: {
        type: "string",
        required: false,
        label: "Shell Fabric",
        // e.g., "20D Pertex Quantum", "15D Ripstop Nylon"
      },
      hoodType: {
        type: "enum",
        required: false,
        label: "Hood",
        options: [
          "Insulated Hood",
          "Helmet-Compatible Hood",
          "Stowable Hood",
          "No Hood",
        ],
      },
      pockets: {
        type: "number",
        required: false,
        label: "Number of Pockets",
        min: 0,
        max: 6,
      },
      packable: {
        type: "boolean",
        required: false,
        label: "Packable/Stowable",
      },
      temperatureRange: {
        type: "enum",
        required: false,
        label: "Temperature Range",
        options: ["Lightweight", "Midweight", "Heavyweight"],
      },
    },
    derive: (attrs) => {
      if (attrs.fillWeightG != null && attrs.fillWeightOz == null) {
        attrs.fillWeightOz =
          Math.round((attrs.fillWeightG / 28.3495) * 10) / 10;
      }
      return attrs;
    },
  },

  // ===========================================================================
  // CLOTHING - MID LAYERS
  // ===========================================================================

  "Fleece Jacket": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      fleeceType: {
        type: "enum",
        required: true,
        label: "Fleece Type",
        options: [
          "Classic Fleece",
          "Microfleece",
          "Grid Fleece",
          "Hardface Fleece",
          "High-Loft Fleece",
          "Sherpa Fleece",
          "Sweater Fleece",
        ],
      },
      fleeceWeight: {
        type: "enum",
        required: false,
        label: "Fleece Weight",
        options: [
          "100 (Lightweight)",
          "200 (Midweight)",
          "300 (Heavyweight)",
        ],
      },
      material: {
        type: "string",
        required: false,
        label: "Material",
        // e.g., "100% Recycled Polyester", "Polartec Power Grid"
      },
      closure: {
        type: "enum",
        required: false,
        label: "Closure",
        options: ["Full-Zip", "Half-Zip", "Quarter-Zip", "Pullover", "Snap-T/Snap"],
      },
      hoodType: {
        type: "enum",
        required: false,
        label: "Hood",
        options: ["Fixed Hood", "Adjustable Hood", "No Hood"],
      },
      pockets: {
        type: "number",
        required: false,
        label: "Number of Pockets",
        min: 0,
        max: 8,
      },
      windResistant: {
        type: "boolean",
        required: false,
        label: "Wind Resistant",
      },
      thumbHoles: {
        type: "boolean",
        required: false,
        label: "Thumb Holes",
      },
      flatSeams: {
        type: "boolean",
        required: false,
        label: "Flat-Seam Construction",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // CLOTHING - BASE LAYERS
  // ===========================================================================

  "Base Layer Top": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      weight: {
        type: "enum",
        required: true,
        label: "Weight Class",
        options: [
          "Ultralight",
          "Lightweight",
          "Midweight",
          "Heavyweight",
          "Expedition",
        ],
      },
      fabricType: {
        type: "enum",
        required: true,
        label: "Fabric Type",
        options: ["Merino Wool", "Synthetic", "Wool Blend", "Silk"],
      },
      fabricWeightGsm: {
        type: "number",
        required: false,
        label: "Fabric Weight",
        unit: "g/m²",
        min: 100,
        max: 400,
      },
      neckStyle: {
        type: "enum",
        required: false,
        label: "Neck Style",
        options: ["Crew Neck", "Quarter-Zip", "Half-Zip", "Full-Zip", "Hooded"],
      },
      sleevesLength: {
        type: "enum",
        required: false,
        label: "Sleeve Length",
        options: ["Sleeveless", "Short Sleeve", "3/4 Sleeve", "Long Sleeve"],
      },
      thumbHoles: {
        type: "boolean",
        required: false,
        label: "Thumb Holes",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // CLOTHING - ACCESSORIES
  // ===========================================================================

  "Gloves (Insulated)": {
    fields: {
      style: {
        type: "enum",
        required: true,
        label: "Style",
        options: ["Gloves (5-finger)", "Mittens", "Lobster Claw"],
      },
      insulationType: {
        type: "enum",
        required: true,
        label: "Insulation Type",
        options: ["Down", "Synthetic", "Fleece", "Wool", "Uninsulated"],
      },
      waterproof: {
        type: "boolean",
        required: false,
        label: "Waterproof",
      },
      waterproofMembrane: {
        type: "enum",
        required: false,
        label: "Waterproof Membrane",
        options: ["GORE-TEX", "Proprietary", "None"],
      },
      touchscreenCompatible: {
        type: "boolean",
        required: false,
        label: "Touchscreen Compatible",
      },
      gripPalm: {
        type: "boolean",
        required: false,
        label: "Reinforced Grip Palm",
      },
      temperatureRating: {
        type: "enum",
        required: false,
        label: "Temperature Rating",
        options: [
          "Warm Weather",
          "Cool Weather",
          "Cold Weather",
          "Extreme Cold",
        ],
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // FOOTWEAR
  // ===========================================================================

  "Hiking Boots": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      cutHeight: {
        type: "enum",
        required: true,
        label: "Cut Height",
        options: ["Low/Shoe", "Mid", "High"],
      },
      waterproof: {
        type: "boolean",
        required: true,
        label: "Waterproof",
      },
      waterproofMembrane: {
        type: "enum",
        required: false,
        label: "Waterproof Membrane",
        options: ["GORE-TEX", "eVent", "Proprietary", "None"],
      },
      upperMaterial: {
        type: "enum",
        required: false,
        label: "Upper Material",
        options: [
          "Full Grain Leather",
          "Nubuck Leather",
          "Split Leather",
          "Synthetic",
          "Mesh/Synthetic Mix",
        ],
      },
      soleMaterial: {
        type: "enum",
        required: false,
        label: "Sole Material",
        options: ["Vibram", "Continental", "Proprietary Rubber", "Other"],
      },
      ankleSupport: {
        type: "enum",
        required: false,
        label: "Ankle Support",
        options: ["High", "Medium", "Low", "None"],
      },
      midsoleType: {
        type: "enum",
        required: false,
        label: "Midsole Type",
        options: ["EVA", "PU (Polyurethane)", "Dual-Density", "TPU"],
      },
      shankType: {
        type: "enum",
        required: false,
        label: "Shank/Stability",
        options: ["Full Shank", "3/4 Shank", "Half Shank", "Plate", "None"],
      },
      weightCategory: {
        type: "enum",
        required: false,
        label: "Weight Category",
        options: ["Lightweight", "Midweight", "Heavyweight"],
      },
      useType: {
        type: "enum",
        required: false,
        label: "Intended Use",
        options: ["Day Hiking", "Backpacking", "Mountaineering", "Approach"],
      },
    },
    derive: (attrs) => attrs,
  },

  "Trail Running Shoes": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender",
        options: ["Mens", "Womens", "Unisex"],
      },
      bestUse: {
        type: "enum",
        required: false,
        label: "Best Use",
        options: ["Trail Running", "Road Running", "Hiking"],
      },
      shoeType: {
        type: "enum",
        required: false,
        label: "Trail-Running Shoe Type",
        options: ["Light-Trail", "Rugged-Trail"],
      },
      cushioning: {
        type: "enum",
        required: false,
        label: "Running Shoe Cushioning",
        options: [
          "Barefoot",
          "Minimal Cushion",
          "Moderate Cushion",
          "Maximum Cushion",
        ],
      },
      dropMm: {
        type: "number",
        required: false,
        label: "Heel-to-Toe Drop",
        unit: "mm",
        min: 0,
        max: 14,
      },
      heelStackHeightMm: {
        type: "number",
        required: false,
        label: "Heel Stack Height",
        unit: "mm",
        min: 10,
        max: 50,
      },
      forefootStackHeightMm: {
        type: "number",
        required: false,
        label: "Forefoot Stack Height",
        unit: "mm",
        min: 10,
        max: 45,
      },
      footwearHeight: {
        type: "enum",
        required: false,
        label: "Footwear Height",
        options: ["Low", "Ankle"],
      },
      footwearClosure: {
        type: "enum",
        required: false,
        label: "Footwear Closure",
        options: ["Lace-up", "Single-pull Lace", "BOA", "Slip-on"],
      },
      waterproof: {
        type: "boolean",
        required: false,
        label: "Waterproof",
      },
      waterproofMembrane: {
        type: "enum",
        required: false,
        label: "Waterproof Membrane",
        options: ["GORE-TEX", "eVent", "Proprietary", "None"],
      },
      upper: {
        type: "string",
        required: false,
        label: "Upper",
      },
      lining: {
        type: "string",
        required: false,
        label: "Lining",
      },
      midsole: {
        type: "string",
        required: false,
        label: "Midsole",
      },
      outsole: {
        type: "string",
        required: false,
        label: "Outsole",
      },
      rockPlate: {
        type: "boolean",
        required: false,
        label: "Rock Plate",
      },
      vegan: {
        type: "boolean",
        required: false,
        label: "Vegan",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // CLOTHING - BASE LAYERS (CONTINUED)
  // ===========================================================================

  "Base Layer Bottom": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      weight: {
        type: "enum",
        required: true,
        label: "Weight Class",
        options: [
          "Ultralight",
          "Lightweight",
          "Midweight",
          "Heavyweight",
          "Expedition",
        ],
      },
      fabricType: {
        type: "enum",
        required: true,
        label: "Fabric Type",
        options: ["Merino Wool", "Synthetic", "Wool Blend", "Silk"],
      },
      fabricWeightGsm: {
        type: "number",
        required: false,
        label: "Fabric Weight",
        unit: "g/m²",
        min: 100,
        max: 400,
      },
      fitStyle: {
        type: "enum",
        required: false,
        label: "Fit Style",
        options: ["Fitted", "Regular", "Relaxed"],
      },
      inseamLength: {
        type: "enum",
        required: false,
        label: "Inseam Length",
        options: ["Short", "Regular", "Long", "Full-Length", "3/4 Length"],
      },
      flyType: {
        type: "enum",
        required: false,
        label: "Fly Type",
        options: ["Button Fly", "No Fly", "N/A"],
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // CLOTHING - SOCKS
  // ===========================================================================

  "Hiking Socks": {
    fields: {
      sockType: {
        type: "enum",
        required: true,
        label: "Sock Type",
        options: [
          "Liner",
          "Hiking",
          "Trekking",
          "Mountaineering",
          "Trail Running",
        ],
      },
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Merino Wool", "Synthetic", "Wool Blend", "Cotton Blend"],
      },
      cushioning: {
        type: "enum",
        required: false,
        label: "Cushioning Level",
        options: ["No Cushion (Liner)", "Light", "Medium", "Heavy"],
      },
      height: {
        type: "enum",
        required: false,
        label: "Height",
        options: ["No-Show", "Ankle", "Quarter", "Crew", "Over-Calf", "Knee"],
      },
      seamlessToe: {
        type: "boolean",
        required: false,
        label: "Seamless Toe",
      },
      archSupport: {
        type: "boolean",
        required: false,
        label: "Arch Support",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // CLOTHING - HEADWEAR
  // ===========================================================================

  "Hat/Headwear": {
    fields: {
      hatType: {
        type: "enum",
        required: true,
        label: "Hat Type",
        options: [
          "Beanie/Winter Hat",
          "Sun Hat",
          "Baseball Cap",
          "Visor",
          "Buff/Neck Gaiter",
          "Bucket Hat",
          "Brimmed Hat",
        ],
      },
      material: {
        type: "enum",
        required: false,
        label: "Material",
        options: [
          "Merino Wool",
          "Synthetic",
          "Wool Blend",
          "Cotton",
          "Nylon",
          "Fleece",
        ],
      },
      waterproof: {
        type: "boolean",
        required: false,
        label: "Waterproof/Water-Resistant",
      },
      uvRating: {
        type: "enum",
        required: false,
        label: "UV Protection Rating",
        options: ["UPF 15-24", "UPF 25-39", "UPF 40-50", "UPF 50+"],
      },
      brimSize: {
        type: "enum",
        required: false,
        label: "Brim Size",
        options: ["No Brim", "Small (2-3in)", "Medium (3-4in)", "Large (4in+)"],
      },
      packable: {
        type: "boolean",
        required: false,
        label: "Packable/Crushable",
      },
      insulated: {
        type: "boolean",
        required: false,
        label: "Insulated",
      },
      windproof: {
        type: "boolean",
        required: false,
        label: "Windproof",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // CLOTHING - SHORTS
  // ===========================================================================

  "Hiking Shorts": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      inseamCm: {
        type: "number",
        required: false,
        label: "Inseam",
        unit: "cm",
        min: 8,
        max: 30,
      },
      inseamIn: {
        type: "number",
        required: false,
        label: "Inseam",
        unit: "in",
        derived: true,
        min: 3,
        max: 12,
      },
      material: {
        type: "enum",
        required: false,
        label: "Material",
        options: ["Nylon", "Polyester", "Cotton Blend", "Spandex Mix"],
      },
      pockets: {
        type: "number",
        required: false,
        label: "Number of Pockets",
        min: 0,
        max: 8,
      },
      waterResistant: {
        type: "boolean",
        required: false,
        label: "Water-Resistant/DWR",
      },
      stretchFabric: {
        type: "boolean",
        required: false,
        label: "Stretch Fabric",
      },
      beltLoops: {
        type: "boolean",
        required: false,
        label: "Belt Loops",
      },
      builtInLiner: {
        type: "boolean",
        required: false,
        label: "Built-in Liner",
      },
      uvProtection: {
        type: "enum",
        required: false,
        label: "UV Protection",
        options: ["UPF 15-24", "UPF 25-39", "UPF 40-50", "UPF 50+", "None"],
      },
    },
    derive: (attrs) => {
      if (attrs.inseamCm != null && attrs.inseamIn == null) {
        attrs.inseamIn = Math.round((attrs.inseamCm / 2.54) * 10) / 10;
      }
      return attrs;
    },
  },

  // ===========================================================================
  // CLOTHING - SHIRTS
  // ===========================================================================

  "Hiking Shirt": {
    fields: {
      gender: {
        type: "enum",
        required: true,
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      sleevesLength: {
        type: "enum",
        required: true,
        label: "Sleeve Length",
        options: ["Sleeveless", "Short Sleeve", "Long Sleeve", "Convertible"],
      },
      material: {
        type: "enum",
        required: false,
        label: "Material",
        options: [
          "Merino Wool",
          "Synthetic",
          "Cotton",
          "Wool Blend",
          "Nylon",
          "Polyester",
        ],
      },
      uvProtection: {
        type: "enum",
        required: false,
        label: "UV Protection",
        options: ["UPF 15-24", "UPF 25-39", "UPF 40-50", "UPF 50+", "None"],
      },
      quickDry: {
        type: "boolean",
        required: false,
        label: "Quick-Dry",
      },
      pockets: {
        type: "number",
        required: false,
        label: "Number of Pockets",
        min: 0,
        max: 6,
      },
      vented: {
        type: "boolean",
        required: false,
        label: "Vented/Mesh Panels",
      },
      moistureWicking: {
        type: "boolean",
        required: false,
        label: "Moisture-Wicking",
      },
      buttonStyle: {
        type: "enum",
        required: false,
        label: "Button/Closure Style",
        options: ["Button-Up", "Snap Closure", "Pullover", "Zip-Up"],
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // ACCESSORIES - EYEWEAR
  // ===========================================================================

  Sunglasses: {
    fields: {
      uvProtection: {
        type: "enum",
        required: true,
        label: "UV Protection",
        options: ["UV400 (100%)", "UV380-400", "Basic UV"],
      },
      polarized: {
        type: "boolean",
        required: false,
        label: "Polarized Lenses",
      },
      lensCategory: {
        type: "enum",
        required: false,
        label: "Lens Category",
        options: [
          "Category 0 (0-19% absorption)",
          "Category 1 (20-56% absorption)",
          "Category 2 (57-81% absorption)",
          "Category 3 (82-92% absorption)",
          "Category 4 (93%+ absorption)",
        ],
      },
      frameMaterial: {
        type: "enum",
        required: false,
        label: "Frame Material",
        options: [
          "Plastic/Acetate",
          "Metal",
          "Titanium",
          "TR90 (Nylon)",
          "Aluminum",
        ],
      },
      lensMaterial: {
        type: "enum",
        required: false,
        label: "Lens Material",
        options: ["Polycarbonate", "CR-39 (Plastic)", "Glass", "Trivex"],
      },
      interchangeableLenses: {
        type: "boolean",
        required: false,
        label: "Interchangeable Lenses",
      },
      nosePadsAdjustable: {
        type: "boolean",
        required: false,
        label: "Adjustable Nose Pads",
      },
      mirroredLens: {
        type: "boolean",
        required: false,
        label: "Mirrored/Reflective Lens",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // SLEEP SYSTEM - LINERS
  // ===========================================================================

  "Sleeping Bag Liner": {
    fields: {
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: [
          "Silk",
          "Cotton",
          "Fleece",
          "Synthetic (Polyester)",
          "Merino Wool",
          "Microfiber",
        ],
      },
      shape: {
        type: "enum",
        required: false,
        label: "Shape",
        options: ["Mummy", "Rectangular", "Semi-Rectangular"],
      },
      tempBoostC: {
        type: "number",
        required: false,
        label: "Temperature Boost",
        unit: "°C",
        min: 3,
        max: 14,
      },
      tempBoostF: {
        type: "number",
        required: false,
        label: "Temperature Boost",
        unit: "°F",
        derived: true,
        min: 5,
        max: 25,
      },
      lengthSize: {
        type: "enum",
        required: false,
        label: "Length/Size",
        options: ["Regular", "Long", "XL"],
      },
      packable: {
        type: "boolean",
        required: false,
        label: "Packable/Compact",
      },
      zippered: {
        type: "boolean",
        required: false,
        label: "Zippered (Not Sewn Shut)",
      },
    },
    derive: (attrs) => {
      if (attrs.tempBoostC != null && attrs.tempBoostF == null) {
        attrs.tempBoostF = Math.round(attrs.tempBoostC * (9 / 5));
      }
      return attrs;
    },
  },

  // ===========================================================================
  // ELECTRONICS - POWER
  // ===========================================================================

  "Power Bank": {
    fields: {
      capacityMah: {
        type: "number",
        required: true,
        label: "Capacity",
        unit: "mAh",
        min: 1000,
        max: 50000,
      },
      outputPortsUsbA: {
        type: "number",
        required: false,
        label: "USB-A Output Ports",
        min: 0,
        max: 4,
      },
      outputPortsUsbC: {
        type: "number",
        required: false,
        label: "USB-C Output Ports",
        min: 0,
        max: 4,
      },
      inputPorts: {
        type: "enum",
        required: false,
        label: "Input Port Type",
        options: ["Micro-USB", "USB-C", "Lightning", "Multiple"],
      },
      fastCharging: {
        type: "enum",
        required: false,
        label: "Fast Charging Support",
        options: [
          "USB Power Delivery (PD)",
          "Qualcomm Quick Charge",
          "Both PD & QC",
          "None",
        ],
      },
      solarCapable: {
        type: "boolean",
        required: false,
        label: "Solar Charging Capable",
      },
      wirelessCharging: {
        type: "boolean",
        required: false,
        label: "Wireless Charging (Qi)",
      },
      waterproofRating: {
        type: "enum",
        required: false,
        label: "Waterproof Rating",
        options: ["IPX4", "IPX5", "IPX6", "IPX7", "IP67", "None"],
      },
      passthroughCharging: {
        type: "boolean",
        required: false,
        label: "Pass-Through Charging",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // ACCESSORIES - TOWELS
  // ===========================================================================

  "Travel Towel": {
    fields: {
      size: {
        type: "enum",
        required: true,
        label: "Size",
        options: [
          "Small (20x40in)",
          "Medium (24x48in)",
          "Large (30x60in)",
          "XL (35x70in)",
        ],
      },
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Microfiber", "Cotton", "Bamboo", "Synthetic Blend"],
      },
      quickDry: {
        type: "boolean",
        required: false,
        label: "Quick-Dry",
      },
      absorbency: {
        type: "enum",
        required: false,
        label: "Absorbency Level",
        options: ["Low", "Medium", "High", "Ultra-High"],
      },
      packable: {
        type: "boolean",
        required: false,
        label: "Packable/Compact",
      },
      antimicrobial: {
        type: "boolean",
        required: false,
        label: "Antimicrobial Treatment",
      },
      hangLoop: {
        type: "boolean",
        required: false,
        label: "Hang Loop/Snap",
      },
    },
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // ACCESSORIES - BEAR CANISTERS
  // ===========================================================================

  "Bear Canister": {
    fields: {
      capacityL: {
        type: "number",
        required: true,
        label: "Capacity",
        unit: "L",
        min: 1,
        max: 15,
      },
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Polycarbonate", "Carbon Fiber", "Aluminum", "ABS Plastic"],
      },
    },
    derive: (attrs) => attrs,
  },

  "Pocket Knife": {
    fields: {},
    derive: (attrs) => attrs,
  },

  "First Aid Kit": {
    fields: {},
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // MISCELLANEOUS / GENERIC ITEMS
  // ===========================================================================

  Toiletry: {
    fields: {},
    derive: (attrs) => attrs,
  },

  Medication: {
    fields: {},
    derive: (attrs) => attrs,
  },

  Document: {
    fields: {},
    derive: (attrs) => attrs,
  },

  Other: {
    fields: {},
    derive: (attrs) => attrs,
  },
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Get all supported item types
 * @returns {string[]} Array of item type names
 */
function getAllItemTypes() {
  return Object.keys(SCHEMAS).sort();
}

/**
 * Get schema definition for a specific item type
 * @param {string} itemType - The item type name
 * @returns {object|null} Schema definition or null if not found
 */
function getSchemaForItemType(itemType) {
  if (!itemType || typeof itemType !== "string") return null;
  return SCHEMAS[itemType] || null;
}

/**
 * Check if an item type is supported
 * @param {string} itemType - The item type name
 * @returns {boolean}
 */
function isValidItemType(itemType) {
  return (
    itemType && typeof itemType === "string" && SCHEMAS.hasOwnProperty(itemType)
  );
}

/**
 * Get field definitions for UI rendering
 * @param {string} itemType - The item type name
 * @returns {Array<{key: string, ...fieldDef}>} Array of field definitions with keys
 */
function getFieldsForItemType(itemType) {
  const schema = getSchemaForItemType(itemType);
  if (!schema) return [];

  return Object.entries(schema.fields).map(([key, field]) => ({
    key,
    ...field,
  }));
}

/**
 * Validate attributes against the schema for an item type
 * @param {string} itemType - The item type name
 * @param {object} attributes - The attributes to validate
 * @returns {{valid: boolean, errors: string[], cleaned: object, derived: object}}
 */
function validateAttributes(itemType, attributes) {
  const result = {
    valid: true,
    errors: [],
    cleaned: {},
    derived: {},
  };

  // If no item type, nothing to validate
  if (!itemType) {
    return result;
  }

  const schema = getSchemaForItemType(itemType);
  if (!schema) {
    result.valid = false;
    result.errors.push(`Unknown item type: ${itemType}`);
    return result;
  }

  const attrs = attributes || {};

  // Validate each field
  for (const [key, fieldDef] of Object.entries(schema.fields)) {
    const value = attrs[key];
    const hasValue = value !== undefined && value !== null && value !== "";

    // Check required fields
    if (fieldDef.required && !hasValue && !fieldDef.derived) {
      result.valid = false;
      result.errors.push(`${fieldDef.label || key} is required`);
      continue;
    }

    // Skip if no value (and not required)
    if (!hasValue) continue;

    // Type-specific validation
    switch (fieldDef.type) {
      case "number": {
        const num = Number(value);
        if (Number.isNaN(num)) {
          result.valid = false;
          result.errors.push(`${fieldDef.label || key} must be a number`);
        } else {
          if (fieldDef.min !== undefined && num < fieldDef.min) {
            result.valid = false;
            result.errors.push(
              `${fieldDef.label || key} must be at least ${fieldDef.min}`,
            );
          }
          if (fieldDef.max !== undefined && num > fieldDef.max) {
            result.valid = false;
            result.errors.push(
              `${fieldDef.label || key} must be at most ${fieldDef.max}`,
            );
          }
          if (result.valid) {
            result.cleaned[key] = num;
          }
        }
        break;
      }

      case "enum": {
        const strValue = typeof value === "number" ? value : String(value);
        // Handle numeric enums (like fillPower: [650, 750...])
        const normalizedOptions = fieldDef.options.map((opt) =>
          typeof opt === "number" ? opt : String(opt),
        );
        const normalizedValue =
          typeof strValue === "number" ? strValue : strValue;

        if (!normalizedOptions.includes(normalizedValue)) {
          // Try numeric comparison for number enums
          const numValue = Number(strValue);
          if (
            Number.isFinite(numValue) &&
            normalizedOptions.includes(numValue)
          ) {
            result.cleaned[key] = numValue;
          } else {
            result.valid = false;
            result.errors.push(
              `${fieldDef.label || key} must be one of: ${fieldDef.options.join(", ")}`,
            );
          }
        } else {
          result.cleaned[key] = normalizedValue;
        }
        break;
      }

      case "boolean": {
        if (typeof value === "boolean") {
          result.cleaned[key] = value;
        } else if (value === "true" || value === "1" || value === 1) {
          result.cleaned[key] = true;
        } else if (value === "false" || value === "0" || value === 0) {
          result.cleaned[key] = false;
        } else {
          result.valid = false;
          result.errors.push(`${fieldDef.label || key} must be true or false`);
        }
        break;
      }

      case "string":
      default: {
        const strVal = String(value).trim();
        if (strVal) {
          result.cleaned[key] = strVal;
        }
        break;
      }
    }
  }

  // Run derive function if valid so far
  if (result.valid && schema.derive) {
    result.derived = schema.derive({ ...result.cleaned });
    // Merge derived values back into cleaned (derived values fill in gaps)
    for (const [k, v] of Object.entries(result.derived)) {
      if (v !== undefined && v !== null && result.cleaned[k] === undefined) {
        result.cleaned[k] = v;
      }
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// MIGRATION HELPERS
// -----------------------------------------------------------------------------

/**
 * Normalize old free-form attribute keys to standard keys
 * Used during migration from Map<string, string> to structured attributes
 */
const KEY_MAPPINGS = {
  // Temperature
  "temperature rating": "tempRatingF",
  "temp rating": "tempRatingF",
  temp: "tempRatingF",
  rating: "tempRatingF",
  temperature: "tempRatingF",

  // Fill
  "fill power": "fillPower",
  fill: "fillPower",
  "down fill": "fillPower",

  // Volume/Capacity
  "capacity (l)": "volumeLiters",
  capacity: "volumeLiters",
  volume: "volumeLiters",
  "volume (l)": "volumeLiters",
  liters: "volumeLiters",
  "size (l)": "volumeLiters",

  // R-Value
  "r-value": "rValue",
  "r value": "rValue",
  rvalue: "rValue",

  // Gender
  "gender / fit": "gender",
  "gender/fit": "gender",
  fit: "gender",
  "gender fit": "gender",

  // Shape
  shape: "shape",

  // Size
  size: "lengthSize",
  variant: "lengthSize",
  length: "lengthSize",

  // Misc
  "raincover included": "rainCoverIncluded",
  "rain cover included": "rainCoverIncluded",
  "rain cover": "rainCoverIncluded",
  suspension: "backPanelType",
  lumens: "maxLumens",
  "max lumens": "maxLumens",
  brightness: "maxLumens",
};

/**
 * Parse temperature from various formats
 * @param {string} value - e.g., "30°F (-1°C)", "30F", "-1C", "30"
 * @returns {{tempRatingF?: number, tempRatingC?: number}}
 */
function parseTemperature(value) {
  if (!value || typeof value !== "string") return {};

  const result = {};

  // Try to find Fahrenheit
  const fMatch = value.match(/(-?\d+)\s*[°]?\s*F/i);
  if (fMatch) {
    result.tempRatingF = parseInt(fMatch[1], 10);
  }

  // Try to find Celsius
  const cMatch = value.match(/(-?\d+)\s*[°]?\s*C/i);
  if (cMatch) {
    result.tempRatingC = parseInt(cMatch[1], 10);
  }

  // If only one found, derive the other
  if (result.tempRatingF != null && result.tempRatingC == null) {
    result.tempRatingC = Math.round((result.tempRatingF - 32) * (5 / 9));
  } else if (result.tempRatingC != null && result.tempRatingF == null) {
    result.tempRatingF = Math.round(result.tempRatingC * (9 / 5) + 32);
  }

  // If neither found, try bare number (assume Fahrenheit)
  if (result.tempRatingF == null && result.tempRatingC == null) {
    const bareMatch = value.match(/^(-?\d+)$/);
    if (bareMatch) {
      result.tempRatingF = parseInt(bareMatch[1], 10);
      result.tempRatingC = Math.round((result.tempRatingF - 32) * (5 / 9));
    }
  }

  return result;
}

/**
 * Parse fill power from various formats
 * @param {string} value - e.g., "900 fill-power", "850", "900fp"
 * @returns {number|null}
 */
function parseFillPower(value) {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/(\d{3,4})/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 500 && num <= 1000) return num;
  }
  return null;
}

/**
 * Parse volume/capacity from various formats
 * @param {string} value - e.g., "24L", "24", "24 Liters"
 * @returns {number|null}
 */
function parseVolume(value) {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Parse boolean from various formats
 * @param {string} value - e.g., "Yes", "No", "true", "1"
 * @returns {boolean|null}
 */
function parseBoolean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).toLowerCase().trim();
  if (["yes", "true", "1", "included", "y"].includes(str)) return true;
  if (["no", "false", "0", "not included", "n"].includes(str)) return false;
  return null;
}

/**
 * Parse gender from various formats
 * @param {string} value - e.g., "Women", "Women's", "Womens", "M", "Unisex"
 * @returns {string|null}
 */
function parseGender(value) {
  if (!value) return null;
  const str = String(value).toLowerCase().trim();

  if (
    str.includes("women") ||
    str.includes("female") ||
    str === "w" ||
    str === "f"
  ) {
    return "Womens";
  }
  if (str.includes("men") || str.includes("male") || str === "m") {
    // Check it's not "women"
    if (!str.includes("women")) return "Mens";
  }
  if (str.includes("unisex") || str.includes("one size") || str === "u") {
    return "Unisex";
  }
  return null;
}

/**
 * Parse R-Value from various formats
 * @param {string} value - e.g., "4.5", "R-4.5", "R4.5"
 * @returns {number|null}
 */
function parseRValue(value) {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Attempt to migrate old Map attributes to new structured format
 * @param {string} itemType - The item type
 * @param {Map|object} oldAttributes - Old attributes (Map or plain object)
 * @returns {{migrated: object, unmapped: object, warnings: string[]}}
 */
function migrateAttributes(itemType, oldAttributes) {
  const result = {
    migrated: {},
    unmapped: {},
    warnings: [],
  };

  if (!oldAttributes) return result;

  // Convert Map to object if needed
  const attrs =
    oldAttributes instanceof Map
      ? Object.fromEntries(oldAttributes.entries())
      : { ...oldAttributes };

  const schema = getSchemaForItemType(itemType);
  if (!schema) {
    result.warnings.push(`No schema for item type: ${itemType}`);
    result.unmapped = attrs;
    return result;
  }

  for (const [key, value] of Object.entries(attrs)) {
    const normalizedKey = key.toLowerCase().trim();
    const mappedKey = KEY_MAPPINGS[normalizedKey];

    // Special handling for temperature
    if (normalizedKey.includes("temp") || normalizedKey.includes("rating")) {
      const temps = parseTemperature(value);
      if (temps.tempRatingF != null) {
        result.migrated.tempRatingF = temps.tempRatingF;
        if (temps.tempRatingC != null) {
          result.migrated.tempRatingC = temps.tempRatingC;
        }
        continue;
      }
    }

    // Special handling for fill power
    if (normalizedKey.includes("fill")) {
      const fillPower = parseFillPower(value);
      if (fillPower != null) {
        result.migrated.fillPower = fillPower;
        continue;
      }
    }

    // Special handling for R-Value
    if (
      normalizedKey.includes("r-value") ||
      normalizedKey === "rvalue" ||
      normalizedKey === "r value"
    ) {
      const rValue = parseRValue(value);
      if (rValue != null) {
        result.migrated.rValue = rValue;
        continue;
      }
    }

    // Special handling for volume/capacity
    if (
      normalizedKey.includes("capacity") ||
      normalizedKey.includes("volume") ||
      normalizedKey.includes("liter")
    ) {
      const vol = parseVolume(value);
      if (vol != null) {
        // Check if schema expects volumeLiters or volumeMl
        if (schema.fields.volumeLiters) {
          result.migrated.volumeLiters = vol;
        } else if (schema.fields.volumeMl) {
          // Assume value is in ml if > 100, otherwise liters
          result.migrated.volumeMl = vol > 100 ? vol : vol * 1000;
        }
        continue;
      }
    }

    // Special handling for gender
    if (normalizedKey.includes("gender") || normalizedKey === "fit") {
      const gender = parseGender(value);
      if (gender != null) {
        result.migrated.gender = gender;
        continue;
      }
    }

    // Special handling for boolean fields
    if (
      normalizedKey.includes("included") ||
      normalizedKey.includes("compatible") ||
      normalizedKey.includes("certified")
    ) {
      const bool = parseBoolean(value);
      if (bool !== null) {
        const targetKey = mappedKey || key;
        if (schema.fields[targetKey]) {
          result.migrated[targetKey] = bool;
          continue;
        }
      }
    }

    // Try direct mapping
    if (mappedKey && schema.fields[mappedKey]) {
      result.migrated[mappedKey] = value;
      continue;
    }

    // Check if key directly matches schema field (case-insensitive)
    const schemaKey = Object.keys(schema.fields).find(
      (k) => k.toLowerCase() === normalizedKey,
    );
    if (schemaKey) {
      result.migrated[schemaKey] = value;
      continue;
    }

    // Couldn't map this field
    result.unmapped[key] = value;
    result.warnings.push(`Could not map attribute: "${key}" = "${value}"`);
  }

  return result;
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

module.exports = {
  // Schema access
  SCHEMAS,
  getAllItemTypes,
  getSchemaForItemType,
  getFieldsForItemType,
  isValidItemType,

  // Validation
  validateAttributes,

  // Migration helpers
  migrateAttributes,
  parseTemperature,
  parseFillPower,
  parseVolume,
  parseBoolean,
  parseGender,
  parseRValue,
  KEY_MAPPINGS,
};
