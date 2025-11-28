// src/components/LegalModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import PrivacyContent from "./legal/PrivacyContent";
import CookiesContent from "./legal/CookiesContent";
import CookieSettingsContent from "./legal/CookieSettingsContent";
import TermsContent from "./legal/TermsContent";
import AffiliateDisclosureContent from "./legal/AffiliateDisclosureContent";
import ImprintContent from "./legal/ImprintContent";

const TABS = [
  {
    id: "privacy",
    label: "Privacy",
    subtitle: "How we handle your data",
    component: PrivacyContent,
  },
  {
    id: "cookies",
    label: "Cookie Policy",
    subtitle: "What cookies we use",
    component: CookiesContent,
  },
  {
    id: "cookie-settings",
    label: "Cookie settings",
    subtitle: "Control optional cookies",
    component: CookieSettingsContent,
  },
  {
    id: "terms",
    label: "Terms",
    subtitle: "Usage & limitations",
    component: TermsContent,
  },
  {
    id: "affiliate",
    label: "Affiliate disclosure",
    subtitle: "How TrekList earns",
    component: AffiliateDisclosureContent,
  },
  {
    id: "imprint",
    label: "Imprint / Contact",
    subtitle: "Business & contact details",
    component: ImprintContent,
  },
];

export default function LegalModal({ open, onClose, initialTab = "privacy" }) {
  const navigate = useNavigate();
  const firstRef = useRef(null);
  const [tab, setTab] = useState(initialTab);

  // Reset tab when opened (e.g. cookie settings vs default)
  useEffect(() => {
    if (!open) return;
    setTab(initialTab || "privacy");
  }, [open, initialTab]);

  // ESC to close (match AccountModal)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the close button when opening (for accessibility)
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      if (firstRef.current) firstRef.current.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const ActiveComponent = activeTab.component;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="relative w-full max-w-4xl h-[80vh] bg-base-100 text-base-content rounded-lg shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-base-300 px-4 py-3 md:px-6 shrink-0 items-center">
          <div>
            <h2
              id="legal-modal-title"
              className="text-lg sm:text-xl font-semibold text-primary"
            >
              Legal &amp; Cookies
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            ref={firstRef}
            className="inline-flex items-center justify-center rounded-full p-2 text-error hover:text-error/90 hover:bg-error/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
            aria-label="Close legal information"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* Body: tabs + content */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Tabs */}
          <nav className="md:w-56 shrink-0 border-b border-base-200 md:border-b-0 md:border-r bg-base-200/60">
            <ul className="flex md:flex-col overflow-x-auto md:overflow-visible text-sm">
              {TABS.map((t) => {
                const isActive = t.id === activeTab.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={[
                        "px-3 py-2 md:px-4 md:py-2 w-full text-left whitespace-nowrap transition-colors",
                        isActive
                          ? "bg-base-100 text-primary font-medium border-b-2 md:border-b-0 md:border-l-2 border-primary"
                          : "text-secondary hover:bg-base-100/60",
                      ].join(" ")}
                    >
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        {t.subtitle && (
                          <span className="text-[11px] text-secondary/80">
                            {t.subtitle}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Content (scrollable only here) */}
          <section className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-6 text-sm leading-6">
            <ActiveComponent />
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-base-200 px-4 py-3 md:px-6 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-secondary">
            © {new Date().getFullYear()} TrekList •{" "}
            <strong>Tall Joe Hikes</strong> — KvK 98785419 •{" "}
            <a className="underline" href="mailto:support@treklist.co">
              support@treklist.co
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-base-100 text-primary border border-base-300 hover:bg-base-100/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
