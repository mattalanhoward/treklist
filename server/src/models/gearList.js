// server/src/models/gearList.js
const mongoose = require("mongoose");
const { GEARLIST_SWATCHES } = require("../config/colors");

const GearListSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },
    tripStart: { type: Date },
    tripEnd: { type: Date },
    location: { type: String, default: "" },

    // When the pre-trip reminder email was sent for the current tripStart.
    // Reset to null when tripStart changes so a rescheduled trip re-arms.
    tripReminderSentAt: { type: Date, default: null },

    // ACTIVE background (what the user sees right now)
    backgroundImageUrl: { type: String, default: null },
    backgroundColor: {
      type: String,
      enum: [...GEARLIST_SWATCHES, null],
      default: GEARLIST_SWATCHES[0],
    },

    // SAVED custom upload (the one tile we keep, even if user switches to color/default)
    customBackground: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },

    links: [
      {
        label: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],

    // Provenance: set when this list was created by copying another list
    // (either a public/shared list, or one of the owner's own lists).
    // `title` and `ownerEmail` are snapshots so the trail survives the source
    // being renamed or deleted.
    copiedFrom: {
      list: { type: mongoose.Types.ObjectId, ref: "GearList", default: null },
      owner: { type: mongoose.Types.ObjectId, ref: "User", default: null },
      title: { type: String, default: null },
      ownerEmail: { type: String, default: null },
      // Deliberately NOT the share token: that is a live credential granting
      // read access to the source list, and persisting it on someone else's
      // document is a leak waiting to happen. A public-vs-self copy is already
      // derivable from `owner` compared with the list's owner.
      viaShareLink: { type: Boolean, default: false },
      at: { type: Date, default: null },
    },

    region: { type: String, default: null },
    isFeatured: { type: Boolean, default: false },
    isSample: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },

    shareSettings: {
      showNotes: { type: Boolean, default: false },
      showTripDetails: { type: Boolean, default: false },
      showLinks: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// "all lists for this user" — used by the dashboard sidebar and admin panels
GearListSchema.index({ owner: 1 });

module.exports = mongoose.model("GearList", GearListSchema);
