// server/src/scripts/send-test-trip-reminder-email.js
// =============================================================================
// Send a ONE-OFF test trip-reminder email to any address (does NOT touch DB).
// Uses the real SMTP credentials from server/.env.
//
// RUN:
//   cd server
//   node src/scripts/send-test-trip-reminder-email.js --to=you@example.com
//
// OPTIONS:
//   --to=<email>   Recipient (required)
//   --lang=<code>  en | nl | de | fr | it | es        (default: en)
//   --name=<str>   Trail name in the greeting          (default: Matt)
//   --title=<str>  Trip title                          (default: a sample)
//   --days=<n>     Days until the trip                 (default: 2)
//   --unit=<g|oz>  Weight unit                         (default: g)
//   --empty        Render the empty-list variant (no summary)
//   --no-wishlist  Omit the wishlist block
// =============================================================================

require("dotenv").config();
const { sendTripReminderEmail } = require("../utils/mailer");

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
};
const hasFlag = (name) => args.includes(`--${name}`);

const to = getArg("to");
if (!to) {
  console.error(
    "Usage: node src/scripts/send-test-trip-reminder-email.js --to=you@example.com [--lang=en] [--title=...] [--days=2] [--unit=g] [--empty] [--no-wishlist]"
  );
  process.exit(1);
}

const isEmpty = hasFlag("empty");
const summary = isEmpty
  ? { totalItems: 0, packWeightGrams: 0, wornCount: 0, consumableCount: 0 }
  : { totalItems: 23, packWeightGrams: 7340, wornCount: 3, consumableCount: 4 };

const wishlistItems = hasFlag("no-wishlist")
  ? []
  : [
      { name: "Ultralight Camp Chair", brand: "Helinox" },
      { name: "Down Quilt 0C", brand: "Cumulus" },
    ];

(async () => {
  const base = (
    process.env.APP_URL ||
    process.env.CLIENT_URL ||
    process.env.CLIENT_URLS ||
    "https://app.treklist.co"
  )
    .split(",")[0]
    .trim();

  const res = await sendTripReminderEmail({
    to,
    trailname: getArg("name", "Matt"),
    tripTitle: getArg("title", "Wild camping (1 night, near Wendover)"),
    daysUntil: Number(getArg("days", "2")),
    tripStartISO: "2026-05-23T23:00:00.000Z",
    tripEndISO: "2026-05-24T23:00:00.000Z",
    location: getArg("location", "Great Missenden, Buckinghamshire"),
    links: hasFlag("no-links")
      ? []
      : [
          { label: "Route on what3words", url: "https://w3w.co/grocers.confident.recount" },
          { label: "Met Office forecast", url: "https://www.metoffice.gov.uk" },
        ],
    listUrl: `${base}/dashboard/sample`,
    checklistUrl: `${base}/dashboard/sample/checklist`,
    wishlistUrl: `${base}/dashboard?pane=myGear&tab=wishlist`,
    unsubscribeUrl: `${base}/unsubscribe-trip-reminders?uid=test&sig=test`,
    summary,
    weightUnit: getArg("unit", "g"),
    wishlistItems,
    language: getArg("lang", "en"),
  });

  if (res.skipped) {
    console.log("SMTP not configured (SMTP_HOST/USER/PASS missing) — nothing sent.");
  } else {
    console.log(`✓ Sent trip reminder to ${to} — messageId=${res.messageId}`);
  }
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
