const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

// Serialize user ID into session (minimal data)
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
      scope: ["profile", "email"],
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Get email from Google profile
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("No email provided by Google"), null);
        }

        const googleId = profile.id;
        const normalizedEmail = email.toLowerCase().trim();

        // Find existing user by email
        let user = await User.findOne({ email: normalizedEmail });

        if (user) {
          // User exists - link Google if not already linked
          if (!user.hasGoogleAuth()) {
            user.addAuthProvider("google", googleId);
            await user.save();
            console.log("Linked Google account to existing user:", normalizedEmail);
          }
        } else {
          // Create new user with Google authentication
          user = new User({
            email: normalizedEmail,
            authProviders: [
              {
                provider: "google",
                providerId: googleId,
                connectedAt: new Date(),
              },
            ],
            isVerified: true, // Google emails are pre-verified
            trailname: profile.displayName || null,
          });

          await user.save();
          console.log("Created new user via Google OAuth:", normalizedEmail);
        }

        return done(null, user);
      } catch (err) {
        console.error("Google OAuth error:", err);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
