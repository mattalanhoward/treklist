// client/src/components/AttributeFields.jsx
// =============================================================================
// DYNAMIC ATTRIBUTE FORM FIELDS
// =============================================================================
// Renders appropriate form inputs based on the selected item type.
// Uses the same schema definitions as the backend for consistency.
//
// Usage:
//   <AttributeFields
//     itemType="Sleeping Bag (Down)"
//     attributes={{ tempRatingC: -7, fillPower: 850 }}
//     onChange={(newAttributes) => setAttributes(newAttributes)}
//   />
// =============================================================================

import React from "react";

// =============================================================================
// SCHEMA DEFINITIONS (must match server/src/config/attributeSchemas.js)
// =============================================================================
// NOTE: Keep this in sync with the backend! If you add/change fields on the
// server, update them here too.
// =============================================================================

const SCHEMAS = {
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
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
      },
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
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
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
  },

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
      },
      torsoFitRange: {
        type: "string",
        required: false,
        label: "Torso Fit Range",
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
  },

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
      material: {
        type: "enum",
        required: true,
        label: "Material",
        options: ["Titanium", "Stainless Steel", "Aluminum", "Plastic", "Silicone (Collapsible)", "Enamel"],
      },
    },
  },

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
  },

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
      vestibuleAreaSqM: {
        type: "number",
        required: false,
        label: "Vestibule Area",
        unit: "sq m",
        min: 0,
        max: 2.8,
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
  },

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
  },

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
  },

  "Hydration Reservoir": {
    fields: {
      capacityL: {
        type: "enum",
        required: true,
        label: "Capacity",
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
  },

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
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
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
      shellFabric: {
        type: "string",
        required: false,
        label: "Shell Fabric",
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
        options: [
          "Lightweight",
          "Midweight",
          "Heavyweight",
        ],
      },
    },
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
      },
    },
  },

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
  },

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
  },

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
  },

  "Pocket Knife": {
    fields: {},
  },

  "First Aid Kit": {
    fields: {},
  },

  Toiletry: {
    fields: {},
  },

  Medication: {
    fields: {},
  },

  Document: {
    fields: {},
  },

  Other: {
    fields: {},
  },
};

// =============================================================================
// CUSTOM FIELD LAYOUTS
// =============================================================================
// Define custom row layouts for specific item types to optimize data entry.
// Each row is an array of field keys. Fields not listed will be omitted.
// Use gridCols to specify the grid columns for each row (default: length of row).
const FIELD_LAYOUTS = {
  Backpack: {
    rows: [
      // Row 1: Core identifiers (5 cols)
      {
        fields: ["gender", "volumeLiters", "mainFabric", "torsoFitRange", "loadCapacityKg"],
        gridCols: 5,
      },
      // Row 2: Frame & suspension (4 cols)
      {
        fields: ["frameType", "backPanelType", "hipBeltType", "waterResistance"],
        gridCols: 4,
      },
      // Row 3: Booleans (4 cols to align with row above, 4th empty)
      {
        fields: ["hydrationCompatible", "rainCoverIncluded", "hipBeltRemovable"],
        gridCols: 4,
      },
    ],
  },
  Daypack: {
    rows: [
      // Row 1: Core identifiers (4 cols)
      {
        fields: ["gender", "volumeLiters", "loadCapacityKg", "laptopSleeveSize"],
        gridCols: 4,
      },
      // Row 2: Frame & suspension (4 cols, 4th empty)
      {
        fields: ["frameType", "hipBeltType", "waterResistance"],
        gridCols: 4,
      },
      // Row 3: Booleans (4 cols to align, 4th empty)
      {
        fields: ["hydrationCompatible", "rainCoverIncluded", "hipBeltRemovable"],
        gridCols: 4,
      },
    ],
  },
};

// =============================================================================
// CATEGORY TO ITEM TYPE MAPPING
// =============================================================================
// Maps catalog categories to their relevant item types
export const CATEGORY_ITEM_TYPE_MAPPING = {
  "Sleep System": [
    "Sleeping Bag",
    "Quilt",
    "Inflatable Sleeping Pad",
    "Foam Sleeping Pad",
    "Sleeping Bag Liner",
    "Pillow",
  ],
  "Backpacks & Bags": ["Backpack", "Daypack", "Hip Pack"],
  "Kitchen & Cooking": ["Backpacking Pot", "Backpacking Stove (Canister)", "Coffee Mug"],
  Shelter: ["Backpacking Tent", "Tarp Shelter"],
  "Electronics & Power": ["Headlamp", "Power Bank"],
  Hydration: ["Water Filter", "Water Bottle", "Hydration Reservoir"],
  Footwear: ["Hiking Boots", "Trail Running Shoes"],
  "Men's Clothing": [
    "Rain Jacket",
    "Rain Pants",
    "Insulated Jacket",
    "Fleece Jacket",
    "Base Layer Top",
    "Base Layer Bottom",
    "Hiking Socks",
    "Hat/Headwear",
    "Hiking Shorts",
    "Hiking Shirt",
    "Gloves (Insulated)",
  ],
  "Women's Clothing": [
    "Rain Jacket",
    "Rain Pants",
    "Insulated Jacket",
    "Fleece Jacket",
    "Base Layer Top",
    "Base Layer Bottom",
    "Hiking Socks",
    "Hat/Headwear",
    "Hiking Shorts",
    "Hiking Shirt",
    "Gloves (Insulated)",
  ],
  "Unisex Clothing": [
    "Rain Jacket",
    "Rain Pants",
    "Insulated Jacket",
    "Fleece Jacket",
    "Base Layer Top",
    "Base Layer Bottom",
    "Hiking Socks",
    "Hat/Headwear",
    "Hiking Shorts",
    "Hiking Shirt",
    "Gloves (Insulated)",
  ],
  "Accessories & Tools": ["Trekking Poles", "Sunglasses", "Bear Canister", "Pocket Knife"],
  Travel: ["Travel Towel"],
  "Health & Hygiene": ["Toiletry", "Medication", "First Aid Kit"],
  "Navigation & Planning": ["Document"],
};

// =============================================================================
// GET ALL ITEM TYPES (for dropdown)
// =============================================================================
export function getAllItemTypes() {
  return Object.keys(SCHEMAS).sort();
}

// =============================================================================
// GET ITEM TYPES FOR CATEGORY
// =============================================================================
// Returns item types relevant to the selected category
export function getItemTypesForCategory(category) {
  if (!category) {
    return getAllItemTypes();
  }

  const mappedTypes = CATEGORY_ITEM_TYPE_MAPPING[category] || [];

  // Sort mapped types alphabetically, then add "Other" at the end
  const sortedTypes = [...mappedTypes].sort();

  return [...sortedTypes, "Other"];
}

// =============================================================================
// GET SCHEMA FOR ITEM TYPE
// =============================================================================
export function getSchemaForItemType(itemType) {
  return SCHEMAS[itemType] || null;
}

// =============================================================================
// HELPERS: Convert between free-form text and attributes object
// =============================================================================
function attributesToText(attributes) {
  if (!attributes || typeof attributes !== "object") return "";
  const entries =
    attributes instanceof Map
      ? Array.from(attributes.entries())
      : Object.entries(attributes);
  return entries
    .filter(([k, v]) => k && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function textToAttributes(text) {
  const out = {};
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (!k || !v) continue;
    // Try to parse as number or boolean
    if (v === "true") out[k] = true;
    else if (v === "false") out[k] = false;
    else if (!Number.isNaN(Number(v)) && v !== "") out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

// =============================================================================
// FALLBACK FREE-FORM COMPONENT
// =============================================================================
function FreeFormAttributes({ attributes, onChange, itemType }) {
  const [text, setText] = React.useState(() => attributesToText(attributes));

  // Sync text when attributes change externally
  React.useEffect(() => {
    setText(attributesToText(attributes));
  }, [attributes]);

  const handleBlur = () => {
    const parsed = textToAttributes(text);
    onChange(parsed);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-primary/70 bg-base-200/50 rounded p-2">
        <span className="font-semibold">
          No schema defined for "{itemType}".
        </span>
        <br />
        Enter attributes manually using <code>Key: Value</code> format (one per
        line).
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        className="block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt resize-y"
        rows={5}
        placeholder={`Example:\nCapacity (L): 24\nGender: Unisex\nHydration Compatible: true`}
      />
      <div className="text-[11px] text-primary/60">
        Tip: Use <code>true</code>/<code>false</code> for booleans, numbers will
        be auto-detected.
      </div>
    </div>
  );
}

// =============================================================================
// ATTRIBUTE FIELDS COMPONENT
// =============================================================================

export default function AttributeFields({ itemType, attributes, onChange }) {
  const schema = getSchemaForItemType(itemType);

  // If no item type selected, show placeholder
  if (!itemType) {
    return (
      <div className="text-xs text-primary/60 italic py-2">
        Select an item type to see attribute fields.
      </div>
    );
  }

  // If no schema exists for this itemType, show free-form fallback
  if (!schema) {
    return (
      <FreeFormAttributes
        itemType={itemType}
        attributes={attributes}
        onChange={onChange}
      />
    );
  }

  const attrs = attributes || {};

  // Handle field value change
  const handleFieldChange = (key, value, fieldType) => {
    const newAttrs = { ...attrs };

    if (value === "" || value === null || value === undefined) {
      delete newAttrs[key];
    } else if (fieldType === "number") {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        newAttrs[key] = num;
      }
    } else if (fieldType === "boolean") {
      newAttrs[key] = Boolean(value);
    } else {
      newAttrs[key] = value;
    }

    onChange(newAttrs);
  };

  // Get required fields first, then optional
  const fieldEntries = Object.entries(schema.fields);
  const requiredFields = fieldEntries.filter(([, f]) => f.required);
  const optionalFields = fieldEntries.filter(([, f]) => !f.required);

  const renderField = ([key, field]) => {
    const value = attrs[key];
    const isRequired = field.required;

    // Common label (shows unit hint for admin clarity)
    const label = (
      <label className="block font-medium text-primary mb-0.5">
        {field.label}
        {field.unit && (
          <span className="font-normal text-primary/50 ml-1">
            ({field.unit})
          </span>
        )}
        {isRequired && <span className="text-error ml-1">*</span>}
      </label>
    );

    // Render based on field type
    switch (field.type) {
      case "enum":
        return (
          <div key={key}>
            {label}
            <select
              value={value ?? ""}
              onChange={(e) =>
                handleFieldChange(key, e.target.value || null, "enum")
              }
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
            >
              <option value="">Select…</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );

      case "boolean":
        return (
          <div key={key} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) =>
                handleFieldChange(key, e.target.checked, "boolean")
              }
              className="checkbox checkbox-sm"
              id={`attr-${key}`}
            />
            <label
              htmlFor={`attr-${key}`}
              className="text-primary cursor-pointer"
            >
              {field.label}
            </label>
          </div>
        );

      case "number":
        return (
          <div key={key}>
            {label}
            <input
              type="number"
              value={value ?? ""}
              onChange={(e) => handleFieldChange(key, e.target.value, "number")}
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              min={field.min}
              max={field.max}
              step={field.step || 0.01}
              placeholder={field.placeholder}
            />
          </div>
        );

      case "string":
      default:
        return (
          <div key={key}>
            {label}
            <input
              type="text"
              value={value ?? ""}
              onChange={(e) => handleFieldChange(key, e.target.value, "string")}
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              placeholder={field.placeholder}
            />
          </div>
        );
    }
  };

  // Check for custom layout
  const customLayout = FIELD_LAYOUTS[itemType];

  if (customLayout) {
    // Render using custom row layout
    return (
      <div className="space-y-3">
        {customLayout.rows.map((row, rowIndex) => {
          const gridColsClass = {
            2: "grid-cols-2",
            3: "grid-cols-1 sm:grid-cols-3",
            4: "grid-cols-2 sm:grid-cols-4",
            5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
            6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
          }[row.gridCols] || "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";

          return (
            <div key={rowIndex} className={`grid ${gridColsClass} gap-3`}>
              {row.fields.map((fieldKey) => {
                const field = schema.fields[fieldKey];
                if (!field) return null;
                return renderField([fieldKey, field]);
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Default layout: required fields first, then optional
  return (
    <div className="space-y-3">
      {/* Required fields */}
      {requiredFields.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-primary/80 mb-2">
            Required Attributes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {requiredFields.map(renderField)}
          </div>
        </div>
      )}

      {/* Optional fields */}
      {optionalFields.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-primary/60 mb-2">
            Optional Attributes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {optionalFields.map(renderField)}
          </div>
        </div>
      )}
    </div>
  );
}
