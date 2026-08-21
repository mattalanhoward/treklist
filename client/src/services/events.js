// client/src/services/events.js
//
// Pane-view telemetry for the admin user timeline (server: routes/events.js).
// First-party only — nothing here leaves our own API, and the payload is the
// pane id plus which list or community it was.
//
// Fire-and-forget by design: a failed log must never surface to the user,
// block navigation, or retry.
import api from "./api";

// A repeat of the exact same view inside this window is the same visit — a
// StrictMode double-effect in dev, a remount, a back gesture. The server
// dedupes on the same rule; this just saves the round trip.
const DEDUPE_MS = 30_000;

let lastKey = "";
let lastAt = 0;

/**
 * @param {string} pane     one of the panes allowlisted in models/userEvent.js
 * @param {object} [opts]
 * @param {string} [opts.listId]  gear list being viewed, when there is one
 * @param {string} [opts.detail]  short qualifier: My Gear sub-tab, community slug
 */
export function logPaneView(pane, { listId = null, detail = null } = {}) {
  if (!pane) return;

  const key = `${pane}|${listId || ""}|${detail || ""}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < DEDUPE_MS) return;
  lastKey = key;
  lastAt = now;

  api
    .post("/events", { type: "pane.viewed", pane, listId, detail })
    .catch(() => {
      // Telemetry is never worth a console error in the user's browser.
    });
}
