// server/src/routes/uploads.js

const express = require("express");
const auth = require("../middleware/auth");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

// All upload-signing routes require auth
router.use(auth);

/**
 * POST /api/uploads/cloudinary-signature
 * Returns signature for client-side direct upload.
 *
 * Body (optional):
 * - folder: override folder (we’ll keep it fixed server-side for safety)
 */
router.post("/cloudinary-signature", async (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    // Keep folder controlled server-side (don’t trust client)
    const folder = "gear-list-backgrounds";

    // You can add additional signed params here later if needed (e.g., eager)
    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      timestamp,
      signature,
      folder,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("Cloudinary signature error:", err);
    return res
      .status(500)
      .json({ message: "Could not create upload signature" });
  }
});

module.exports = router;
