// server/src/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const { promisify } = require("util");

const User = require("../models/user");

const router = express.Router();
router.use(cookieParser());

// ---- Config & constants ----
const JWT_EXP = process.env.JWT_EXP || "7d";
const SUPPORTED_REGIONS = ["nl", "us", "ca", "gb", "de", "fr", "it"];
const SUPPORTED_LANGS = ["en", "nl", "de", "fr", "it", "es"];

function normalizeRegionInput(r) {
  const v = String(r || "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  if (v === "us") return "us";
  return v;
}
function normalizeLangInput(l) {
  return String(l || "")
    .trim()
    .toLowerCase();
}

const REFRESH_TOKEN_EXP_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const isProd = process.env.NODE_ENV === "production";

const {
  registerLimiter,
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter,
  resendVerificationLimiter,
  resendVerificationEmailLimiter,
  loginLimiter,
} = require("../middleware/rateLimiters");

// Cross-site compatible cookie in prod (SameSite=None; Secure)
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  path: "/", // ensure refresh/logout can clear consistently
  maxAge: REFRESH_TOKEN_EXP_MS,
};

// ---- Mailer ----
const smtpPort = Number(process.env.SMTP_PORT || 465);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465, // 465 = implicit TLS, 587 = STARTTLS
  requireTLS: smtpPort === 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --- Client URL selection (robust to comma-separated envs) ---
function parseOriginsString(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function selectClientBaseUrl() {
  const single = (process.env.CLIENT_URL || "").trim();
  if (single) {
    const first = single.includes(",") ? single.split(",")[0].trim() : single;
    return first.replace(/\/+$/, "");
  }
  const list = parseOriginsString(process.env.CLIENT_URLS);
  if (list.length) {
    const isProd = process.env.NODE_ENV === "production";
    const pick = isProd
      ? list.find((u) => u.startsWith("https://")) || list[0]
      : list.find((u) => u.includes("localhost")) || list[0];
    return pick.replace(/\/+$/, "");
  }
  return "http://localhost:5173";
}
const CLIENT_BASE_URL = selectClientBaseUrl();
function clientUrl(pathAndQuery) {
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  return `${CLIENT_BASE_URL}${path}`;
}

// Only allow same-origin paths for `next` to avoid open-redirects.
function sanitizeNextParam(n) {
  if (!n || typeof n !== "string") return null;
  if (!n.startsWith("/")) return null; // must be a relative path
  if (n.length > 1024) return null; // basic length guard
  return n;
}

async function sendVerificationEmail(email, token, nextPath) {
  const safeNext = sanitizeNextParam(nextPath);
  const query = safeNext
    ? `?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext)}`
    : `?token=${encodeURIComponent(token)}`;
  const url = clientUrl(`/verify-email${query}`);
  await transporter.sendMail({
    from: `"TrekList" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Please verify your email",
    html: `<p>Click the link below to verify your email:</p><a href="${url}">${url}</a><p>Expires in 24h.</p>`,
  });
}

async function sendPasswordResetEmail(email, token) {
  const url = clientUrl(`/reset-password?token=${token}`);
  const expSec = Number(process.env.RESET_TOKEN_EXP) || 3600; // default 1h
  const expHrs = expSec / 3600;
  await transporter.sendMail({
    from: `"TrekList" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password:</p><a href="${url}">${url}</a><p>Expires in ${expHrs}h.</p>`,
  });
}

// ---- Helpers ----
function issueTokens(user) {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXP }
  );
  const refreshToken = crypto.randomBytes(40).toString("hex");
  user.refreshTokens.push(refreshToken);
  return { accessToken, refreshToken };
}

async function sendTokenResponse(res, user, { accessToken, refreshToken }) {
  await user.save();
  res
    .cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS)
    .json({ accessToken });
}

// middleware to verify JWT on the Authorization header
async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed token." });
  }
  const token = auth.split(" ")[1];
  try {
    const payload = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

// --- Routes ---

// GET /auth/me — returns the current user’s public profile
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "email trailname isAdmin"
    );
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not retrieve user." });
  }
});

// Forgot password
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter,
  async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({
      email: normalizedEmail,
    });

    // Always respond the same to avoid email enumeration
    if (!user) {
      return res.json({
        message:
          "If an account exists for that email, you’ll receive a password reset email shortly.",
      });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const resetExpSec = Number(process.env.RESET_TOKEN_EXP) || 3600; // default 1h
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + resetExpSec * 1000;
    await user.save();

    await sendPasswordResetEmail(normalizedEmail, token);
    return res.json({
      message:
        "If an account exists for that email, you’ll receive a password reset email shortly.",
    });
  }
);

// Reset password
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user)
    return res.status(400).json({ message: "Invalid or expired token." });

  await user.setPassword(newPassword);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ message: "Password has been reset." });
});

// Register
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, trailname, password, acceptTerms, marketingOptIn, next } =
      req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    if (!email || !password) {
      return res.status(400).json({
        message: "Email & password are required.",
      });
    }

    // Require explicit terms acceptance (separate from marketing)
    if (!acceptTerms) {
      return res.status(400).json({
        message:
          "You must accept the Terms of Use and Privacy Policy to create an account.",
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const user = new User({
      email: normalizedEmail,
      // trailname is optional; only set it if provided
      ...(trailname ? { trailname } : {}),
      isVerified: false,
    });

    // Optional client-provided prefs (first-visit detection)
    const regionIn = normalizeRegionInput(req.body.region);
    const langIn = normalizeLangInput(req.body.language);
    if (SUPPORTED_REGIONS.includes(regionIn)) user.region = regionIn;
    if (SUPPORTED_LANGS.includes(langIn)) user.language = langIn;

    // Prefer explicit locale if valid, else derive from language+region
    const localeIn = String(req.body.locale || "").trim();
    const derivedLocale = `${user.language || "en"}-${String(
      user.region || "nl"
    ).toUpperCase()}`;

    // Only accept client locale if it matches the final chosen language/region
    if (/^[a-z]{2}-[A-Z]{2}$/.test(localeIn) && localeIn === derivedLocale) {
      user.locale = localeIn;
    } else {
      user.locale = derivedLocale;
    }

    // Optional marketing consent at registration
    if (marketingOptIn) {
      user.marketing = {
        optedIn: true,
        optedInAt: new Date(),
        optedInSource: "register",
      };
    }

    await user.setPassword(password);

    const verifyToken = crypto.randomBytes(20).toString("hex");
    user.verifyEmailToken = verifyToken;
    user.verifyEmailExpires = Date.now() + 24 * 60 * 60 * 1000;

    await user.save();

    // Pass `next` through; sendVerificationEmail will sanitize it
    await sendVerificationEmail(email, verifyToken, next);
    res.status(201).json({ message: "Registered! Check your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration error." });
  }
});

// Verify email (and issue tokens)
router.post("/verify-email", async (req, res) => {
  const { token } = req.body;
  const user = await User.findOne({
    verifyEmailToken: token,
    verifyEmailExpires: { $gt: Date.now() },
  });
  if (!user)
    return res.status(400).json({ message: "Invalid or expired token." });

  user.isVerified = true;
  user.verifyEmailToken = undefined;
  user.verifyEmailExpires = undefined;

  const tokens = issueTokens(user);

  // mark this as a successful login as well
  user.lastLoginAt = new Date();

  await sendTokenResponse(res, user, tokens);
});

// Resend verification email
router.post(
  "/resend-verification",
  resendVerificationLimiter,
  resendVerificationEmailLimiter,
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await User.findOne({
        email: normalizedEmail,
      });
      // Avoid email enumeration: respond generically even if not found
      if (!user) {
        return res.json({
          message:
            "If an account exists for that email and it is not verified, you’ll receive a verification email shortly.",
        });
      }

      // If already verified, still respond generically (avoid leaks)
      if (user.isVerified) {
        return res.json({
          message:
            "If an account exists for that email and it is not verified, you’ll receive a verification email shortly.",
        });
      }

      // Generate a fresh verification token and expiration
      const verifyToken = crypto.randomBytes(20).toString("hex");
      user.verifyEmailToken = verifyToken;
      user.verifyEmailExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h

      await user.save();

      // We don't need a `next` param here; the user is already in the flow.
      await sendVerificationEmail(user.email, verifyToken, null);

      return res.json({
        message:
          "If an account exists for that email and it is not verified, you’ll receive a verification email shortly.",
      });
    } catch (err) {
      console.error("Error in /auth/resend-verification:", err);
      return res
        .status(500)
        .json({ message: "Could not resend verification email." });
    }
  }
);

// Login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email & password are required." });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // 🔹 NEW: block disabled accounts
    if (user.isDisabled) {
      return res.status(403).json({
        message:
          "This account has been disabled. Contact support if you think this is a mistake.",
      });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email first." });
    }

    // 🔹 Issue tokens as before
    const tokens = issueTokens(user);

    // 🔹 NEW: update lastLoginAt — sendTokenResponse will save the user
    user.lastLoginAt = new Date();

    await sendTokenResponse(res, user, tokens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error." });
  }
});

// Refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).end();

    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) return res.status(403).end();

    // rotate
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    const tokens = issueTokens(user);
    await sendTokenResponse(res, user, tokens);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      await User.updateOne(
        { refreshTokens: refreshToken },
        { $pull: { refreshTokens: refreshToken } }
      );
    }
    // Clear with matching options
    res
      .clearCookie("refreshToken", {
        httpOnly: true,
        sameSite: REFRESH_COOKIE_OPTS.sameSite,
        secure: REFRESH_COOKIE_OPTS.secure,
        path: REFRESH_COOKIE_OPTS.path,
      })
      .status(204)
      .end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

router.authenticate = authenticate;
module.exports = router;
