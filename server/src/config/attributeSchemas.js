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

  "Sleeping Bag (Down)": {
    fields: {
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        unit: "°F",
        min: -60,
        max: 60,
      },
      tempRatingC: {
        type: "number",
        required: false, // Auto-derived from Fahrenheit
        label: "Temperature Rating",
        unit: "°C",
        derived: true,
        min: -51,
        max: 16,
      },
      fillPower: {
        type: "enum",
        required: true,
        label: "Fill Power",
        options: [550, 600, 650, 700, 750, 800, 850, 900, 950, 1000],
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "oz",
        min: 0,
        max: 80,
      },
      shape: {
        type: "enum",
        required: true,
        label: "Shape",
        options: ["Mummy", "Semi-Rectangular", "Rectangular", "Spoon", "Quilt"],
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
    },
    derive: (attrs) => {
      // Auto-calculate Celsius from Fahrenheit
      if (attrs.tempRatingF != null && attrs.tempRatingC == null) {
        attrs.tempRatingC = Math.round((attrs.tempRatingF - 32) * (5 / 9));
      }
      return attrs;
    },
  },

  "Sleeping Bag (Synthetic)": {
    fields: {
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        unit: "°F",
        min: -40,
        max: 60,
      },
      tempRatingC: {
        type: "number",
        required: false,
        label: "Temperature Rating",
        unit: "°C",
        derived: true,
        min: -40,
        max: 16,
      },
      insulationType: {
        type: "string",
        required: false,
        label: "Insulation Type",
        // e.g., "Climashield Apex", "PrimaLoft Gold", "Thermic Micro"
      },
      shape: {
        type: "enum",
        required: true,
        label: "Shape",
        options: ["Mummy", "Semi-Rectangular", "Rectangular", "Spoon", "Quilt"],
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
      if (attrs.tempRatingF != null && attrs.tempRatingC == null) {
        attrs.tempRatingC = Math.round((attrs.tempRatingF - 32) * (5 / 9));
      }
      return attrs;
    },
  },

  "Ultralight Down Quilt": {
    fields: {
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        unit: "°F",
        min: -20,
        max: 60,
      },
      tempRatingC: {
        type: "number",
        required: false,
        label: "Temperature Rating",
        unit: "°C",
        derived: true,
      },
      fillPower: {
        type: "enum",
        required: true,
        label: "Fill Power",
        options: [750, 800, 850, 900, 950, 1000],
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
        unit: "oz",
        min: 0,
        max: 40,
      },
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
    },
    derive: (attrs) => {
      if (attrs.tempRatingF != null && attrs.tempRatingC == null) {
        attrs.tempRatingC = Math.round((attrs.tempRatingF - 32) * (5 / 9));
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
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "in",
        min: 0.5,
        max: 6,
      },
      thicknessCm: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "cm",
        derived: true,
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
      // Convert inches to cm
      if (attrs.thicknessIn != null && attrs.thicknessCm == null) {
        attrs.thicknessCm = Math.round(attrs.thicknessIn * 2.54 * 10) / 10;
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
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness",
        unit: "in",
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
    derive: (attrs) => attrs,
  },

  // ===========================================================================
  // BACKPACKS
  // ===========================================================================

  "Ultralight Backpack": {
    fields: {
      volumeLiters: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "L",
        min: 20,
        max: 80,
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
        options: ["Padded", "Webbing Only", "Removable", "None"],
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
        options: ["Padded", "Webbing Only", "Removable", "None"],
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

  // ===========================================================================
  // COOKING / KITCHEN
  // ===========================================================================

  "Backpacking Pot (Titanium)": {
    fields: {
      volumeMl: {
        type: "number",
        required: true,
        label: "Volume",
        unit: "ml",
        min: 200,
        max: 2000,
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
      heightCm: {
        type: "number",
        required: false,
        label: "Height",
        unit: "cm",
        min: 3,
        max: 20,
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
      return attrs;
    },
  },

  "Backpacking Pot (Aluminum)": {
    // Same as Titanium - aluminum is just cheaper/heavier
    fields: {
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
      },
      heightCm: {
        type: "number",
        required: false,
        label: "Height",
        unit: "cm",
      },
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
    },
    derive: (attrs) => {
      if (attrs.volumeMl != null && attrs.volumeOz == null) {
        attrs.volumeOz = Math.round((attrs.volumeMl / 29.574) * 10) / 10;
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

  // ===========================================================================
  // TREKKING POLES
  // ===========================================================================

  "Trekking Poles (Carbon Fiber)": {
    fields: {
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
      soldAs: {
        type: "enum",
        required: true,
        label: "Sold As",
        options: ["Single", "Pair"],
      },
    },
    derive: (attrs) => attrs,
  },

  "Trekking Poles (Aluminum)": {
    fields: {
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
      },
      maxLengthCm: {
        type: "number",
        required: false,
        label: "Max Length",
        unit: "cm",
      },
      collapsedLengthCm: {
        type: "number",
        required: false,
        label: "Collapsed Length",
        unit: "cm",
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
      soldAs: {
        type: "enum",
        required: true,
        label: "Sold As",
        options: ["Single", "Pair"],
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
      floorArea: {
        type: "number",
        required: false,
        label: "Floor Area",
        unit: "sq ft",
        min: 15,
        max: 100,
      },
      vestibuleArea: {
        type: "number",
        required: false,
        label: "Vestibule Area",
        unit: "sq ft",
        min: 0,
        max: 30,
      },
      peakHeightIn: {
        type: "number",
        required: false,
        label: "Peak Height",
        unit: "in",
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
    derive: (attrs) => attrs,
  },

  "Tarp Shelter": {
    fields: {
      shape: {
        type: "enum",
        required: false,
        label: "Shape",
        options: ["Rectangular", "Catenary Cut", "Hex", "A-Frame", "Pyramid"],
      },
      coverageArea: {
        type: "number",
        required: false,
        label: "Coverage Area",
        unit: "sq ft",
        min: 20,
        max: 150,
      },
      lengthCm: {
        type: "number",
        required: false,
        label: "Length",
        unit: "cm",
      },
      widthCm: {
        type: "number",
        required: false,
        label: "Width",
        unit: "cm",
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
    derive: (attrs) => attrs,
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
  // WATER
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
      },
      flowRate: {
        type: "number",
        required: false,
        label: "Flow Rate",
        unit: "L/min",
        min: 0.1,
        max: 5,
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
