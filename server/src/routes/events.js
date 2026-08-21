// server/src/routes/events.js
//
// Write-only endpoint for the behavioural log behind the admin user timeline.
// There is no GET here on purpose: the only reader is the admin activity route
// (routes/adminUsers.js), which is already behind requireAdmin.
const express = require("express");
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;
const UserEvent = require("../models/userEvent");
const { eventsLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// Repeat views of the same thing inside this window are the same visit — a
// remount, a StrictMode double-effect, a back gesture. The client dedupes too;
// this is the backstop that keeps the collection honest.
const DEDUPE_MS = 30_000;

const DETAIL_MAX = 60;

/**
 * POST /api/events
 * Body: { type, pane, listId?, detail? }
 *
 * Fire-and-forget from the client, so this always answers 204 — a rejected or
 * deduped event is not something the UI should ever have to handle.
 */
router.post("/", eventsLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.type || "");
    const pane = String(body.pane || "");

    if (!UserEvent.EVENT_TYPES.includes(type)) return res.status(204).end();
    if (!UserEvent.PANES.includes(pane)) return res.status(204).end();

    const listId =
      body.listId && isValidObjectId(String(body.listId))
        ? new mongoose.Types.ObjectId(String(body.listId))
        : null;

    const detail = body.detail
      ? String(body.detail).trim().slice(0, DETAIL_MAX) || null
      : null;

    const owner = new mongoose.Types.ObjectId(req.userId);

    // Same pane, same target, moments ago = the same visit. Skip the write.
    const last = await UserEvent.findOne({ owner })
      .sort({ createdAt: -1 })
      .select("type pane listId detail createdAt")
      .lean();

    if (
      last &&
      last.type === type &&
      last.pane === pane &&
      String(last.listId || "") === String(listId || "") &&
      (last.detail || null) === detail &&
      Date.now() - new Date(last.createdAt).getTime() < DEDUPE_MS
    ) {
      return res.status(204).end();
    }

    await UserEvent.create({ owner, type, pane, listId, detail });
    return res.status(204).end();
  } catch (err) {
    // Never surface telemetry failures to the app.
    console.error("POST /api/events error", err);
    return res.status(204).end();
  }
});

module.exports = router;
