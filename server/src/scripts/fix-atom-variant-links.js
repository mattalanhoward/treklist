/**
 * fix-atom-variant-links.js — Atom Packs: each Version variant is a distinct product
 * page (user-supplied 2026-07-03). Set per-variant deepLink + point the item-level
 * offer at the default variant's URL (new /collections/<line>/products/ format).
 * Variants with no supplied URL (The Atom UL35, The Nanu Custom) fall back to the item.
 *
 *   node src/scripts/fix-atom-variant-links.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const B = "https://atompacks.co.uk/collections";

const MAP = {
  "The Prospector": {
    EP50: `${B}/the-prospector/products/the-prospector-ep50-black`,
    EP60: `${B}/the-prospector/products/the-prospector-ep60-us-navy`,
    Custom: `${B}/the-prospector/products/the-prospector-custom`,
  },
  "The Notch": {
    EP40: `${B}/the-notch/products/the-notch-ep40`,
    EP50: `${B}/the-notch/products/the-notch-ep50-mountain-green`,
    Custom: `${B}/the-notch/products/the-notch-custom`,
  },
  "The Pulse": {
    EP40: `${B}/the-pulse/products/the-pulse-ep40`,
    EP50: `${B}/the-pulse/products/the-pulse-ep50-black`,
    Custom: `${B}/the-pulse/products/the-pulse-custom`,
  },
  "The Atom": {
    RE30: `${B}/the-atom/products/the-atom-re30-black`,
    RE40: `${B}/the-atom/products/the-atom-re40-black`,
    Custom: `${B}/the-atom/products/the-atom-custom`,
  },
  "The Nanu": {
    X25: `${B}/the-nanu/products/the-nanu-x25`,
    RE25: `${B}/the-nanu/products/the-nanu-re25`,
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let vSet = 0, offerSet = 0;
  for (const [name, byKey] of Object.entries(MAP)) {
    const doc = await C.findOne({ brand: /^atom packs$/i, name, isActive: true }).select("variants defaultVariantKey").lean();
    if (!doc) { console.log(`  ! not found: ${name}`); continue; }
    console.log(`\n■ ${name} (default: ${doc.defaultVariantKey})`);
    for (const v of doc.variants) {
      const url = byKey[v.key];
      console.log(`   ${v.key.padEnd(8)} → ${url ? url.split("/").pop() : "(no url — falls back to item)"}`);
      if (url && COMMIT) {
        await C.updateOne({ _id: doc._id }, { $set: { "variants.$[v].deepLink": url } }, { arrayFilters: [{ "v.key": v.key }] });
        vSet++;
      }
    }
    // point the item-level offer at the default variant's URL (fallback + base)
    const defUrl = byKey[doc.defaultVariantKey];
    if (defUrl && COMMIT) {
      const r = await O.updateMany({ productId: doc._id }, { $set: { deepLink: defUrl } });
      offerSet += r.modifiedCount;
      console.log(`   item offer → ${defUrl.split("/").pop()}`);
    } else if (!defUrl) {
      console.log(`   item offer: left as-is (default "${doc.defaultVariantKey}" has no supplied URL)`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — variant links set:${vSet} | item offers updated:${offerSet}`);
  await mongoose.disconnect();
})();
