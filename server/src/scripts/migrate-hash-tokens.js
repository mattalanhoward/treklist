// server/src/scripts/migrate-hash-tokens.js
// =============================================================================
// MIGRATION: Hash plaintext auth tokens at rest (Finding F1)
// =============================================================================
//
// WHAT THIS DOES:
//   Replaces any plaintext refreshTokens[], resetPasswordToken and
//   verifyEmailToken values with their SHA-256 hash, so a DB read cannot be
//   replayed. Already-hashed values (64-char hex) are skipped, so it is safe
//   to re-run.
//
// WHY IT'S ZERO-LOGOUT:
//   The raw refresh token lives in each user's httpOnly cookie. After this
//   migration the server hashes the incoming cookie token before lookup, so it
//   still matches the now-hashed stored value — existing sessions keep working.
//   In-flight reset/verify email links keep working for the same reason.
//   (The /refresh + /logout routes also accept legacy plaintext transitionally,
//   so ordering vs. deploy does not matter.)
//
// RUN:
//   cd server
//   node src/scripts/migrate-hash-tokens.js            # apply
//   node src/scripts/migrate-hash-tokens.js --dry-run  # preview only
//
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const { hashToken, isHashedToken } = require("../utils/tokenHash");

const DRY_RUN = process.argv.slice(2).includes("--dry-run");

async function main() {
  console.log("=".repeat(70));
  console.log("TREKLIST F1 MIGRATION - Hash auth tokens at rest");
  console.log("=".repeat(70));
  if (DRY_RUN) console.log("🔍 DRY RUN - no writes will be made");
  console.log();

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI not set in environment");
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB_NAME });
  console.log(`✅ Connected to database: ${mongoose.connection.name}`);
  console.log();

  const User = require("../models/user");

  // Only touch users that still have at least one plaintext token somewhere.
  const users = await User.find({
    $or: [
      { refreshTokens: { $exists: true, $ne: [] } },
      { resetPasswordToken: { $exists: true, $ne: null } },
      { verifyEmailToken: { $exists: true, $ne: null } },
    ],
  }).select("refreshTokens resetPasswordToken verifyEmailToken");

  console.log(`Scanning ${users.length} user(s) with tokens...`);
  console.log();

  const stats = {
    usersChanged: 0,
    refreshHashed: 0,
    refreshAlready: 0,
    resetHashed: 0,
    verifyHashed: 0,
  };

  for (const user of users) {
    let changed = false;

    if (Array.isArray(user.refreshTokens) && user.refreshTokens.length) {
      const next = user.refreshTokens.map((t) => {
        if (isHashedToken(t)) {
          stats.refreshAlready++;
          return t;
        }
        stats.refreshHashed++;
        changed = true;
        return hashToken(t);
      });
      user.refreshTokens = next;
    }

    if (user.resetPasswordToken && !isHashedToken(user.resetPasswordToken)) {
      user.resetPasswordToken = hashToken(user.resetPasswordToken);
      stats.resetHashed++;
      changed = true;
    }

    if (user.verifyEmailToken && !isHashedToken(user.verifyEmailToken)) {
      user.verifyEmailToken = hashToken(user.verifyEmailToken);
      stats.verifyHashed++;
      changed = true;
    }

    if (changed) {
      stats.usersChanged++;
      if (!DRY_RUN) await user.save();
    }
  }

  console.log("=".repeat(70));
  console.log(DRY_RUN ? "DRY RUN SUMMARY (no writes)" : "MIGRATION COMPLETE");
  console.log("=".repeat(70));
  console.log(`  Users updated:            ${stats.usersChanged}`);
  console.log(`  refreshTokens hashed:     ${stats.refreshHashed}`);
  console.log(`  refreshTokens already ok: ${stats.refreshAlready}`);
  console.log(`  resetPasswordToken hashed:${stats.resetHashed}`);
  console.log(`  verifyEmailToken hashed:  ${stats.verifyHashed}`);
  console.log();

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
