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
  "Sleeping Bag (Down)": {
    fields: {
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating (°F)",
        min: -60,
        max: 60,
      },
      fillPower: {
        type: "enum",
        required: true,
        label: "Fill Power",
        options: [550, 600, 650, 700, 750, 800, 850, 900, 950, 1000],
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
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight (oz)",
        min: 0,
        max: 80,
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
  },

  "Sleeping Bag (Synthetic)": {
    fields: {
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating (°F)",
        min: -40,
        max: 60,
      },
      insulationType: {
        type: "string",
        required: false,
        label: "Insulation Type",
        placeholder: "e.g., Climashield Apex, PrimaLoft Gold",
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
  },

  "Ultralight Down Quilt": {
    fields: {
      tempRatingF: {
        type: "number",
        required: true,
        label: "Temperature Rating (°F)",
        min: -20,
        max: 60,
      },
      fillPower: {
        type: "enum",
        required: true,
        label: "Fill Power",
        options: [750, 800, 850, 900, 950, 1000],
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
      fillWeightOz: {
        type: "number",
        required: false,
        label: "Fill Weight (oz)",
        min: 0,
        max: 40,
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
  },

  "Inflatable Sleeping Pad": {
    fields: {
      rValue: {
        type: "number",
        required: true,
        label: "R-Value",
        min: 0,
        max: 10,
        step: 0.1,
      },
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness (in)",
        min: 0.5,
        max: 6,
        step: 0.1,
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
        step: 0.1,
      },
      thicknessIn: {
        type: "number",
        required: false,
        label: "Thickness (in)",
        min: 0.25,
        max: 2,
        step: 0.1,
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
        label: "Volume (L)",
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
        placeholder: "e.g., DCF, X-Pac VX21, Robic Nylon",
      },
      torsoFitRange: {
        type: "string",
        required: false,
        label: "Torso Fit Range",
        placeholder: "e.g., 15-19 in, S/M/L",
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
        label: "Volume (L)",
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
        label: "Laptop Sleeve (in)",
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

  "Backpacking Pot (Titanium)": {
    fields: {
      volumeMl: {
        type: "number",
        required: true,
        label: "Volume (ml)",
        min: 200,
        max: 2000,
      },
      diameterCm: {
        type: "number",
        required: false,
        label: "Diameter (cm)",
        min: 5,
        max: 20,
        step: 0.1,
      },
      heightCm: {
        type: "number",
        required: false,
        label: "Height (cm)",
        min: 3,
        max: 20,
        step: 0.1,
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

  "Backpacking Pot (Aluminum)": {
    fields: {
      volumeMl: {
        type: "number",
        required: true,
        label: "Volume (ml)",
        min: 200,
        max: 3000,
      },
      diameterCm: {
        type: "number",
        required: false,
        label: "Diameter (cm)",
        step: 0.1,
      },
      heightCm: {
        type: "number",
        required: false,
        label: "Height (cm)",
        step: 0.1,
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
  },

  "Backpacking Stove (Canister)": {
    fields: {
      boilTime: {
        type: "number",
        required: false,
        label: "Boil Time - 1L (min)",
        min: 1,
        max: 15,
        step: 0.1,
      },
      burnTime: {
        type: "number",
        required: false,
        label: "Burn Time per 100g (min)",
        min: 10,
        max: 120,
      },
      outputBtu: {
        type: "number",
        required: false,
        label: "Output (BTU)",
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

  "Trekking Poles (Carbon Fiber)": {
    fields: {
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
        label: "Min Length (cm)",
        min: 30,
        max: 100,
      },
      maxLengthCm: {
        type: "number",
        required: false,
        label: "Max Length (cm)",
        min: 100,
        max: 150,
      },
      collapsedLengthCm: {
        type: "number",
        required: false,
        label: "Collapsed Length (cm)",
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

  "Trekking Poles (Aluminum)": {
    fields: {
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
        label: "Min Length (cm)",
      },
      maxLengthCm: {
        type: "number",
        required: false,
        label: "Max Length (cm)",
      },
      collapsedLengthCm: {
        type: "number",
        required: false,
        label: "Collapsed Length (cm)",
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
        label: "Floor Area (sq m)",
        min: 1,
        max: 10,
        step: 0.1,
      },
      vestibuleAreaSqM: {
        type: "number",
        required: false,
        label: "Vestibule Area (sq m)",
        min: 0,
        max: 3,
        step: 0.1,
      },
      peakHeightCm: {
        type: "number",
        required: false,
        label: "Peak Height (cm)",
        min: 75,
        max: 150,
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
        placeholder: "e.g., 20D Silnylon, DCF, 15D Ripstop",
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
        label: "Coverage Area (sq m)",
        min: 2,
        max: 15,
        step: 0.1,
      },
      lengthCm: {
        type: "number",
        required: false,
        label: "Length (cm)",
      },
      widthCm: {
        type: "number",
        required: false,
        label: "Width (cm)",
      },
      material: {
        type: "string",
        required: false,
        label: "Material",
        placeholder: "e.g., DCF 0.5oz, Silpoly, Silnylon",
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
        label: "Max Output (lumens)",
        min: 10,
        max: 2000,
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
      maxBeamDistance: {
        type: "number",
        required: false,
        label: "Max Beam Distance (m)",
        min: 10,
        max: 200,
      },
      batteryCapacityMah: {
        type: "number",
        required: false,
        label: "Battery Capacity (mAh)",
        min: 500,
        max: 5000,
      },
      burnTimeHigh: {
        type: "number",
        required: false,
        label: "Burn Time - High (hrs)",
        min: 0.5,
        max: 20,
        step: 0.5,
      },
      burnTimeLow: {
        type: "number",
        required: false,
        label: "Burn Time - Low (hrs)",
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
        label: "Pore Size (microns)",
        min: 0.01,
        max: 1,
        step: 0.01,
      },
      flowRate: {
        type: "number",
        required: false,
        label: "Flow Rate (L/min)",
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      filterLifeL: {
        type: "number",
        required: false,
        label: "Filter Life (L)",
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
};

// =============================================================================
// GET ALL ITEM TYPES (for dropdown)
// =============================================================================
export function getAllItemTypes() {
  return Object.keys(SCHEMAS).sort();
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
