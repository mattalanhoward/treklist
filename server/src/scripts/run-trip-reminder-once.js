// server/src/scripts/run-trip-reminder-once.js
// =============================================================================
// Run the pre-trip reminder job ONCE (connects to DB, runs, disconnects).
// Useful for testing without waiting for the hourly scheduler.
//
// RUN:
//   cd server
//   node src/scripts/run-trip-reminder-once.js
//
// SAFETY:
//   - Sends REAL emails via the SMTP creds in .env to whatever DB MONGO_URI/
//     MONGO_DB_NAME point at. Point it at a local/staging DB while testing.
//   - To run without sending (verify the query/selection only), disable SMTP:
//       SMTP_HOST= node src/scripts/run-trip-reminder-once.js
//     (the mailer skips sending when SMTP isn't configured, but the job will
//      still mark tripReminderSentAt — so use a throwaway/staging DB.)
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const { runTripReminderEmailJob } = require("../jobs/tripReminderEmailJob");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  console.log(`Connected to MongoDB (db=${mongoose.connection.name})`);
  await runTripReminderEmailJob();
  await mongoose.disconnect();
  console.log("Done.");
})().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
