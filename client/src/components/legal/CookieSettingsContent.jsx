// src/components/legal/CookieSettingsContent.jsx
import React, { useEffect, useState } from "react";
import {
  defaultConsent,
  loadConsent,
  saveConsent,
} from "../../utils/cookieConsent";
import { initAnalytics } from "../../utils/analytics";

export default function CookieSettingsContent() {
  const [consent, setConsent] = useState(defaultConsent);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const loaded = loadConsent();
    setConsent(loaded);
    setSavedAt(loaded.updatedAt || null);
    if (typeof window !== "undefined") {
      window.cookieConsent = loaded;
    }
  }, []);

  const formattedSavedAt =
    savedAt &&
    new Date(savedAt).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleToggleAnalytics = () => {
    setConsent((prev) => ({
      ...prev,
      analytics: !prev.analytics,
    }));
    setDirty(true);
  };

  const handleAcceptAll = () => {
    const next = saveConsent({
      ...consent,
      analytics: true,
    });
    setConsent(next);
    setSavedAt(next.updatedAt);
    setDirty(false);
    // User explicitly accepted analytics → try to load analytics script
    initAnalytics();
  };

  const handleRejectNonEssential = () => {
    const next = saveConsent({
      ...consent,
      analytics: false,
    });
    setConsent(next);
    setSavedAt(next.updatedAt);
    setDirty(false);
    // Intentionally do NOT call initAnalytics when turning analytics off
  };

  const handleSave = () => {
    const next = saveConsent(consent);
    setConsent(next);
    setSavedAt(next.updatedAt);
    setDirty(false);
    // If analytics are enabled via Save, try to load analytics script
    if (next.analytics) {
      initAnalytics();
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Cookie Settings</h1>

      <p className="mb-3 text-sm">
        TrekList uses a small number of cookies and similar technologies:
        <br />
        <span className="block mt-1">
          • <strong>Essential cookies</strong> keep TrekList secure and running
          (for example, login and basic settings).
        </span>
        <span className="block">
          • <strong>Analytics cookies</strong> help us understand how people use
          TrekList so we can improve it.
        </span>
      </p>

      <p className="mb-4 text-xs text-secondary">
        Essential cookies are always on and cannot be switched off here (you can
        still manage them in your browser). We currently do <strong>not</strong>{" "}
        use marketing / advertising cookies on TrekList.co. If we introduce new
        cookie categories in the future, they will appear here with clear
        explanations.
      </p>

      <div className="border border-base-300 rounded-lg overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-base-200 bg-base-200/60 text-xs uppercase tracking-wide text-secondary">
          Cookie categories
        </div>
        <div className="divide-y divide-base-200 text-sm">
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="mt-1">
              <input
                type="checkbox"
                checked
                disabled
                className="checkbox checkbox-xs"
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="font-medium">Essential</div>
              <div className="text-xs text-secondary mt-1">
                Required for TrekList to function: secure login, session
                handling, basic preferences, and protection against abuse. These
                cookies are always enabled. If you block them in your browser,
                TrekList may not work correctly.
              </div>
            </div>
          </div>

          <div className="px-4 py-3 flex items-start gap-3">
            <div className="mt-1">
              <input
                id="cookie-analytics"
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={!!consent.analytics}
                onChange={handleToggleAnalytics}
              />
            </div>
            <div>
              <label
                htmlFor="cookie-analytics"
                className="font-medium cursor-pointer"
              >
                Analytics
              </label>
              <div className="text-xs text-secondary mt-1">
                Allows us to collect aggregated usage statistics (for example,
                which pages are most popular) to improve TrekList. We do{" "}
                <strong>not</strong> use analytics cookies to show you targeted
                ads. If enabled, TrekList may load a privacy-friendly analytics
                script in line with our Privacy and Cookie Policies.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reserve space so layout doesn't jump when the timestamp appears */}
      <p className="text-[11px] text-secondary mb-3 min-h-[1.25rem]">
        {formattedSavedAt ? `Last saved: ${formattedSavedAt}` : "\u00A0"}
      </p>

      <div className="flex flex-wrap gap-2 mt-2">
        <button
          type="button"
          onClick={handleAcceptAll}
          className="px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 text-sm"
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={handleRejectNonEssential}
          className="px-2 py-1 text-sm rounded border border-base-300 text-secondary hover:bg-secondary/20"
        >
          Reject non-essential
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className={`px-2 py-1 text-sm rounded border ${
            dirty
              ? "border-secondary text-secondary hover:bg-secondary/20"
              : "border-base-300 text-secondary hover:bg-base-200/60 cursor-default"
          }`}
        >
          Save preferences
        </button>
      </div>

      <p className="mt-3 text-xs text-secondary">
        You can change your mind at any time by coming back to this page or
        opening the Cookie Settings tab from the Legal &amp; Policies menu.
      </p>
    </>
  );
}
