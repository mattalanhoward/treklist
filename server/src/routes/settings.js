// server/routes/settings.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authenticate } = require("./auth"); // import your JWT middleware
const { subscribeToKit, unsubscribeFromKit } = require("../utils/kitSubscribe");

// All /settings routes require a valid Bearer token
router.use(authenticate);

/**
 * GET /api/settings
 *   Returns the current user’s settings
 */
router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Pull only the fields the client needs:
    const {
      email,
      trailname,
      trailnameConfirmed,
      trailnameChangedAt,
      createdAt,
      viewMode,
      locale,
      theme,
      weightUnit,
      measurementSystem,
      language,
      region,
      sidebarCollapsed,
      sidebarGearListsCollapsed,
      sidebarMyGearCollapsed,
      marketing,
    } = user;

    res.json({
      email,
      trailname,
      trailnameConfirmed: !!trailnameConfirmed,
      trailnameChangedAt: trailnameChangedAt || null,
      createdAt,
      viewMode,
      locale,
      theme,
      weightUnit,
      measurementSystem,
      language,
      region: (region && String(region).toLowerCase()) || "us",
      sidebarCollapsed: !!sidebarCollapsed,
      sidebarGearListsCollapsed: !!sidebarGearListsCollapsed,
      sidebarMyGearCollapsed: !!sidebarMyGearCollapsed,
      marketing: {
        // always return a boolean; treat missing doc as false
        optedIn: Boolean(marketing?.optedIn),
      },
    });
  } catch (err) {
    console.error("GET /settings error:", err);
    res.status(500).json({ message: "Could not load settings." });
  }
});

/**
 * PATCH /api/settings
 *   Updates only the fields sent in req.body
 */
router.patch("/", async (req, res) => {
  try {
    const updates = req.body;

    // Validate and normalise region if provided
    if (updates.region !== undefined) {
      if (typeof updates.region !== "string" || !/^[a-zA-Z]{2}$/.test(updates.region.trim())) {
        return res.status(400).json({ message: "Invalid region code." });
      }
      updates.region = updates.region.trim().toLowerCase();
    }

    // disallow email updates via this endpoint
    if (Object.prototype.hasOwnProperty.call(updates, "email")) {
      return res.status(400).json({
        message:
          "Email cannot be changed here. Contact support to update your email.",
        code: "EMAIL_READ_ONLY",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Normalize existing user's region to lowercase
    if (typeof user.region === "string") {
      user.region = user.region.toLowerCase();
    }

    // --- Handle marketing opt-in separately ---
    if (updates.marketing && typeof updates.marketing === "object") {
      const marketingUpdate = updates.marketing;
      // Remove so it doesn't fall through into generic editable loop
      delete updates.marketing;

      const nextOptIn = !!marketingUpdate.optedIn;
      const prevOptIn =
        user.marketing && typeof user.marketing.optedIn === "boolean"
          ? user.marketing.optedIn
          : false;

      if (!user.marketing) {
        user.marketing = {};
      }

      if (nextOptIn && !prevOptIn) {
        // user is opting in now
        user.marketing.optedIn = true;
        user.marketing.optedInAt = new Date();
        const src = String(marketingUpdate.optedInSource || "settings");
        user.marketing.optedInSource = ["settings", "banner"].includes(src)
          ? src
          : "settings";
        subscribeToKit(user.email, user.trailname || '');
      } else if (!nextOptIn && prevOptIn) {
        // user is opting out
        user.marketing.optedIn = false;
        unsubscribeFromKit(user.email);
      }
    }

    // If they're changing password, handle separately
    if (updates.password) {
      if (typeof updates.password !== "string" || updates.password.length < 8) {
        return res
          .status(400)
          .json({ message: "Password must be at least 8 characters." });
      }
      if (!updates.currentPassword) {
        return res
          .status(400)
          .json({ message: "Current password required to change password." });
      }
      const ok = await user.validatePassword(updates.currentPassword);
      if (!ok) {
        return res.status(403).json({ message: "Wrong current password." });
      }
      await user.setPassword(updates.password);
      delete updates.password;
      delete updates.currentPassword;
    }

    // --- Handle trailname separately: validate, unique check, rate limit ---
    if (updates.trailname !== undefined) {
      const rawTrailname = updates.trailname;
      delete updates.trailname;

      const next = typeof rawTrailname === "string" ? rawTrailname.trim() : "";

      if (!next) {
        return res.status(400).json({ message: "Trail name cannot be empty.", code: "TRAILNAME_EMPTY" });
      }
      if (next.length < 2 || next.length > 30) {
        return res.status(400).json({ message: "Trail name must be 2–30 characters.", code: "TRAILNAME_LENGTH" });
      }
      if (!/^[a-zA-Z0-9_'-]+$/.test(next)) {
        return res.status(400).json({ message: "Trail name may only contain letters, numbers, hyphens, apostrophes, and underscores.", code: "TRAILNAME_CHARS" });
      }

      const currentTrailname = user.trailname || "";
      const isChanging = next.toLowerCase() !== currentTrailname.toLowerCase();

      if (isChanging) {
        // 30-day rate limit (admins are exempt)
        if (!user.isAdmin && user.trailnameChangedAt) {
          const daysSinceLast = (Date.now() - user.trailnameChangedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLast < 30) {
            const daysLeft = Math.ceil(30 - daysSinceLast);
            return res.status(429).json({
              message: `You can only change your trail name once every 30 days. Try again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
              code: "TRAILNAME_RATE_LIMIT",
              daysLeft,
            });
          }
        }

        // Uniqueness check (case-insensitive via collation)
        const conflict = await User.findOne(
          { _id: { $ne: user._id }, trailname: next },
          null,
          { collation: { locale: "en", strength: 2 } }
        ).lean();
        if (conflict) {
          return res.status(409).json({ message: "That trail name is already taken.", code: "TRAILNAME_TAKEN" });
        }

        user.trailnameChangedAt = new Date();
      }

      user.trailname = next;
      user.trailnameConfirmed = true;
    }

    const editable = [
      "viewMode",
      "locale",
      "theme",
      "weightUnit",
      "measurementSystem",
      "language",
      "region",
      "sidebarCollapsed",
      "sidebarGearListsCollapsed",
      "sidebarMyGearCollapsed",
    ];
    editable.forEach((key) => {
      if (updates[key] !== undefined) {
        user[key] = updates[key];
      }
    });

    await user.save();
    res.json({ message: "Settings updated.", trailname: user.trailname, trailnameConfirmed: user.trailnameConfirmed });
  } catch (err) {
    console.error("PATCH /settings error:", err);
    if (err && err.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid settings payload.",
        errors: Object.fromEntries(
          Object.entries(err.errors || {}).map(([k, v]) => [k, v?.message])
        ),
      });
    }
    // MongoDB duplicate key (race condition on trailname unique index)
    if (err && err.code === 11000 && err.keyPattern?.trailname) {
      return res.status(409).json({ message: "That trail name is already taken.", code: "TRAILNAME_TAKEN" });
    }
    res.status(500).json({ message: "Could not update settings." });
  }
});

module.exports = router;
