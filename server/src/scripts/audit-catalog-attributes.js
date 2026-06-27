// server/src/scripts/audit-catalog-attributes.js
// =============================================================================
// READ-ONLY AUDIT: Catalog attribute keys vs. attributeSchemas.js
// =============================================================================
//
// WHAT THIS DOES (writes NOTHING to the DB):
//   For every CatalogItem with an itemType + attributes, it classifies each raw
//   attribute key into one of:
//     - structured : key already matches a schema field exactly (good)
//     - alias       : key is mapped by KEY_MAPPINGS -> a real schema field
//     - parser      : key is handled by a special parser in migrateAttributes()
//                     (temp / fill / r-value / volume / gender / boolean)
//     - unmapped    : migrateAttributes() can't place it
//
//   It then simulates migrateAttributes() + validateAttributes() per item and
//   reports how many items would migrate cleanly vs. need attention, plus the
//   global frequency of every raw key and a sample of unmapped keys/values.
//
// RUN:
//   cd server
//   node src/scripts/audit-catalog-attributes.js            # human summary
//   node src/scripts/audit-catalog-attributes.js --json out.json   # + JSON dump
//   node src/scripts/audit-catalog-attributes.js --type "Quilt"    # filter
//   node src/scripts/audit-catalog-attributes.js --samples 5       # sample count
//
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");

const {
  getSchemaForItemType,
  isValidItemType,
  validateAttributes,
  migrateAttributes,
  KEY_MAPPINGS,
} = require("../config/attributeSchemas");

// -----------------------------------------------------------------------------
// ARGS
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
function flagVal(name, dflt) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
}
const JSON_OUT = flagVal("--json", null);
const TYPE_FILTER = flagVal("--type", null);
const SAMPLES = parseInt(flagVal("--samples", "3"), 10);

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
function attrsToObject(attrs) {
  if (!attrs) return {};
  if (attrs instanceof Map) return Object.fromEntries(attrs.entries());
  return { ...attrs };
}

// Classify a single raw key for a given itemType schema.
function classifyKey(rawKey, schema) {
  const norm = String(rawKey).toLowerCase().trim();

  // structured: exact schema field (case-insensitive)
  const schemaKey = Object.keys(schema.fields).find(
    (k) => k.toLowerCase() === norm,
  );
  if (schemaKey) return { bucket: "structured", target: schemaKey };

  // parser-handled (mirrors the special cases in migrateAttributes)
  if (norm.includes("temp") || norm.includes("rating"))
    return { bucket: "parser", target: "tempRating*" };
  if (norm.includes("fill")) return { bucket: "parser", target: "fillPower" };
  if (norm.includes("r-value") || norm === "rvalue" || norm === "r value")
    return { bucket: "parser", target: "rValue" };
  if (
    norm.includes("capacity") ||
    norm.includes("volume") ||
    norm.includes("liter")
  )
    return { bucket: "parser", target: "volume*" };
  if (norm.includes("gender") || norm === "fit")
    return { bucket: "parser", target: "gender" };
  if (
    norm.includes("included") ||
    norm.includes("compatible") ||
    norm.includes("certified")
  ) {
    const mapped = KEY_MAPPINGS[norm];
    const target = mapped || rawKey;
    if (schema.fields[target]) return { bucket: "parser", target };
  }

  // alias via KEY_MAPPINGS
  const mapped = KEY_MAPPINGS[norm];
  if (mapped && schema.fields[mapped])
    return { bucket: "alias", target: mapped };

  return { bucket: "unmapped", target: null };
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not set in environment");
    process.exit(1);
  }
  await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB_NAME });
  console.log("=".repeat(72));
  console.log("CATALOG ATTRIBUTE AUDIT (read-only)");
  console.log(`DB: ${mongoose.connection.name}`);
  console.log("=".repeat(72));

  const CatalogItem = require("../models/catalogItem");
  const query = TYPE_FILTER ? { itemType: TYPE_FILTER } : {};
  const items = await CatalogItem.find(query).lean();

  // ---- global counters ----
  const totals = {
    items: items.length,
    withItemType: 0,
    validItemType: 0,
    unknownItemType: 0,
    withAttrs: 0,
    // post-migration outcomes
    migrateClean: 0, // valid after migrate, nothing unmapped
    migrateValidButLossy: 0, // valid after migrate, but some keys unmapped
    migrateInvalid: 0, // validateAttributes fails after migrate
    noAttrsNoop: 0,
  };

  // raw key -> { count, buckets:{bucket:count}, types:Set, samples:[] }
  const keyStats = new Map();
  // bucket tallies (per key-occurrence)
  const bucketTally = { structured: 0, alias: 0, parser: 0, unmapped: 0 };
  // per itemType rollup
  const byType = new Map();
  // unmapped samples
  const unmappedSamples = [];
  // items that would fail validation after migrate
  const invalidSamples = [];

  function keyEntry(k) {
    if (!keyStats.has(k))
      keyStats.set(k, {
        count: 0,
        buckets: {},
        types: new Set(),
        samples: [],
      });
    return keyStats.get(k);
  }
  function typeEntry(t) {
    if (!byType.has(t))
      byType.set(t, {
        items: 0,
        withAttrs: 0,
        clean: 0,
        lossy: 0,
        invalid: 0,
        bucketTally: { structured: 0, alias: 0, parser: 0, unmapped: 0 },
        unmappedKeys: new Map(),
      });
    return byType.get(t);
  }

  for (const item of items) {
    const it = item.itemType;
    if (it) totals.withItemType++;
    const validType = isValidItemType(it);
    if (it && !validType) {
      totals.unknownItemType++;
      continue;
    }
    if (!validType) continue; // null itemType: skip (nothing to validate against)
    totals.validItemType++;

    const te = typeEntry(it);
    te.items++;

    const attrs = attrsToObject(item.attributes);
    const rawKeys = Object.keys(attrs);
    if (rawKeys.length === 0) {
      totals.noAttrsNoop++;
      continue;
    }
    totals.withAttrs++;
    te.withAttrs++;

    const schema = getSchemaForItemType(it);

    // classify each raw key
    for (const rawKey of rawKeys) {
      const { bucket, target } = classifyKey(rawKey, schema);
      bucketTally[bucket]++;
      te.bucketTally[bucket]++;

      const ke = keyEntry(rawKey);
      ke.count++;
      ke.buckets[bucket] = (ke.buckets[bucket] || 0) + 1;
      ke.types.add(it);
      if (ke.samples.length < SAMPLES)
        ke.samples.push({ type: it, value: attrs[rawKey], target });

      if (bucket === "unmapped") {
        te.unmappedKeys.set(rawKey, (te.unmappedKeys.get(rawKey) || 0) + 1);
        if (unmappedSamples.length < 200)
          unmappedSamples.push({
            type: it,
            name: item.name,
            key: rawKey,
            value: attrs[rawKey],
          });
      }
    }

    // simulate migrate + validate
    const { migrated, unmapped } = migrateAttributes(it, attrs);
    const { valid, errors } = validateAttributes(it, migrated);
    const hasUnmapped = Object.keys(unmapped).length > 0;

    if (valid && !hasUnmapped) {
      totals.migrateClean++;
      te.clean++;
    } else if (valid && hasUnmapped) {
      totals.migrateValidButLossy++;
      te.lossy++;
    } else {
      totals.migrateInvalid++;
      te.invalid++;
      if (invalidSamples.length < 60)
        invalidSamples.push({
          type: it,
          name: item.name,
          errors,
          rawKeys,
          migrated,
        });
    }
  }

  // ---- PRINT ----
  const pct = (n) => `${((n / (totals.items || 1)) * 100).toFixed(1)}%`;

  console.log("\nGLOBAL");
  console.log(`  Catalog items: ${totals.items}`);
  console.log(
    `  With itemType: ${totals.withItemType} (valid ${totals.validItemType}, unknown ${totals.unknownItemType})`,
  );
  console.log(`  With attributes: ${totals.withAttrs}`);
  console.log("");
  console.log("  Migration simulation (items w/ valid itemType):");
  console.log(
    `    clean (valid, nothing dropped) : ${totals.migrateClean} (${pct(totals.migrateClean)})`,
  );
  console.log(
    `    valid but lossy (keys dropped) : ${totals.migrateValidButLossy} (${pct(totals.migrateValidButLossy)})`,
  );
  console.log(
    `    INVALID after migrate          : ${totals.migrateInvalid} (${pct(totals.migrateInvalid)})`,
  );
  console.log(
    `    no attributes (noop)           : ${totals.noAttrsNoop}`,
  );

  console.log("\nKEY CLASSIFICATION (per key-occurrence)");
  const totalKeyOcc =
    bucketTally.structured +
    bucketTally.alias +
    bucketTally.parser +
    bucketTally.unmapped;
  for (const b of ["structured", "alias", "parser", "unmapped"]) {
    const n = bucketTally[b];
    const p = totalKeyOcc ? ((n / totalKeyOcc) * 100).toFixed(1) : "0.0";
    console.log(`  ${b.padEnd(11)}: ${String(n).padStart(5)}  (${p}%)`);
  }

  console.log("\nRAW KEYS (sorted by frequency)");
  console.log(
    "  count  bucket(s)                         key  ->  sample value",
  );
  const sortedKeys = [...keyStats.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, st] of sortedKeys) {
    const buckets = Object.entries(st.buckets)
      .map(([b, c]) => `${b}:${c}`)
      .join(",");
    const sample = st.samples[0];
    const sval =
      sample !== undefined ? JSON.stringify(sample.value) : "";
    const tgt = sample && sample.target ? ` => ${sample.target}` : "";
    console.log(
      `  ${String(st.count).padStart(5)}  ${buckets.padEnd(32)} ${JSON.stringify(key)}${tgt}  e.g. ${sval}`,
    );
  }

  console.log("\nPER ITEM TYPE");
  const sortedTypes = [...byType.entries()].sort(
    (a, b) => b[1].withAttrs - a[1].withAttrs,
  );
  for (const [type, te] of sortedTypes) {
    if (te.withAttrs === 0) continue;
    const ub = te.bucketTally.unmapped;
    console.log(
      `  ${type}  [items:${te.items} withAttrs:${te.withAttrs}] clean:${te.clean} lossy:${te.lossy} invalid:${te.invalid}` +
        (ub ? `  unmappedKeyOcc:${ub}` : ""),
    );
    if (te.unmappedKeys.size) {
      const uk = [...te.unmappedKeys.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => `${JSON.stringify(k)}(${c})`)
        .join(", ");
      console.log(`      unmapped keys: ${uk}`);
    }
  }

  console.log("\nUNMAPPED KEY SAMPLES (up to 30)");
  for (const s of unmappedSamples.slice(0, 30)) {
    console.log(
      `  [${s.type}] ${s.name} :: ${JSON.stringify(s.key)} = ${JSON.stringify(s.value)}`,
    );
  }

  console.log("\nWOULD-FAIL-VALIDATION SAMPLES (up to 15)");
  for (const s of invalidSamples.slice(0, 15)) {
    console.log(`  [${s.type}] ${s.name}`);
    console.log(`      errors: ${s.errors.join("; ")}`);
    console.log(`      rawKeys: ${s.rawKeys.join(", ")}`);
  }

  if (JSON_OUT) {
    const dump = {
      totals,
      bucketTally,
      keys: sortedKeys.map(([key, st]) => ({
        key,
        count: st.count,
        buckets: st.buckets,
        types: [...st.types],
        samples: st.samples,
      })),
      byType: sortedTypes.map(([type, te]) => ({
        type,
        items: te.items,
        withAttrs: te.withAttrs,
        clean: te.clean,
        lossy: te.lossy,
        invalid: te.invalid,
        bucketTally: te.bucketTally,
        unmappedKeys: [...te.unmappedKeys.entries()],
      })),
      unmappedSamples,
      invalidSamples,
    };
    fs.writeFileSync(JSON_OUT, JSON.stringify(dump, null, 2));
    console.log(`\nJSON report written to: ${JSON_OUT}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
