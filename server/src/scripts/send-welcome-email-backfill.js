// server/src/scripts/send-welcome-email-backfill.js
// =============================================================================
// ONE-TIME BACKFILL: Send welcome email to recent users who never received one
// =============================================================================
//
// WHAT THIS DOES:
//   Finds verified users created in the last 30 days who have not yet received
//   a welcome email, and sends them the standard welcome email.
//   Marks each user with welcomeEmailSentAt after sending.
//
// RUN:
//   cd server
//   node src/scripts/send-welcome-email-backfill.js
//
// OPTIONS:
//   --dry-run     Preview who would be emailed without sending anything
//
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const User = require("../models/user");
const GearList = require("../models/gearList");
const { sendWelcomeEmail } = require("../utils/mailer");
const { buildUnsubscribeUrl } = require("../jobs/welcomeEmailJob");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
  });
  console.log(`Connected to MongoDB (db=${mongoose.connection.name}`);

  if (DRY_RUN) console.log("DRY RUN — no emails will be sent\n");

  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const candidates = await User.find({
    createdAt: { $gte: since },
    isVerified: true,
    "onboarding.welcomeEmailSentAt": null,
    "onboarding.transactionalOptOut": { $ne: true },
    email: { $not: /@treklist\.(co|dev)$/i },
  }).select("_id email trailname createdAt language");

  console.log(`Found ${candidates.length} candidate(s)\n`);

  let sent = 0;
  let failed = 0;

  for (const user of candidates) {
    const list = await GearList.findOne({ owner: user._id })
      .sort({ createdAt: -1 })
      .select("_id");

    const base = (process.env.APP_URL || process.env.CLIENT_URL || process.env.CLIENT_URLS || "").split(",")[0].trim();
    const listUrl = list ? `${base}/dashboard/${list._id}` : `${base}/dashboard`;
    const unsubscribeUrl = buildUnsubscribeUrl(user._id);

    const signedUpDaysAgo = Math.round((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

    console.log(`  ${user.email} (${user.trailname || "no trail name"}, signed up ${signedUpDaysAgo}d ago)`);
    console.log(`    → list: ${listUrl}`);

    if (DRY_RUN) continue;

    try {
      await sendWelcomeEmail({ to: user.email, trailname: user.trailname, listUrl, unsubscribeUrl, language: user.language });
      await User.updateOne(
        { _id: user._id },
        { $set: { "onboarding.welcomeEmailSentAt": new Date() } }
      );
      console.log(`    ✓ Sent`);
      sent++;
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Sent: ${sent}  Failed: ${failed}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
