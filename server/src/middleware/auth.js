const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Throttle: only update lastActiveAt once per 15 minutes per user
const ACTIVE_THROTTLE_MS = 15 * 60 * 1000;
const lastActiveCache = new Map();

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: 'Missing Authorization header' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res
      .status(401)
      .json({ message: 'Invalid Authorization format' });
  }

  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;   // attach userId for use in handlers

    // Throttled lastActiveAt update (fire-and-forget, never blocks the request).
    // Skip passive background polls (the notification bell polls every 15s on
    // every authenticated page) so "last seen" reflects genuine requests.
    const isPassivePoll = (req.originalUrl || "").startsWith("/api/notifications");
    const now = Date.now();
    const lastWritten = lastActiveCache.get(payload.userId) || 0;
    if (!isPassivePoll && now - lastWritten > ACTIVE_THROTTLE_MS) {
      lastActiveCache.set(payload.userId, now);
      User.updateOne(
        { _id: payload.userId },
        { $set: { lastActiveAt: new Date(now) } }
      ).catch(() => {});
    }

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: 'Invalid or expired token' });
  }
};
