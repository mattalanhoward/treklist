// server/src/utils/tokenHash.js
// =============================================================================
// Token hashing for at-rest storage (Finding F1)
// =============================================================================
//
// resetPasswordToken, verifyEmailToken and refreshTokens[] are high-entropy
// random values (crypto.randomBytes). We persist only their SHA-256 hash so a
// DB read cannot be replayed to reset a password, verify/hijack an account, or
// take over a session. The raw token is still what we email / set in the cookie;
// lookups hash the incoming value before querying.
//
// Plain (unsalted) SHA-256 is appropriate here precisely because the inputs are
// high-entropy and unguessable — unlike passwords, they don't need bcrypt/salt.

const crypto = require("crypto");

// A stored value is "hashed" iff it's a 64-char hex string. Raw tokens are
// randomBytes(20)->40 hex or randomBytes(40)->80 hex, never 64. Used by the
// migration to stay idempotent and by transitional legacy lookups.
const HASHED_TOKEN_RE = /^[0-9a-f]{64}$/;

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function isHashedToken(value) {
  return typeof value === "string" && HASHED_TOKEN_RE.test(value);
}

module.exports = { hashToken, isHashedToken };
