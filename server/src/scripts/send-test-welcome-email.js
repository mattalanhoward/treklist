// server/src/scripts/send-test-welcome-email.js
// =============================================================================
// Send a ONE-OFF test welcome email to any address (does NOT touch the DB).
// Uses the real SMTP credentials from server/.env.
//
// RUN:
//   cd server
//   node src/scripts/send-test-welcome-email.js --to=you@example.com
//
// OPTIONS:
//   --to=<email>   Recipient (required)
//   --lang=<code>  en | nl | de | fr | it | es   (default: en)
//   --name=<str>   Trail name used in the greeting (default: Matt)
// =============================================================================

require("dotenv").config();
const { sendWelcomeEmail } = require("../utils/mailer");

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
};

const to = getArg("to");
const language = getArg("lang", "en");
const trailname = getArg("name", "Matt");

if (!to) {
  console.error(
    "Usage: node src/scripts/send-test-welcome-email.js --to=you@example.com [--lang=en] [--name=Matt]"
  );
  process.exit(1);
}

(async () => {
  const base = (
    process.env.APP_URL ||
    process.env.CLIENT_URL ||
    process.env.CLIENT_URLS ||
    "https://app.treklist.co"
  )
    .split(",")[0]
    .trim();

  const res = await sendWelcomeEmail({
    to,
    trailname,
    listUrl: `${base}/dashboard`,
    unsubscribeUrl: `${base}/unsubscribe-onboarding?uid=test&sig=test`,
    language,
  });

  if (res.skipped) {
    console.log("SMTP not configured (SMTP_HOST/USER/PASS missing) — nothing sent.");
  } else {
    console.log(`✓ Sent ${language} welcome email to ${to} — messageId=${res.messageId}`);
  }
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
