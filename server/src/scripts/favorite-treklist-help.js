// =============================================================================
// MIGRATION: Add Treklist Help to every user's favorites
// =============================================================================
//
// RUN:
//   cd server
//   node src/scripts/favorite-treklist-help.js
//
// Safe to run multiple times — uses $addToSet so no duplicates.
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");

const Community = require("../models/community");
const User = require("../models/user");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const community = await Community.findOne({ slug: "treklist-help" }).lean();
  if (!community) {
    console.error("Could not find community with slug 'treklist-help'. Aborting.");
    process.exit(1);
  }
  console.log(`Found community: ${community.name} (${community._id})`);

  const result = await User.updateMany(
    { favoriteCommunities: { $ne: community._id } },
    { $addToSet: { favoriteCommunities: community._id } }
  );

  console.log(`Done. Updated ${result.modifiedCount} users.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
