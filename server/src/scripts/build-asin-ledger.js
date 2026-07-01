/**
 * build-asin-ledger.js — export a durable, committed ledger of every active
 * catalog item's Amazon links, so the per-variant (per-volume) ASINs survive a
 * future schema change to variant-level offers (see memory
 * project-per-variant-offer-routing). Complements the mongodump (which backs up
 * everything currently stored); this ALSO records extra per-volume ASINs that we
 * deliberately did NOT store under the 1-ASIN-per-item decision, and flags which
 * volumes still need an ASIN.
 *
 * Output: repo-root CATALOG_ASIN_LEDGER.json
 *
 *   node src/scripts/build-asin-ledger.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "..", "..", "CATALOG_ASIN_LEDGER.json");

// Per-volume ASINs captured by hand that are NOT in the DB (only the canonical one
// is stored). Fill in more as the user provides them; null = still needed.
// Keyed by catalog item `name` (brand Osprey).
// ⚠ VOLUME-LEVEL ONLY (user, 2026-07-01): we do NOT track per-torso-size or per-color
//   ASINs. An ASIN here may be a specific Amazon size/color child but stands in as the
//   whole volume's buy-link. Future variant-offer routing = per VOLUME, not per torso.
const EXTRA_ASINS = {
  "Atmos AG": { "65L": "B09JXQ6JPD" }, // 50L canonical (in DB)
  "Atmos AG LT": { "65L": "B0BKQJVHHQ" }, // 50L canonical (in DB)
  "Aura AG": { "50L": "B09JXJ9CM4", "65L": "B09JXJVDRT" }, // 50L canonical
  "Aura AG LT": { "65L": "B0BKQJH4Q2", "50L": "B0BKQGL3BY" }, // 65L canonical
  Eja: { "38L": "B0DS6LX8WC", "58L": "B09JXSNYGW" }, // 48L canonical (in DB)
  Exos: { "38L": "B0DS6JGQLJ", "58L": "B0DS6MSDF2" }, // 48L canonical (in DB)
  // ragged/one-size lines (single "Size"/"Volume" axis). Volume-level keys.
  Talon: { "22L": "B0DSCN3TZC", "26L": "B0DSCP1V9L", "33L": "B0DSCM7SHN", "44L": "B0DSCMQG64" }, // 22L canonical
  Tempest: { "22L": "B0DSCQF6QH", "26L": "B0DSCNN9WY", "33L": "B0DSCM8ZTS" }, // 22L canonical
  Stratos: { "24L": "B0G6GD7JLS", "34L": "B09JXJDNGD", "36L": "B09JXK4YSD", "44L": "B09JY5VYPZ" }, // 24L canonical
  Sirrus: { "24L": "B0G6GKWX8D", "34L": "B0G6GKJMWH", "36L": "B0G6GQNVJ8", "44L": "B0G6G8S24G" }, // 24L canonical
  Hikelite: { "18L": "B0FGY23CXN", "26L": "B0FGXZ57PD", "28L": "B0FGXYJM3R", "32L": "B0FGXZ1N8C" }, // 18L canonical (Daypack)
  "Talon Velocity": { "20L": "B0CGQ3P6WB", "30L": "B0CGQ46WN1" }, // 20L canonical (Daypack)
  "Tempest Velocity": { "20L": "B0CGQ3PDB1", "30L": "B0CGQ5NGL1" }, // 20L canonical (Daypack, new)
};

const asObj = (a) => (a instanceof Map ? Object.fromEntries(a) : a && a.toObject ? a.toObject() : a || {});

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const items = await C.find({ isActive: true, canonicalAsin: { $exists: true, $ne: null, $ne: "" } })
    .select("name brand itemType canonicalAsin variantAxes defaultVariantKey attributes")
    .lean();

  const ledger = [];
  for (const it of items) {
    const attrs = asObj(it.attributes);
    const offers = await O.find({ productId: it._id, network: "amazon" })
      .select("externalProductId deepLink region priority")
      .lean();

    const entry = {
      name: it.name,
      brand: it.brand,
      itemType: it.itemType,
      catalogItemId: String(it._id),
      gender: attrs.gender || null,
      canonicalAsin: it.canonicalAsin,
      amazonOffers: offers.map((o) => ({
        externalProductId: o.externalProductId,
        deepLink: o.deepLink,
        region: o.region,
        priority: o.priority,
      })),
    };

    // multi-volume = has a hand-kept per-volume ASIN map (axis-agnostic: the axis may
    // be "Volume", "Size" [ragged], etc.). asinsByVolume keyed by nominal volume.
    const known = EXTRA_ASINS[it.name];
    if (known) {
      entry.multiVolume = true;
      entry.asinsByVolume = { ...known };
      entry.canonicalVolume = Object.keys(known).find((v) => known[v] === it.canonicalAsin) || null;
      entry.pendingVolumes = Object.keys(known).filter((v) => !known[v]);
    }
    ledger.push(entry);
  }

  ledger.sort((a, b) => (a.brand || "").localeCompare(b.brand || "") || a.name.localeCompare(b.name));
  const pending = ledger.filter((e) => e.multiVolume && e.pendingVolumes.length);

  const out = {
    _note:
      "Backup of every active catalog item's Amazon links, for replay when the schema gains variant-level offers. " +
      "For multi-volume items, asinsByVolume maps each volume to its ASIN; pendingVolumes = volumes still needing an ASIN. " +
      "Only the canonical ASIN is currently stored in the DB; extras live in build-asin-ledger.js EXTRA_ASINS. " +
      "See project-per-variant-offer-routing + CATALOG_CURATION_HANDOFF.md.",
    generatedAt: new Date().toISOString(),
    counts: {
      itemsWithAsin: ledger.length,
      multiVolume: ledger.filter((e) => e.multiVolume).length,
      multiVolumeWithPendingAsins: pending.length,
    },
    pendingSummary: pending.map((e) => ({ name: e.name, pendingVolumes: e.pendingVolumes })),
    items: ledger,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
  console.log(`  items with an ASIN: ${out.counts.itemsWithAsin}`);
  console.log(`  multi-volume: ${out.counts.multiVolume}  (with pending ASINs: ${out.counts.multiVolumeWithPendingAsins})`);
  console.log("  pending per-volume ASINs:");
  for (const p of out.pendingSummary) console.log(`    ${p.name.padEnd(20)} needs: ${p.pendingVolumes.join(", ")}`);
  await mongoose.disconnect();
})();
