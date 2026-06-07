// server/src/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const { promisify } = require("util");

const User = require("../models/user");
const Community = require("../models/community");

// ✅ Reuse shared mailer (single source of truth)
// Adjust the path if your mailer lives elsewhere.
const { sendSupportEmail } = require("../utils/mailer");
const { subscribeToKit, unsubscribeFromKit } = require("../utils/kitSubscribe");
const { detectRegionFromIp, getClientIp, normalizeIp } = require("../utils/regionDetection");

const router = express.Router();
router.use(cookieParser());

// ---- Config & constants ----
const JWT_EXP = process.env.JWT_EXP || "7d";
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
  oauthLimiter,
} = require("../middleware/rateLimiters");

// Passport for OAuth
const passport = require("../config/passport");

// Cross-site compatible cookie in prod (SameSite=None; Secure)
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  path: "/", // ensure refresh/logout can clear consistently
  maxAge: REFRESH_TOKEN_EXP_MS,
};

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

// ---- Email helpers (use shared mailer) ----
async function sendVerificationEmail(email, token, nextPath) {
  const safeNext = sanitizeNextParam(nextPath);
  const query = safeNext
    ? `` +
      `?token=${encodeURIComponent(token)}` +
      `&next=${encodeURIComponent(safeNext)}`
    : `?token=${encodeURIComponent(token)}`;

  const url = clientUrl(`/verify-email${query}`);

  // keep branding consistent; SMTP_FROM can override this in env
  const from = process.env.SMTP_FROM || `"TrekList" <${process.env.SMTP_USER}>`;

  await sendSupportEmail({
    to: email,
    subject: "Please verify your email",
    text: `Welcome to TrekList!\n\nThank you for signing up. Please verify your email address to complete your registration and start organizing your gear.\n\nVerify your email by opening this link:\n${url}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, you can safely ignore this email.\n\nHappy trails,\nThe TrekList Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Welcome to TrekList!</h2>
        <p>Thank you for signing up. Please verify your email address to complete your registration and start organizing your gear.</p>
        <p style="margin: 24px 0;">
          <a href="${url}" style="background-color: #2d5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email Address</a>
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you did not create an account, you can safely ignore this email.</p>
        <p style="margin-top: 24px;">Happy trails,<br>The TrekList Team</p>
      </div>
    `,
    // NOTE: sendSupportEmail uses SMTP_FROM internally; we keep this here for clarity.
    // If you want per-email "from", upgrade mailer.js to accept a from override.
    // For now SMTP_FROM should be set to: TrekList <support@treklist.co> or similar.
  });

  // If you want the FROM to be guaranteed per email, update mailer.js to accept "from".
  // (Right now your mailer.js chooses SMTP_FROM or SMTP_USER.)
}

async function sendPasswordResetEmail(email, token) {
  const url = clientUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const expSec = Number(process.env.RESET_TOKEN_EXP) || 3600; // default 1h
  const expHrs = expSec / 3600;

  await sendSupportEmail({
    to: email,
    subject: "Reset your password",
    text: `TrekList Password Reset\n\nWe received a request to reset your password. Click the link below to create a new password:\n\n${url}\n\nThis link will expire in ${expHrs} hour(s).\n\nIf you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.\n\nHappy trails,\nThe TrekList Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${url}" style="background-color: #2d5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in ${expHrs} hour(s).</p>
        <p style="color: #666; font-size: 14px;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        <p style="margin-top: 24px;">Happy trails,<br>The TrekList Team</p>
      </div>
    `,
  });
}

// ---- One-time OAuth code store ----
const OAUTH_CODE_TTL_MS = 60_000; // 60 seconds
const oauthCodes = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of oauthCodes) {
    if (now - entry.createdAt > OAUTH_CODE_TTL_MS) oauthCodes.delete(code);
  }
}, 60_000).unref();

// ---- Helpers ----
function issueTokens(user) {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXP },
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
      "email trailname trailnameConfirmed isAdmin onboarding",
    );
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not retrieve user." });
  }
});

// POST /auth/onboarding/tour-seen
// Marks the tour as seen for this user (server-backed so it doesn't replay on other devices).
router.post("/onboarding/tour-seen", authenticate, async (req, res) => {
  try {
    const { tourVersion } = req.body || {};
    const v = Number(tourVersion || 1);

    // basic guard
    if (!Number.isFinite(v) || v < 1 || v > 1000) {
      return res.status(400).json({ message: "Invalid tourVersion." });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.onboarding = user.onboarding || {};
    // Only move forward (never decrease)
    user.onboarding.tourVersionSeen = Math.max(
      Number(user.onboarding.tourVersionSeen || 0),
      v,
    );
    user.onboarding.tourDismissedAt = new Date();

    await user.save();

    return res.json({
      ok: true,
      onboarding: user.onboarding,
    });
  } catch (err) {
    console.error("Error in POST /auth/onboarding/tour-seen:", err);
    return res.status(500).json({ message: "Could not update onboarding." });
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
  },
);

// Reset password
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters.",
    });
  }

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

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    // Require explicit terms acceptance (separate from marketing)
    if (!acceptTerms) {
      return res.status(400).json({
        message:
          "You must accept the Terms of Use and Privacy Policy to create an account.",
      });
    }

    const trimmedTrailname = typeof trailname === "string" ? trailname.trim() : "";
    if (!trimmedTrailname) {
      return res.status(400).json({ message: "Trail name is required.", code: "TRAILNAME_EMPTY" });
    }
    if (trimmedTrailname.length < 2 || trimmedTrailname.length > 30) {
      return res.status(400).json({ message: "Trail name must be 2–30 characters.", code: "TRAILNAME_LENGTH" });
    }
    if (!/^[a-zA-Z0-9_'-]+$/.test(trimmedTrailname)) {
      return res.status(400).json({ message: "Trail name may only contain letters, numbers, hyphens, apostrophes, and underscores.", code: "TRAILNAME_CHARS" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      // Check if user has Google auth but no password
      if (existingUser.hasGoogleAuth() && !existingUser.hasPasswordAuth()) {
        return res.status(409).json({
          message:
            "This email is registered with Google. Please sign in with Google or reset your password to add a password.",
          provider: "google",
        });
      }
      return res.status(409).json({ message: "Email already in use." });
    }

    const user = new User({
      email: normalizedEmail,
      trailname: trimmedTrailname,
      trailnameConfirmed: !!trimmedTrailname,
      isVerified: false,
      authProviders: [
        {
          provider: "email",
          providerId: null,
          connectedAt: new Date(),
        },
      ],
    });

    // Optional client-provided prefs (first-visit detection)
    const regionIn = normalizeRegionInput(req.body.region);
    const langIn = normalizeLangInput(req.body.language);
    // Accept any valid 2-letter country code from the client
    if (/^[a-z]{2}$/.test(regionIn)) {
      user.region = regionIn;
    } else {
      // Fall back to IP-based country detection
      const ipCountry = detectRegionFromIp(getClientIp(req));
      if (ipCountry && ipCountry !== "global") user.region = ipCountry;
    }
    if (SUPPORTED_LANGS.includes(langIn)) user.language = langIn;

    // Prefer explicit locale if valid, else derive from language+region
    const localeIn = String(req.body.locale || "").trim();
    const derivedLocale = `${user.language || "en"}-${String(
      user.region || "us",
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

    const defaultCommunity = await Community.findOne({ slug: "treklist-help" }).select("_id").lean();
    if (defaultCommunity) user.favoriteCommunities = [defaultCommunity._id];

    await user.save();

    // Pass `next` through; sendVerificationEmail will sanitize it
    await sendVerificationEmail(normalizedEmail, verifyToken, next);
    res.status(201).json({ message: "Registered! Check your email." });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000 && err?.keyPattern?.trailname) {
      return res.status(409).json({ message: "That trail name is already taken. Please choose a different one.", code: "TRAILNAME_TAKEN" });
    }
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

  if (user.marketing?.optedIn) {
    subscribeToKit(user.email, user.trailname || '');
  }

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
  },
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

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check if user has Google-only authentication (no password)
    if (!user.hasPasswordAuth()) {
      return res.status(401).json({
        message:
          "This account uses Google sign-in. Please use 'Continue with Google'.",
        provider: "google",
      });
    }

    if (!(await user.validatePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // block disabled accounts
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

    // Issue tokens as before
    const tokens = issueTokens(user);

    // update lastLoginAt — sendTokenResponse will save the user
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

    if (user.isDisabled) {
      user.refreshTokens = [];
      await user.save();
      return res.status(403).end();
    }

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
        { $pull: { refreshTokens: refreshToken } },
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

// ---- Google OAuth ----

// Initialize Passport
router.use(passport.initialize());

// Google OAuth initiation
router.get(
  "/google",
  oauthLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${CLIENT_BASE_URL}/?authError=google_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${CLIENT_BASE_URL}/?authError=no_user`);
      }

      // Generate a one-time code; real tokens are issued at /auth/exchange
      const code = crypto.randomBytes(32).toString("hex");
      oauthCodes.set(code, { userId: user._id, createdAt: Date.now() });

      res.redirect(`${CLIENT_BASE_URL}/auth/callback?code=${code}`);
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${CLIENT_BASE_URL}/?authError=token_issue_failed`);
    }
  }
);

// Exchange a one-time OAuth code for tokens
router.post("/exchange", oauthLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Missing code." });
    }

    const entry = oauthCodes.get(code);
    oauthCodes.delete(code); // one-time use regardless of outcome

    if (!entry || Date.now() - entry.createdAt > OAUTH_CODE_TTL_MS) {
      return res.status(403).json({ message: "Invalid or expired code." });
    }

    const user = await User.findById(entry.userId);
    if (!user || user.isDisabled) {
      return res.status(403).json({ message: "Account unavailable." });
    }

    const tokens = issueTokens(user);
    user.lastLoginAt = new Date();
    await sendTokenResponse(res, user, tokens);
  } catch (err) {
    console.error("POST /auth/exchange error:", err);
    res.status(500).json({ message: "Token exchange failed." });
  }
});

// GET /auth/unsubscribe-onboarding?uid=...&sig=...
// One-click unsubscribe for transactional onboarding emails (no login required)
router.get("/unsubscribe-onboarding", async (req, res) => {
  const { uid, sig } = req.query;
  if (!uid || !sig) {
    return res.status(400).send("Invalid unsubscribe link.");
  }

  const expected = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(uid)
    .digest("hex")
    .slice(0, 32);

  if (sig !== expected) {
    return res.status(400).send("Invalid unsubscribe link.");
  }

  let userEmail;
  try {
    const user = await User.findByIdAndUpdate(
      uid,
      {
        $set: {
          "onboarding.transactionalOptOut": true,
          "marketing.optedIn": false,
        },
      },
      { new: false, select: "email" }
    );
    userEmail = user?.email;
  } catch {
    return res.status(500).send("Something went wrong. Please try again.");
  }

  if (userEmail) {
    unsubscribeFromKit(userEmail).catch(() => {}); // fire-and-forget
  }

  // Redirect to the client with a confirmation flag
  const base = (process.env.APP_URL || process.env.CLIENT_URL || process.env.CLIENT_URLS || "").split(",")[0].trim();
  return res.redirect(`${base}/?unsubscribed=1`);
});

// GET /auth/unsubscribe-notifications?uid=...&sig=...
// One-click unsubscribe for community reply notification emails (no login required)
router.get("/unsubscribe-notifications", async (req, res) => {
  const { uid, sig } = req.query;
  if (!uid || !sig) {
    return res.status(400).send("Invalid unsubscribe link.");
  }

  const expected = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`notif:${uid}`)
    .digest("hex")
    .slice(0, 32);

  if (sig !== expected) {
    return res.status(400).send("Invalid unsubscribe link.");
  }

  try {
    await User.findByIdAndUpdate(uid, {
      $set: { "notifications.emailEnabled": false },
    });
  } catch {
    return res.status(500).send("Something went wrong. Please try again.");
  }

  const base = (process.env.APP_URL || process.env.CLIENT_URL || process.env.CLIENT_URLS || "").split(",")[0].trim();
  return res.redirect(`${base}/?unsubscribed=notifications`);
});

router.authenticate = authenticate;
router.sendVerificationEmail = sendVerificationEmail;
module.exports = router;
