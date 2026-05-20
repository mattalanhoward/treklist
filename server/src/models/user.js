const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SUPPORTED_LANGS = ["en", "nl", "de", "fr", "it", "es"];
const SUPPORTED_REGIONS = ["nl", "us", "ca", "gb", "de", "fr", "it"];

const UserSchema = new mongoose.Schema(
  {
    // Optional marketing / email-updates preferences
    marketing: {
      optedIn: { type: Boolean, default: false },
      optedInAt: { type: Date },
      optedInSource: { type: String },
    },
    refreshTokens: {
      type: [String],
      default: [],
    },
    // When the user last successfully logged in
    lastLoginAt: {
      type: Date,
    },
    // When the user last made an authenticated API request
    lastActiveAt: {
      type: Date,
    },
    // Onboarding / tour state (server-backed so it persists across devices)
    onboarding: {
      tourVersionSeen: { type: Number, default: 0 },
      tourDismissedAt: { type: Date, default: null },
    },
    // If true, this account is blocked from logging in
    isDisabled: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    trailname: {
      type: String,
      required: false,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false, // Optional to support OAuth users (Google, etc.)
    },
    authProviders: {
      type: [
        {
          provider: {
            type: String,
            enum: ["google", "email"],
            required: true,
          },
          providerId: { type: String }, // Google user ID or null for email
          connectedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isVerified: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    verifyEmailToken: String,
    verifyEmailExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    favoriteCommunities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarGearListsCollapsed: { type: Boolean, default: false },
    sidebarMyGearCollapsed: { type: Boolean, default: false },
    viewMode: { type: String, enum: ["column", "list"], default: "column" },
    theme: { type: String, default: "light" },
    weightUnit: { type: String, enum: ["g", "oz"], default: "g" },
    measurementSystem: { type: String, enum: ["metric", "imperial"], default: "metric" },
    language: {
      type: String,
      enum: SUPPORTED_LANGS,
      default: "en",
    },

    region: {
      type: String,
      enum: SUPPORTED_REGIONS,
      default: "us",
    },

    locale: {
      type: String,
      default: "en-US",
    },
  },
  {
    timestamps: true,
  },
);

// Helper to set the password
UserSchema.methods.setPassword = async function (plainText) {
  const saltRounds = 10;
  this.passwordHash = await bcrypt.hash(plainText, saltRounds);
};

// Helper to check the password
UserSchema.methods.validatePassword = async function (plainText) {
  return bcrypt.compare(plainText, this.passwordHash);
};

// Check if user has password authentication
UserSchema.methods.hasPasswordAuth = function () {
  return Boolean(this.passwordHash);
};

// Check if user has Google authentication
UserSchema.methods.hasGoogleAuth = function () {
  return this.authProviders.some((p) => p.provider === "google");
};

// Add an authentication provider
UserSchema.methods.addAuthProvider = function (provider, providerId) {
  if (!this.authProviders.some((p) => p.provider === provider)) {
    this.authProviders.push({ provider, providerId });
  }
};

module.exports = mongoose.model("User", UserSchema);
