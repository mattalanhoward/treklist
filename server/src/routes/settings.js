// server/routes/settings.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authenticate } = require("./auth"); // import your JWT middleware

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
      viewMode,
      locale,
      currency,
      theme,
      weightUnit,
      language,
      region,
      sidebarCollapsed,
      marketing,
    } = user;

    res.json({
      email,
      trailname,
      viewMode,
      locale,
      currency,
      theme,
      weightUnit,
      language,
      region: (region && String(region).toLowerCase()) || "nl",
      sidebarCollapsed: !!sidebarCollapsed,
      marketing: {
        // always return a boolean; treat missing doc as false
        optedIn: marketing?.optedIn || false,
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

    // normalize region to lowercase if present
    if (updates.region && typeof updates.region === "string") {
      updates.region = updates.region.toLowerCase();
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

    // --- IMPORTANT: normalize the existing user's region too ---
    if (
      typeof user.region === "string" &&
      user.region !== user.region.toLowerCase()
    ) {
      user.region = user.region.toLowerCase();
    }
    if (!user.region) {
      user.region = "nl";
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
        user.marketing.optedInSource = "settings";
      } else if (!nextOptIn && prevOptIn) {
        // user is opting out
        user.marketing.optedIn = false;
        // keep optedInAt/source for history; we can wipe later if we prefer
      }
    }

    // If they’re changing password, handle separately
    if (updates.password) {
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

    const editable = [
      "trailname",
      "viewMode",
      "locale",
      "currency",
      "theme",
      "weightUnit",
      "language",
      "region",
      "sidebarCollapsed",
    ];
    editable.forEach((key) => {
      if (updates[key] !== undefined) {
        user[key] = updates[key];
      }
    });

    await user.save();
    res.json({ message: "Settings updated." });
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
    res.status(500).json({ message: "Could not update settings." });
  }
});

module.exports = router;
