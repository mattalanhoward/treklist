// server/src/models/userEvent.js
//
// First-party behavioural log, written for one purpose: the admin user
// timeline. Everything else in that timeline is *inferred* from document
// timestamps and provenance flags (see routes/adminUsers.js), which can show
// what someone added but never where they went. This fills that blind spot.
//
// Deliberately narrow — one row per pane a user opens, plus which list or
// community it was. No URLs, no referrers, no IP addresses, no gear content.
// Rows self-delete after RETENTION_DAYS via a TTL index.
const mongoose = require("mongoose");

// How long a pane view is kept before MongoDB expires it.
const RETENTION_DAYS = 90;

// Allowlist of panes worth recording. Anything else is dropped at the route
// rather than stored, so a stray client can't grow new event types.
// "community" and "forum" are hidden behind the SHOW_COMMUNITY client flag —
// they stay in the list so the timeline lights up the moment it flips back on.
const PANES = [
  "gear",
  "myGear",
  "lists",
  "templates",
  "checklist",
  "community",
  "forum",
  "admin",
];

const EVENT_TYPES = ["pane.viewed"];

const UserEventSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: EVENT_TYPES,
    },
    pane: {
      type: String,
      enum: PANES,
    },
    // The list being viewed, when the pane is a gear list or its checklist.
    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GearList",
      default: null,
    },
    // Short free-form qualifier: the My Gear sub-tab, or a community slug.
    // Capped at the route; kept short because it is rendered verbatim.
    detail: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

// The admin timeline reads one user's events, newest first.
UserEventSchema.index({ owner: 1, createdAt: -1 });

// Retention. TTL indexes are swept roughly once a minute by mongod.
UserEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 },
);

const UserEvent = mongoose.model("UserEvent", UserEventSchema);

module.exports = UserEvent;
module.exports.PANES = PANES;
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.RETENTION_DAYS = RETENTION_DAYS;
