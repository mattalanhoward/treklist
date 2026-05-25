const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return next();

  try {
    const payload = jwt.verify(parts[1], process.env.JWT_SECRET);
    req.userId = payload.userId;
  } catch (_) {}

  next();
};
