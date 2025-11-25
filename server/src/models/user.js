const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
  {
    refreshTokens: {
      type: [String],
      default: [],
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
      required: true,
    },
    isVerified: { type: Boolean, default: false },
    verifyEmailToken: String,
    verifyEmailExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    sidebarCollapsed: { type: Boolean, default: false },
    viewMode: { type: String, enum: ["column", "list"], default: "column" },
    locale: { type: String, default: "en-NL" },
    currency: { type: String, default: "EUR" },
    theme: { type: String, default: "alpine" },
    weightUnit: { type: String, enum: ["g", "oz"], default: "g" },
    language: { type: String, default: "en" },
    region: {
      type: String,
      enum: ["nl", "us", "ca", "gb", "de", "fr", "it"],
      default: "nl",
    },
  },
  {
    timestamps: true,
  }
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

module.exports = mongoose.model("User", UserSchema);
