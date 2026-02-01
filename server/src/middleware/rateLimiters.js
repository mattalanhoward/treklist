// server/src/middleware/rateLimiters.js
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const isTest = process.env.NODE_ENV === "test";

function makeLimiter({ windowMs, max, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,

    // Don’t break Jest runs (you use jest --runInBand)
    skip: () => isTest,

    handler: (req, res) => {
      return res.status(429).json({
        message: message || "Too many requests. Please try again later.",
      });
    },
  });
}

// Conservative defaults (tweak later)
const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 register attempts per IP per hour
  message: "Too many registration attempts. Try again later.",
});

const forgotPasswordLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many password reset requests. Try again later.",
});

const resendVerificationLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many resend requests. Try again later.",
});

// Optional (not required by your note, but usually worth doing)
const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many login attempts. Try again later.",
});

const normalizeEmail = (raw) =>
  String(raw || "")
    .trim()
    .toLowerCase();

const forgotPasswordEmailLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 resets per email per hour
  message: "Too many password reset requests for this email. Try again later.",
  keyGenerator: (req) => {
    const e = normalizeEmail(req.body?.email);
    return e ? `fp_email:${e}` : `fp_ip:${ipKeyGenerator(req.ip)}`;
  },
});

const resendVerificationEmailLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many resend requests for this email. Try again later.",
  keyGenerator: (req) => {
    const e = normalizeEmail(req.body?.email);
    return e ? `rv_email:${e}` : `rv_ip:${ipKeyGenerator(req.ip)}`;
  },
});

const publicShareLimiter = makeLimiter({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  message: "Too many requests. Please try again later.",
});

// Gentle per-IP limiter (defense-in-depth; you already limit other routes)
const resolveLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Too many resolve requests. Please try again later.",
});

// Rate limit: 90 req / 5 min per IP for product search
const searchLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 90,
  message: "Too many search requests. Please try again later.",
});

// OAuth rate limiter (Google, etc.)
const oauthLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many OAuth attempts. Please try again later.",
});

module.exports = {
  registerLimiter,
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter,
  resendVerificationLimiter,
  resendVerificationEmailLimiter,
  loginLimiter,
  publicShareLimiter,
  searchLimiter,
  resolveLimiter,
  oauthLimiter,
};
