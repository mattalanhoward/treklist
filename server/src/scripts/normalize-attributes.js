// server/src/scripts/normalize-attributes.js
// =============================================================================
// Normalize LEGACY display-string attributes -> structured schema keys/values,
// IN PLACE, for the active legacy items (the set that carried display-string
// keys like "Temperature rating":"20°F"). Preserves _ids; only rewrites
// `attributes`.
//
// SCOPE / SAFETY:
//   - Only touches items whose attributes contain FOREIGN keys (not already
//     schema keys) → the already-clean 459 items are never modified.
//   - Skips Zpacks Sleeping Bag / Quilt (slated for feed rebuild).
//   - Skips itemTypes with no schema fields (Other/Toiletry/Medication) — their
//     free-form attributes have no structured target, so they're left as-is.
//   - A per-itemType transform builds a schema-key-only attributes object. The
//     item is only written if the result VALIDATES; otherwise it's reported and
//     left untouched.
//
// DRY-RUN by default. Pass --commit to write.
//   cd server
//   node src/scripts/normalize-attributes.js
//   node src/scripts/normalize-attributes.js --commit
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const {
  getSchemaForItemType,
  validateAttributes,
} = require("../config/attributeSchemas");

const COMMIT = process.argv.includes("--commit");

// -----------------------------------------------------------------------------
// DB TARGET + PRODUCTION GUARD
// -----------------------------------------------------------------------------
// Target DB: --db <name> overrides MONGO_DB_NAME (default = local).
// Writing (--commit) to any non-local DB requires `--confirm <dbName>` to match.
function argVal(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const DB = argVal("--db") || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && argVal("--confirm") !== DB) {
  console.error(
    `\nRefusing to --commit to non-local DB "${DB}".\n` +
      `Re-run with:  --db ${DB} --commit --confirm ${DB}\n`,
  );
  process.exit(1);
}

// -----------------------------------------------------------------------------
// VALUE HELPERS
// -----------------------------------------------------------------------------
const num = (v) => {
  if (v == null) return undefined;
  const m = String(v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : undefined;
};
const has = (v, re) => v != null && re.test(String(v));
const yes = (v) => has(v, /^\s*(yes|true|y|included)\b/i) || v === true;
const pick = (a, ...keys) => {
  for (const k of keys) if (a[k] != null && a[k] !== "") return a[k];
  return undefined;
};
function gender(v) {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (/women|female/.test(s)) return "Womens";
  if (/\bmen|male/.test(s)) return "Mens";
  if (/unisex|one size/.test(s)) return "Unisex";
  return undefined;
}
function weightClass(v) {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (/ultralight/.test(s)) return "Ultralight";
  if (/light/.test(s)) return "Lightweight";
  if (/mid/.test(s)) return "Midweight";
  if (/heavy/.test(s)) return "Heavyweight";
  if (/expedition/.test(s)) return "Expedition";
  return undefined;
}
function potMaterial(v) {
  if (has(v, /titanium/i)) return "Titanium";
  if (has(v, /alumin/i)) return "Aluminum";
  if (has(v, /stainless/i)) return "Stainless Steel";
  return undefined;
}
function fabricType(v) {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  const merino = /merino|wool/.test(s);
  const synth = /nylon|poly|spandex|elastane|lycra|synthetic/.test(s);
  if (merino && synth) return "Wool Blend";
  if (merino) return "Merino Wool";
  if (/silk/.test(s)) return "Silk";
  if (synth) return "Synthetic";
  return undefined;
}
// drop undefined keys
const clean = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o))
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  return out;
};

// -----------------------------------------------------------------------------
// PER-ITEMTYPE TRANSFORMS: raw legacy attrs (+ doc) -> schema-key attrs
// -----------------------------------------------------------------------------
const T = {
  "Backpacking Pot": (a) =>
    clean({
      material: potMaterial(pick(a, "Material / finish", "Material")),
      volumeMl: num(pick(a, "Capacity")),
    }),

  "Base Layer Top": (a) =>
    clean({
      gender: gender(a.Gender),
      weight: weightClass(a.Weight),
      fabricType: fabricType(a.Fabric),
      sleevesLength: has(a["Sleeve Length"], /long/i)
        ? "Long Sleeve"
        : has(a["Sleeve Length"], /short/i)
          ? "Short Sleeve"
          : undefined,
    }),

  "Base Layer Bottom": (a) =>
    clean({
      gender: gender(a.Gender),
      weight: weightClass(a.Weight),
      fabricType: fabricType(a.Fabric),
    }),

  "Dry Bag / Stuff Sack": (a) =>
    clean({
      volumeLiters: num(a.Volume),
      closureType: has(a.Closure, /roll/i)
        ? "Roll-Top"
        : has(a.Closure, /draw/i)
          ? "Drawcord"
          : has(a.Closure, /zip/i)
            ? "Zip"
            : has(a.Closure, /buckle/i)
              ? "Buckle"
              : undefined,
      material: a.Material,
    }),

  "Hiking Socks": (a) =>
    clean({
      sockType: "Hiking", // Darn Tough Micro Crew = hiking socks
      material: fabricType(a.Fabric), // wool+nylon blend -> Wool Blend
      cushioning: ["Light", "Medium", "Heavy"].find((c) =>
        has(a.Cushion, new RegExp(c, "i")),
      ),
      height: has(a.Height, /crew/i)
        ? "Crew"
        : has(a.Height, /ankle/i)
          ? "Ankle"
          : undefined,
    }),

  "Inflatable Sleeping Pad": (a) =>
    clean({
      rValue: num(a["R-Value"]),
      shape: ["Rectangular", "Mummy", "Semi-Rectangular"].find((s) =>
        has(a.Style, new RegExp(s, "i")),
      ),
      lengthSize: has(a.Variant, /short/i)
        ? "Short"
        : has(a.Variant, /large|long/i)
          ? "Long"
          : "Regular",
      widthSize: has(a.Variant, /wide/i) ? "Wide" : undefined,
      inflationMethod: has(a["Included components"], /pump sack/i)
        ? "Pump Sack"
        : undefined,
    }),

  "Power Bank": (a) => {
    const ports = a.Ports || "";
    const cMatch = ports.match(/(\d+)\s*[×x]\s*USB-?C/i);
    const aMatch = ports.match(/(\d+)\s*[×x]\s*USB-?A/i);
    const fc = pick(a, "Charging", "Charging / Output", "Output");
    const pd = has(fc, /\bPD\b|power delivery/i);
    const qc = has(fc, /\bQC\b|quick charge/i);
    return clean({
      capacityMah: num(a.Capacity),
      outputPortsUsbC: cMatch ? parseInt(cMatch[1], 10) : undefined,
      outputPortsUsbA: aMatch ? parseInt(aMatch[1], 10) : undefined,
      fastCharging:
        pd && qc
          ? "Both PD & QC"
          : pd
            ? "USB Power Delivery (PD)"
            : qc
              ? "Qualcomm Quick Charge"
              : undefined,
      waterproofRating: has(a.Waterproof, /IPX?\d/i)
        ? a.Waterproof.match(/IPX?\d/i)[0].toUpperCase().replace("IPX", "IPX")
        : undefined,
    });
  },

  Earbuds: (a) =>
    clean({
      noiseCancelling: yes(a["Active Noise Cancellation"]),
      heartRateSensor: yes(a["Heart Rate Sensor"]),
      batteryLifeHrs: num(a["Battery Life"]),
      caseBatteryLifeHrs: num(a["Battery Life with Charging Case"]),
      ipRating: a["Water Resistant"] || undefined,
    }),

  "Charging Cable": (a, doc) => {
    const parts = String(doc.name).split(/\s+to\s+/i);
    const conn = (s) =>
      has(s, /lightning/i)
        ? "Lightning"
        : has(s, /usb[\s-]?c/i)
          ? "USB-C"
          : has(s, /usb[\s-]?a/i)
            ? "USB-A"
            : has(s, /micro/i)
              ? "Micro-USB"
              : undefined;
    const lenM = a.Length && a.Length.match(/([\d.]+)\s*m\b/);
    return clean({
      connectorA: conn(parts[0]),
      connectorB: conn(parts[1] || a.Compatibility),
      lengthCm: lenM ? Math.round(parseFloat(lenM[1]) * 100) : undefined,
      maxPowerW: num(a["Power Rating"]),
      dataSync: has(a["Use Cases"], /data/i) || undefined,
    });
  },

  "Hiking Shorts": (a, doc) =>
    clean({
      gender: gender(doc.name) || "Mens",
      inseamIn: num(a.Inseam),
      stretchFabric: has(a["Fabric features"], /stretch/i) || undefined,
      builtInLiner: has(a["Style / Fit"], /liner/i) || undefined,
    }),

  "Insulated Jacket": (a) =>
    clean({
      insulationType: has(a["Insulation Type"], /synthetic/i)
        ? "Synthetic"
        : has(a["Insulation Type"], /down/i)
          ? "Down"
          : undefined,
      gender: gender(a.Gender),
      fillPower: num(a["Fill Power"]),
      shellFabric: a.Fabric,
    }),

  "Travel Charger": (a) => {
    const ports = a.Ports || "";
    const cMatch = ports.match(/(\d+)\s*[×x]\s*USB-?C/i);
    return clean({
      totalWattage: num(pick(a, "Power rating", "Power Rating")),
      outputPortsUsbC: cMatch ? parseInt(cMatch[1], 10) : undefined,
      fastCharging: yes(a["Fast charging"]) || undefined,
      internationalPlugs: has(pick(a, "Plug Type", "Countries", "Input Voltage"), /.+/)
        ? true
        : undefined,
    });
  },

  Utensil: (a, doc) =>
    clean({
      utensilType: ["Spoon", "Fork", "Spork", "Knife"].find((u) =>
        has(doc.name, new RegExp(u, "i")),
      ),
      material: potMaterial(pick(a, "Material / finish", "Material")),
      longHandle: has(doc.name, /long handle/i) || undefined,
    }),

  "Gloves (Insulated)": (a) =>
    clean({
      style: "Gloves (5-finger)",
      insulationType: /wool/i.test(a.Material || "")
        ? "Wool"
        : /fleece/i.test(a.Material || "")
          ? "Fleece"
          : "Synthetic",
    }),

  "Hat/Headwear": (a, doc) =>
    clean({
      hatType: has(doc.name, /bandana|buff|gaiter/i)
        ? "Buff/Neck Gaiter"
        : "Brimmed Hat",
      material: /merino|wool/i.test(a.Material || "")
        ? "Wool Blend"
        : /cotton/i.test(a.Material || "") && !/poly/i.test(a.Material || "")
          ? "Cotton"
          : "Synthetic",
    }),

  Smartphone: (a, doc) =>
    clean({
      os: /apple|iphone/i.test(doc.brand + " " + doc.name) ? "iOS" : "Android",
      storageGb: num(a.Storage),
      cellular: has(a["Cellular Technology"], /5g/i)
        ? "5G"
        : has(a["Cellular Technology"], /lte|4g/i)
          ? "4G / LTE"
          : undefined,
      batteryLifeHrs: num(a["Battery Life"]),
    }),

  Smartwatch: (a) =>
    clean({
      gps: a.GPS ? true : undefined,
      maps: has(a.Navigation, /map/i) || undefined,
      waterResistanceM: num(a["Water resistance"]),
      displayType: has(a.Display, /amoled/i)
        ? "AMOLED"
        : has(a.Display, /mip/i)
          ? "MIP (Transflective)"
          : has(a.Display, /lcd/i)
            ? "LCD"
            : undefined,
    }),

  Sunglasses: (a) =>
    clean({
      uvProtection: has(a.Lens, /uv\s?400/i)
        ? "UV400 (100%)"
        : has(a.Lens, /uv\s?38/i)
          ? "UV380-400"
          : has(a.Lens, /uv/i)
            ? "Basic UV"
            : undefined,
      polarized: has(a.Lens, /polariz/i) || undefined,
      frameMaterial: has(a["Front frame"], /acetate|plastic/i)
        ? "Plastic/Acetate"
        : has(a["Front frame"], /titanium/i)
          ? "Titanium"
          : has(a["Front frame"], /metal|alumin/i)
            ? "Metal"
            : undefined,
    }),

  "Travel Towel": (a, doc) =>
    clean({
      size: has(doc.name, /mini|xs|x-small/i)
        ? "XS"
        : has(doc.name, /small/i)
          ? "Small"
          : has(doc.name, /medium/i)
            ? "Medium"
            : has(doc.name, /large/i)
              ? "Large"
              : "Medium",
      material: /microfiber/i.test(a.Material || "")
        ? "Microfiber"
        : /(poly|nylon).*(nylon|poly)/i.test(a.Material || "")
          ? "Synthetic Blend"
          : "Synthetic Blend",
      quickDry: yes(a["Quick-drying"]) || undefined,
      antimicrobial: has(a["Odor control"], /antimicrob/i) || undefined,
      hangLoop: has(a["Carry / attachment"], /hang loop/i) || undefined,
    }),

  Underwear: (a, doc) =>
    clean({
      gender: gender(doc.name) || "Mens",
      style: ["Boxer Brief", "Brief", "Bikini", "Hipster", "Trunk", "Thong"].find(
        (s) => has(doc.name, new RegExp(s, "i")),
      ),
      material: /merino/i.test(a.Fabric || "") ? "Merino Wool" : "Synthetic",
    }),
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem");
  console.log("=".repeat(72));
  console.log(
    `ATTRIBUTE NORMALIZATION  (${COMMIT ? "COMMIT — WILL WRITE" : "DRY RUN — no writes"})`,
  );
  console.log(`DB: ${mongoose.connection.name}`);
  console.log("=".repeat(72));

  const items = await C.find({ itemType: { $ne: null } }).lean();
  let candidates = 0,
    willWrite = 0,
    invalid = 0;
  const invalidRows = [];

  for (const it of items) {
    const schema = getSchemaForItemType(it.itemType);
    if (!schema || Object.keys(schema.fields).length === 0) continue; // no target fields
    const a =
      it.attributes instanceof Map
        ? Object.fromEntries(it.attributes)
        : it.attributes || {};
    const keys = Object.keys(a);
    if (!keys.length) continue;
    const schemaKeys = new Set(Object.keys(schema.fields).map((k) => k.toLowerCase()));
    const foreign = keys.filter((k) => !schemaKeys.has(k.toLowerCase()));
    if (!foreign.length) continue; // already structured
    if (
      (it.brand || "").toLowerCase() === "zpacks" &&
      (it.itemType === "Sleeping Bag" || it.itemType === "Quilt")
    )
      continue; // rebuild path

    candidates++;
    const transform = T[it.itemType];
    if (!transform) {
      invalid++;
      invalidRows.push({ name: it.name, type: it.itemType, why: "no transform" });
      continue;
    }
    const next = transform(a, it);
    const { valid, errors, cleaned } = validateAttributes(it.itemType, next);
    if (!valid) {
      invalid++;
      invalidRows.push({
        name: it.name,
        type: it.itemType,
        why: errors.join("; "),
        produced: next,
      });
      continue;
    }
    willWrite++;
    console.log(
      `  ✓ [${it.itemType}] ${it.name}\n      ${JSON.stringify(a)}\n      → ${JSON.stringify(cleaned)}`,
    );
    if (COMMIT) {
      await C.updateOne(
        { _id: it._id },
        { $set: { attributes: cleaned } },
      );
    }
  }

  console.log("\n" + "-".repeat(72));
  console.log(
    `candidates: ${candidates} | ${COMMIT ? "written" : "would write"}: ${willWrite} | not-normalized: ${invalid}`,
  );
  if (invalidRows.length) {
    console.log("\nNOT NORMALIZED (left untouched):");
    for (const r of invalidRows) {
      console.log(`  [${r.type}] ${r.name} — ${r.why}`);
      if (r.produced) console.log(`      produced: ${JSON.stringify(r.produced)}`);
    }
  }
  if (!COMMIT) console.log("\n(DRY RUN — nothing written. Re-run with --commit.)");
  await mongoose.disconnect();
  console.log("\nDone.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
