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
//     attributes={{ tempRatingF: 20, fillPower: 850 }}
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
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        min: -60,
        max: 60,
      },
      fillPower: {
        type: "enum",
        required: false,
        label: "Fill Power",
        options: [550, 600, 650, 700, 750, 800, 850, 900, 950, 1000],
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
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
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating",
        min: -20,
        max: 60,
      },
      fillPower: {
        type: "enum",
        required: false,
        label: "Fill Power",
        options: [750, 800, 850, 900, 950, 1000],
      },
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
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
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness",
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
  },

  Backpack: {
    fields: {
      volumeLiters: {
        type: "number",
        required: true,
        label: "Volume",
        min: 20,
        max: 80,
      },
      loadCapacityKg: {
        type: "number",
        required: false,
        label: "Load Capacity",
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
        min: 10,
        max: 40,
      },
      loadCapacityKg: {
        type: "number",
        required: false,
        label: "Load Capacity",
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
        min: 1,
        max: 15,
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
        min: 200,
        max: 3000,
      },
      diameterCm: {
        type: "number",
        required: false,
        label: "Diameter",
        min: 5,
        max: 20,
      },
      heightCm: {
        type: "number",
        required: false,
        label: "Height",
        min: 3,
        max: 20,
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
        min: 1,
        max: 15,
      },
      burnTime: {
        type: "number",
        required: false,
        label: "Burn Time (per 100g)",
        min: 10,
        max: 120,
      },
      outputBtu: {
        type: "number",
        required: false,
        label: "Output",
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
        min: 30,
        max: 100,
      },
      maxLengthCm: {
        type: "number",
        required: false,
        label: "Max Length",
        min: 100,
        max: 150,
      },
      collapsedLengthCm: {
        type: "number",
        required: false,
        label: "Collapsed Length",
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
      floorArea: {
        type: "number",
        required: false,
        label: "Floor Area",
        min: 15,
        max: 100,
      },
      vestibuleArea: {
        type: "number",
        required: false,
        label: "Vestibule Area",
        min: 0,
        max: 30,
      },
      peakHeightIn: {
        type: "number",
        required: false,
        label: "Peak Height",
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
      coverageArea: {
        type: "number",
        required: false,
        label: "Coverage Area",
        min: 20,
        max: 150,
      },
      lengthCm: {
        type: "number",
        required: false,
        label: "Length",
      },
      widthCm: {
        type: "number",
        required: false,
        label: "Width",
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
        min: 10,
        max: 2000,
      },
      maxBeamDistance: {
        type: "number",
        required: false,
        label: "Max Beam Distance",
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
        min: 500,
        max: 5000,
      },
      burnTimeHigh: {
        type: "number",
        required: false,
        label: "Burn Time (High)",
        min: 0.5,
        max: 20,
      },
      burnTimeLow: {
        type: "number",
        required: false,
        label: "Burn Time (Low)",
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
        min: 0.01,
        max: 1,
      },
      flowRate: {
        type: "number",
        required: false,
        label: "Flow Rate",
        min: 0.1,
        max: 5,
      },
      filterLifeL: {
        type: "number",
        required: false,
        label: "Filter Life",
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
        min: 30,
        max: 50,
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
        min: 5000,
        max: 30000,
      },
      breathabilityRating: {
        type: "number",
        required: false,
        label: "Breathability (MVTR)",
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
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight",
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
      syntheticInsulationType: {
        type: "string",
        required: false,
        label: "Synthetic Insulation Type",
      },
      insulationWeightGsm: {
        type: "number",
        required: false,
        label: "Insulation Weight",
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
          "Lightweight (40-60°F)",
          "Midweight (20-40°F)",
          "Heavyweight (<20°F)",
        ],
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
          "Warm Weather (40-60°F)",
          "Cool Weather (20-40°F)",
          "Cold Weather (0-20°F)",
          "Extreme Cold (<0°F)",
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
        label: "Gender/Fit",
        options: ["Mens", "Womens", "Unisex"],
      },
      dropMm: {
        type: "number",
        required: false,
        label: "Heel-Toe Drop",
        min: 0,
        max: 12,
      },
      stackHeightMm: {
        type: "number",
        required: false,
        label: "Stack Height",
        min: 15,
        max: 40,
      },
      cushioning: {
        type: "enum",
        required: false,
        label: "Cushioning Level",
        options: ["Minimal (0-4mm drop)", "Moderate", "Maximal"],
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
      outsoleType: {
        type: "enum",
        required: false,
        label: "Outsole Type",
        options: [
          "Vibram Megagrip",
          "Continental",
          "Proprietary Sticky Rubber",
          "Standard Rubber",
        ],
      },
      lugDepthMm: {
        type: "number",
        required: false,
        label: "Lug Depth",
        min: 2,
        max: 6,
      },
      plateOrRockGuard: {
        type: "boolean",
        required: false,
        label: "Rock Plate/Guard",
      },
      upperMaterial: {
        type: "enum",
        required: false,
        label: "Upper Material",
        options: ["Mesh", "Ripstop", "Engineered Mesh", "Mixed Synthetic"],
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
      inseamIn: {
        type: "number",
        required: false,
        label: "Inseam",
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
      tempBoostF: {
        type: "number",
        required: false,
        label: "Temperature Boost",
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
  },

  "Power Bank": {
    fields: {
      capacityMah: {
        type: "number",
        required: true,
        label: "Capacity",
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
  ],
  "Backpacks & Bags": ["Backpack", "Daypack", "Hip Pack"],
  "Kitchen & Cooking": ["Backpacking Pot", "Backpacking Stove (Canister)"],
  Shelter: ["Backpacking Tent", "Tarp Shelter"],
  "Electronics & Power": ["Headlamp", "Power Bank"],
  Hydration: ["Water Filter", "Water Bottle", "Hydration Reservoir"],
  "Men's Clothing": [
    "Rain Jacket",
    "Insulated Jacket",
    "Base Layer Top",
    "Base Layer Bottom",
    "Hiking Socks",
    "Hat/Headwear",
    "Hiking Shorts",
    "Hiking Shirt",
    "Gloves (Insulated)",
    "Hiking Boots",
    "Trail Running Shoes",
  ],
  "Women's Clothing": [
    "Rain Jacket",
    "Insulated Jacket",
    "Base Layer Top",
    "Base Layer Bottom",
    "Hiking Socks",
    "Hat/Headwear",
    "Hiking Shorts",
    "Hiking Shirt",
    "Gloves (Insulated)",
    "Hiking Boots",
    "Trail Running Shoes",
  ],
  "Unisex Clothing": [
    "Rain Jacket",
    "Insulated Jacket",
    "Base Layer Top",
    "Base Layer Bottom",
    "Hiking Socks",
    "Hat/Headwear",
    "Hiking Shorts",
    "Hiking Shirt",
    "Gloves (Insulated)",
    "Hiking Boots",
    "Trail Running Shoes",
  ],
  "Accessories & Tools": ["Trekking Poles", "Sunglasses"],
  Travel: ["Travel Towel"],
  "Health & Hygiene": ["Toiletry", "Medication"],
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

    // Common label
    const label = (
      <label className="block font-medium text-primary mb-0.5">
        {field.label}
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
              step={field.step || 1}
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
