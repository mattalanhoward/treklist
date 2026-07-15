// server/src/routes/adminReports.js
//
// Admin QA surface for the add-gear feature: the crowd-sourced catalog report
// queue (deduped item+field with a counter) and the zero-result search log.
// Mounted behind auth + requireAdmin in app.js.
const express = require("express");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const CatalogReport = require("../models/catalogReport");
const SearchLog = require("../models/searchLog");

const router = express.Router();

// GET /api/admin/reports
// Catalog report queue, hottest first. ?status=open|resolved|all (default open).
router.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "open");
    const filter = status === "all" ? {} : { status };
    const reports = await CatalogReport.find(filter)
      .sort({ count: -1, lastReportedAt: -1 })
      .limit(500)
      .populate("catalogItem", "brand name category itemType weightGrams imageUrls")
      .lean();
    res.json({ reports });
  } catch (err) {
    console.error("GET /admin/reports error:", err);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

// PATCH /api/admin/reports/:id
// Flip a report's status ({ status: "open" | "resolved" }).
router.patch("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid report id" });
    }
    const status = req.body?.status === "resolved" ? "resolved" : "open";
    const report = await CatalogReport.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true },
    ).lean();
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ report });
  } catch (err) {
    console.error("PATCH /admin/reports/:id error:", err);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// GET /api/admin/reports/search-log
// Zero-result search queries, most-demanded first.
router.get("/search-log", async (req, res) => {
  try {
    const queries = await SearchLog.find({})
      .sort({ count: -1, lastSeenAt: -1 })
      .limit(500)
      .lean();
    res.json({ queries });
  } catch (err) {
    console.error("GET /admin/reports/search-log error:", err);
    res.status(500).json({ error: "Failed to load search log" });
  }
});

module.exports = router;
