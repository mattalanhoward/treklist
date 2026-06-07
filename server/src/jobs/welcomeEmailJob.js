const crypto = require("crypto");
const User = require("../models/user");
const GearList = require("../models/gearList");
const { sendWelcomeEmail } = require("../utils/mailer");

const WINDOW_MIN_MS = 23 * 60 * 60 * 1000; // 23h
const WINDOW_MAX_MS = 25 * 60 * 60 * 1000; // 25h
const INTERVAL_MS   = 60 * 60 * 1000;       // run every hour

function buildUnsubscribeUrl(userId) {
  const uid = userId.toString();
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(uid)
    .digest("hex")
    .slice(0, 32);
  const base = (process.env.APP_URL || process.env.CLIENT_URL || process.env.CLIENT_URLS || "").split(",")[0].trim();
  return `${base}/unsubscribe-onboarding?uid=${uid}&sig=${sig}`;
}

async function runWelcomeEmailJob() {
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MAX_MS);
  const windowEnd   = new Date(now - WINDOW_MIN_MS);

  let candidates;
  try {
    candidates = await User.find({
      createdAt: { $gte: windowStart, $lte: windowEnd },
      isVerified: true,
      "onboarding.welcomeEmailSentAt": null,
      "onboarding.transactionalOptOut": { $ne: true },
    }).select("_id email trailname createdAt");
  } catch (err) {
    console.error("[welcomeEmailJob] DB query failed:", err.message);
    return;
  }

  if (!candidates.length) return;

  console.log(`[welcomeEmailJob] ${candidates.length} candidate(s) found`);

  for (const user of candidates) {
    try {
      // Find their most recent list to deep-link into
      const list = await GearList.findOne({ owner: user._id })
        .sort({ createdAt: -1 })
        .select("_id");

      const base = (process.env.APP_URL || process.env.CLIENT_URL || process.env.CLIENT_URLS || "").split(",")[0].trim();
      const listUrl = list
        ? `${base}/dashboard/${list._id}`
        : `${base}/dashboard`;

      const unsubscribeUrl = buildUnsubscribeUrl(user._id);

      await sendWelcomeEmail({
        to: user.email,
        trailname: user.trailname,
        listUrl,
        unsubscribeUrl,
      });

      await User.updateOne(
        { _id: user._id },
        { $set: { "onboarding.welcomeEmailSentAt": new Date() } }
      );

      console.log(`[welcomeEmailJob] Sent to ${user.email}`);
    } catch (err) {
      console.error(`[welcomeEmailJob] Failed for ${user.email}:`, err.message);
      // Continue to next user — don't let one failure block the rest
    }
  }
}

function startWelcomeEmailJob() {
  console.log("[welcomeEmailJob] Scheduler started (runs every hour)");
  runWelcomeEmailJob();
  setInterval(runWelcomeEmailJob, INTERVAL_MS);
}

module.exports = { startWelcomeEmailJob, buildUnsubscribeUrl };
