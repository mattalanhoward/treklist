// server/src/jobs/tripReminderEmailJob.js
// =============================================================================
// Sends a pre-trip reminder email ~LEAD_DAYS before each gear list's tripStart.
//
// Timing: no per-user timezone is stored, so we fire at a fixed UTC hour on the
// calendar day that is LEAD_DAYS before the trip's (UTC) start date. A grace
// window lets a missed hourly tick still send. Trips scheduled with less lead
// than that (or already past) simply never hit the window and are skipped.
// =============================================================================

const crypto = require("crypto");
const User = require("../models/user");
const GearList = require("../models/gearList");
const GearItem = require("../models/gearItem");
const GlobalItem = require("../models/globalItem");
const { sendTripReminderEmail } = require("../utils/mailer");

const LEAD_DAYS = 2;
const SEND_HOUR_UTC = 9; // 09:00 UTC
const GRACE_MS = 6 * 60 * 60 * 1000; // catch up to 6h of missed ticks
const INTERVAL_MS = 60 * 60 * 1000; // run every hour
const DAY_MS = 24 * 60 * 60 * 1000;
const WISHLIST_LIMIT = 5;

function appBase() {
  return (process.env.APP_URL || process.env.CLIENT_URL || process.env.CLIENT_URLS || "")
    .split(",")[0]
    .trim();
}

function buildTripReminderUnsubscribeUrl(userId) {
  const uid = userId.toString();
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`trip:${uid}`)
    .digest("hex")
    .slice(0, 32);
  return `${appBase()}/unsubscribe-trip-reminders?uid=${uid}&sig=${sig}`;
}

// The moment we want to send for a given tripStart: SEND_HOUR_UTC on the day
// that is LEAD_DAYS before the trip's UTC calendar date.
function targetSendTime(tripStart) {
  const d = new Date(tripStart);
  const tripDateUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return tripDateUTC - LEAD_DAYS * DAY_MS + SEND_HOUR_UTC * 60 * 60 * 1000;
}

async function buildSummary(listId) {
  const [agg] = await GearItem.aggregate([
    { $match: { gearList: listId } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        packWeightGrams: {
          $sum: {
            $cond: [
              { $eq: ["$worn", true] },
              0,
              { $multiply: [{ $ifNull: ["$weight", 0] }, { $ifNull: ["$quantity", 1] }] },
            ],
          },
        },
      },
    },
  ]);

  return {
    totalItems: agg?.totalItems || 0,
    packWeightGrams: agg?.packWeightGrams || 0,
  };
}

async function fetchWishlist(ownerId) {
  const items = await GlobalItem.find({ owner: ownerId, status: "wishlisted" })
    .sort({ createdAt: -1 })
    .limit(WISHLIST_LIMIT)
    .select("name brand link affiliate.deepLink")
    .lean();
  // Mirror the app's link precedence (MyGearTileCard): a user-set link wins,
  // otherwise the affiliate deep link for catalog/merchant-backed items.
  return items.map((i) => ({
    name: i.name,
    brand: i.brand,
    url: i.link || i.affiliate?.deepLink || null,
  }));
}

async function runTripReminderEmailJob() {
  const now = Date.now();

  // Generous candidate window; precise timing is checked in JS below.
  const lo = new Date(now); // trip must still be in the future
  const hi = new Date(now + (LEAD_DAYS + 1) * DAY_MS);

  let lists;
  try {
    lists = await GearList.find({
      tripStart: { $gt: lo, $lte: hi },
      tripReminderSentAt: null,
    }).select("_id owner title tripStart tripEnd location links");
  } catch (err) {
    console.error("[tripReminderJob] DB query failed:", err.message);
    return;
  }

  if (!lists.length) return;

  // Keep only the lists whose send moment is in the current window.
  const due = lists.filter((l) => {
    const target = targetSendTime(l.tripStart);
    return now >= target && now <= target + GRACE_MS;
  });

  if (!due.length) return;

  console.log(`[tripReminderJob] ${due.length} list(s) due for a reminder`);

  for (const list of due) {
    try {
      const owner = await User.findById(list.owner).select(
        "email trailname isVerified weightUnit language onboarding.transactionalOptOut onboarding.tripReminderOptOut"
      );

      if (!owner || !owner.email || !owner.isVerified) continue;
      if (owner.onboarding?.transactionalOptOut || owner.onboarding?.tripReminderOptOut) continue;

      const summary = await buildSummary(list._id);
      const wishlistItems = await fetchWishlist(list.owner);

      const base = appBase();
      const language = owner.language || "en";

      await sendTripReminderEmail({
        to: owner.email,
        trailname: owner.trailname,
        tripTitle: list.title,
        daysUntil: LEAD_DAYS,
        tripStartISO: list.tripStart ? new Date(list.tripStart).toISOString() : null,
        tripEndISO: list.tripEnd ? new Date(list.tripEnd).toISOString() : null,
        location: list.location,
        links: list.links,
        listUrl: `${base}/dashboard/${list._id}`,
        checklistUrl: `${base}/dashboard/${list._id}/checklist`,
        wishlistUrl: `${base}/dashboard?pane=myGear&tab=wishlist`,
        unsubscribeUrl: buildTripReminderUnsubscribeUrl(list.owner),
        summary,
        weightUnit: owner.weightUnit || "g",
        wishlistItems,
        language,
      });

      await GearList.updateOne(
        { _id: list._id },
        { $set: { tripReminderSentAt: new Date() } }
      );

      console.log(`[tripReminderJob] Sent for list ${list._id} -> ${owner.email}`);
    } catch (err) {
      console.error(`[tripReminderJob] Failed for list ${list._id}:`, err.message);
      // Continue with the rest — one failure shouldn't block others.
    }
  }
}

function startTripReminderEmailJob() {
  console.log("[tripReminderJob] Scheduler started (runs every hour)");
  runTripReminderEmailJob();
  setInterval(runTripReminderEmailJob, INTERVAL_MS);
}

module.exports = {
  startTripReminderEmailJob,
  runTripReminderEmailJob,
  buildTripReminderUnsubscribeUrl,
};
