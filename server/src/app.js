// server/src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const gearListRoutes = require("./routes/gearLists");
const publicShareRoutes = require("./routes/publicShare");
const authMiddleware = require("./middleware/auth");
const requireAdmin = require("./middleware/requireAdmin");
const categoriesRoutes = require("./routes/categories");
const gearItemRoutes = require("./routes/gearItems");
const globalItemsRoutes = require("./routes/globalItems");
const settingsRouter = require("./routes/settings");
const affiliatesRouter = require("./routes/affiliates");
const adminCatalogItemsRouter = require("./routes/adminCatalogItems");
const adminAmazon = require("./routes/adminAmazon");
const adminAwinImport = require("./routes/adminAwinImport");
const adminUsersRouter = require("./routes/adminUsers");
const adminPublicListsRouter = require("./routes/adminPublicLists");
const { publicShareLimiter } = require("./middleware/rateLimiters");
const passport = require("./config/passport");
const myGearRoutes = require("./routes/myGear");
const wishlistRoutes = require("./routes/wishlist");
const aiRoutes = require("./routes/ai");
const communityRoutes = require("./routes/communities");
const postsRoutes = require("./routes/posts");
const commentsRoutes = require("./routes/comments");
const notificationsRoutes = require("./routes/notifications");
const translateRoutes = require("./routes/translate");
const eventsRoutes = require("./routes/events");

const app = express();

/**
 * If the API is behind a proxy/ELB/CDN in production, enable trust proxy
 * so secure cookies and req.secure work correctly.
 * Set TRUST_PROXY=1 in production.
 */
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

/**
 * Security headers
 * (CSP can be added later once external domains are enumerated)
 */
app.use(helmet());

/**
 * CORS allow-list (env-driven)
 * Use CLIENT_URLS as a comma-separated list, e.g.:
 * CLIENT_URLS=http://localhost:5173,http://127.0.0.1:5173,https://treklist.netlify.app
 */
const parseOrigins = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://treklist.netlify.app",
  "https://treklist.co",
  "https://www.treklist.co",
  "https://app.treklist.co",
  "https://treklist-marketing.netlify.app",
];

const envOrigins = parseOrigins(process.env.CLIENT_URLS);
const allowedOrigins = new Set(envOrigins.length ? envOrigins : defaultOrigins);

const corsOptions = {
  origin(origin, callback) {
    // allow requests with no origin (curl, mobile apps) and same-origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Preflight
app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Initialize Passport for OAuth
app.use(passport.initialize());

// Mount routers — each must be a function (router)
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", authMiddleware, gearListRoutes);
app.use("/api/dashboard/:listId/categories", authMiddleware, categoriesRoutes);
app.use(
  "/api/dashboard/:listId/categories/:catId/items",
  authMiddleware,
  gearItemRoutes,
);
app.use("/api/public/share", publicShareLimiter, publicShareRoutes);
app.use("/api/global/items", authMiddleware, globalItemsRoutes);
app.use("/api/my-gear", myGearRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/affiliates", authMiddleware, affiliatesRouter); // auth required
app.use(
  "/api/admin/catalog-items",
  authMiddleware,
  requireAdmin,
  adminCatalogItemsRouter,
);
app.use("/api/admin/amazon", authMiddleware, requireAdmin, adminAmazon);
app.use("/api/admin/awin",   authMiddleware, requireAdmin, adminAwinImport);
app.use("/api/admin/users", authMiddleware, requireAdmin, adminUsersRouter);
app.use(
  "/api/admin/public-lists",
  authMiddleware,
  requireAdmin,
  adminPublicListsRouter,
);

app.use("/api/catalog", require("./routes/catalog"));
app.use("/api/uploads", require("./routes/uploads"));
app.use("/api/ai", authMiddleware, aiRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/community", postsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/posts/:postId/comments", commentsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/notifications", authMiddleware, notificationsRoutes);
app.use("/api/admin/community", authMiddleware, requireAdmin, require("./routes/adminCommunity"));
app.use("/api/admin/reports", authMiddleware, requireAdmin, require("./routes/adminReports"));
app.use("/api/translate", translateRoutes);
// Pane-view telemetry, read back only by the admin user timeline.
app.use("/api/events", authMiddleware, eventsRoutes);

app.use("/sitemap.xml", require("./routes/sitemap"));

// Central error handler
app.use((err, req, res, next) => {
  console.error("🔴 Unhandled server error:", err.stack || err);
  res.status(500).json({ message: "Something went wrong." });
});

// ---- MongoDB connection ----
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error("❌ No MONGO_URI defined in environment!");
  process.exit(1);
}

mongoose
  .connect(mongoURI, {
    dbName: process.env.MONGO_DB_NAME, // <— forces the DB even if URI lacks /dbname
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log(`✅ Connected to MongoDB (db=${mongoose.connection.name})`);

    // Start cron jobs after DB is connected (production or explicit opt-in)
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ENABLE_CRON === "1"
    ) {
      const {
        startImageRefreshCron,
      } = require("./services/amazonImageRefresh");
      startImageRefreshCron();
    }
  })
  .catch((err) => console.error("❌ Mongo connection error:", err));

module.exports = app;
