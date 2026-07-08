// src/components/PublicHeader.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../assets/images/media-kit/treklist_horizontal.png";
import { useUserSettings } from "../contexts/UserSettings";

const LANG_OPTIONS = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "nl", flag: "🇳🇱", label: "Nederlands" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "es", flag: "🇪🇸", label: "Español" },
];

/**
 * Public (logged-out) header used on Landing and legal pages.
 *
 * Props:
 * - variant: "overlay" | "solid"
 *    - overlay: for landing hero (absolute, translucent)
 *    - solid: for normal pages (relative, solid bg)
 * - showSections: boolean, whether to show #features / #howitwork links
 * - onLogin / onRegister: optional handlers
 *    - If provided, use buttons that call these
 *    - If not, fall back to <Link> that navigates to /auth/*
 */
export default function PublicHeader({
  variant = "solid",
  showSections = true,
  onLogin,
  onRegister,
}) {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useUserSettings();
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!langOpen) return;
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  // Scroll-aware sticky — overlay variant only
  useEffect(() => {
    if (variant !== "overlay") return;
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [variant]);

  const currentLang =
    LANG_OPTIONS.find((l) => l.code === language) ?? LANG_OPTIONS[0];

  const base =
    "w-full flex items-center justify-between px-6 py-2 z-50 transition-colors duration-200";

  const variantClasses =
    variant === "overlay"
      ? scrolled
        ? "fixed top-0 left-0 bg-white border-b border-gray-200 shadow-sm"
        : "absolute top-0 left-0 bg-white/10 backdrop-blur-md"
      : "relative bg-base-100 border-b border-base-300 shadow-sm";

  return (
    <nav className={`${base} ${variantClasses}`}>
      {/* Brand */}
      <Link
        to="/"
        className="text-2xl text-white font-semibold tracking-tight hover:underline"
      >
        <img src={logo} alt={t("app.name")} className="h-8" />
      </Link>

      {/* Section links (landing only) */}
      {showSections && (
        <div className="text-lg font-medium space-x-6 hidden md:flex">
          <a href="#features" className="hover:underline text-gray-800">
            {t("publicHeader.nav.features")}
          </a>
          <a
            href="#recommendedGearList"
            className="hover:underline text-gray-800"
          >
            {t("publicHeader.nav.recommendedGearList")}
          </a>
          <a href="#howItWorks" className="hover:underline text-gray-800">
            {t("publicHeader.nav.howItWorks")}
          </a>
        </div>
      )}

      {/* Auth actions */}
      <div className="flex items-center space-x-4">
        {/* Language picker */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1 text-sm font-medium hover:opacity-80 transition"
            aria-label="Select language"
          >
            <span className="text-lg leading-none">{currentLang.flag}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${langOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div
            aria-hidden={!langOpen}
            className={`absolute right-0 top-full mt-2 bg-white rounded-md shadow-lg py-1 z-50 min-w-[9rem] border border-gray-100 origin-top-right transition-all duration-150 ease-out ${
              langOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  setLanguage(opt.code);
                  setLangOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition ${
                  language === opt.code ? "font-semibold" : ""
                }`}
              >
                <span className="text-base">{opt.flag}</span>
                <span className="text-gray-700">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Login — hidden on mobile to prevent wrapping */}
        {onLogin ? (
          <button
            type="button"
            onClick={onLogin}
            className="hidden sm:block font-medium hover:underline text-gray-800"
          >
            {t("publicHeader.auth.login")}
          </button>
        ) : (
          <Link to="/auth/login" className="hidden sm:block font-medium hover:underline">
            {t("publicHeader.auth.login")}
          </Link>
        )}

        {/* Register/Get Started */}
        {onRegister ? (
          <button
            type="button"
            onClick={onRegister}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-sm sm:text-base font-semibold rounded-full hover:opacity-90 transition"
          >
            {t("publicHeader.auth.getStarted")}
          </button>
        ) : (
          <Link
            to="/auth/register"
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-sm sm:text-base font-semibold rounded-full hover:opacity-90 transition"
          >
            {t("publicHeader.auth.getStarted")}
          </Link>
        )}
      </div>
    </nav>
  );
}
