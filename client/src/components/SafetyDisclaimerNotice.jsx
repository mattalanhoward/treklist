// client/src/components/SafetyDisclaimerNotice.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Shared anchor target so the top prompt can scroll to the full disclaimer.
export const DISCLAIMER_ANCHOR_ID = "treklist-disclaimer";

// Small "always read the disclaimer" cue shown near the top of the list.
// - `scroll` (default): anchor link that smooth-scrolls to the full notice.
//   Use on the standalone public page where the prompt and the full notice
//   share a scroll context.
// - Otherwise a static "below" hint. Use inside embeds (the iframe renders at
//   full height, so an in-iframe anchor can't move the parent viewport) and in
//   the in-app template preview.
export function SafetyDisclaimerPrompt({ scroll = false, className = "" }) {
  const { t } = useTranslation("common");

  if (!scroll) {
    return (
      <div
        className={"text-[11px] text-gray-400 py-1 " + className}
        role="note"
      >
        {t("safetyDisclaimer.promptEmbed")}
      </div>
    );
  }

  const handleClick = (e) => {
    e.preventDefault();
    const el = document.getElementById(DISCLAIMER_ANCHOR_ID);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={"text-[11px] py-1 " + className} role="note">
      <a
        href={`#${DISCLAIMER_ANCHOR_ID}`}
        onClick={handleClick}
        className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
      >
        {t("safetyDisclaimer.prompt")} <span aria-hidden>↓</span>
      </a>
    </div>
  );
}

// The full disclaimer paragraph shown at the bottom of the list.
// - `featured`: neutral wording for TrekList-endorsed / template lists.
// - `external`: link to Terms on the full site in a new tab (for embeds, where
//   in-app routing can't help the parent page). Otherwise an in-app link.
export function SafetyDisclaimerFull({
  featured = false,
  external = false,
  className = "",
}) {
  const { t } = useTranslation("common");

  const linkClass =
    "underline underline-offset-2 text-gray-400 hover:text-gray-600";

  const termsLink = external ? (
    <a
      href="https://app.treklist.co/legal/terms"
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      {t("safetyDisclaimer.termsLink")}
    </a>
  ) : (
    <Link to="/legal/terms" className={linkClass}>
      {t("safetyDisclaimer.termsLink")}
    </Link>
  );

  return (
    <div
      id={DISCLAIMER_ANCHOR_ID}
      role="note"
      className={
        "text-[11px] leading-relaxed text-gray-400 scroll-mt-20 " + className
      }
    >
      <strong className="font-semibold">{t("safetyDisclaimer.heading")}</strong>{" "}
      {t(featured ? "safetyDisclaimer.bodyFeatured" : "safetyDisclaimer.body")}{" "}
      {termsLink}
    </div>
  );
}
