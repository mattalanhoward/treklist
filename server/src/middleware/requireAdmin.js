const User = require("../models/user");

module.exports = async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("isAdmin");
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required." });
    }
    next();
  } catch (err) {
    console.error("requireAdmin error", err);
    res.status(500).json({ message: "Server error." });
  }
};
