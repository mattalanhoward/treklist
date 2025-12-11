// server/src/middleware/requireAdmin.js
const User = require("../models/user");

async function requireAdmin(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // If auth middleware already attached a user object with isAdmin, reuse it.
    if (req.user && typeof req.user.isAdmin === "boolean") {
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: "Admin access required." });
      }
      return next();
    }

    const user = await User.findById(req.userId).select("isAdmin");
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required." });
    }

    // Attach for downstream routes if needed
    if (!req.user) {
      req.user = user;
    }

    return next();
  } catch (err) {
    console.error("Admin check failed:", err);
    return res.status(500).json({ message: "Failed to verify admin access." });
  }
}

module.exports = requireAdmin;
