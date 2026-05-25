// =============================================================================
// SEED: Initial communities
// =============================================================================
//
// RUN:
//   cd server
//   node src/scripts/seed-communities.js
//
// Safe to run multiple times — uses upsert on slug.
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");

const COMMUNITIES = [
  {
    name: "Treklist Help",
    slug: "treklist-help",
    description: "Questions, feedback, and help with the Treklist app.",
    sortOrder: 0,
  },
  {
    name: "Shakedown",
    slug: "shakedown",
    description: "Test your kit, share what works, ditch what doesn't.",
    sortOrder: 1,
  },
  {
    name: "Gear Talk",
    slug: "gear-talk",
    description: "General gear discussion, reviews, and comparisons.",
    sortOrder: 2,
  },
  {
    name: "Ultralight",
    slug: "ultralight",
    description: "Sub-10lb baseweight philosophy, tips, and gear.",
    sortOrder: 3,
  },
  {
    name: "TMB",
    slug: "tmb",
    description: "Tour du Mont Blanc — planning, gear, and trip reports.",
    sortOrder: 4,
  },
  {
    name: "AV1",
    slug: "av1",
    description: "Alta Via 1, Dolomites — routes, conditions, and kit.",
    sortOrder: 5,
  },
  {
    name: "WHW",
    slug: "whw",
    description: "West Highland Way — Scotland's most iconic long-distance route.",
    sortOrder: 6,
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
  });

  const Community = require("../models/community");

  let created = 0;
  let updated = 0;

  for (const c of COMMUNITIES) {
    const result = await Community.updateOne(
      { slug: c.slug },
      { $set: c },
      { upsert: true }
    );
    if (result.upsertedCount) {
      console.log(`  ✅ Created: ${c.name}`);
      created++;
    } else {
      console.log(`  ↩  Updated: ${c.name}`);
      updated++;
    }
  }

  console.log(`\nDone — ${created} created, ${updated} updated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
