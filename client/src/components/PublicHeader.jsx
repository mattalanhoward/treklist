// src/components/PublicHeader.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../assets/images/treklist_horizontal.png";

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

  const base = "w-full flex items-center justify-between px-6 py-2 z-30";

  const variantClasses =
    variant === "overlay"
      ? "absolute top-0 left-0 bg-white/10 backdrop-blur-md"
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
          <a href="#how-it-works" className="hover:underline text-gray-800">
            {t("publicHeader.nav.howItWorks")}
          </a>
        </div>
      )}

      {/* Auth actions */}
      <div className="space-x-4">
        {onLogin ? (
          <button
            type="button"
            onClick={onLogin}
            className="font-medium hover:underline"
          >
            {t("publicHeader.auth.login")}
          </button>
        ) : (
          <Link to="/auth/login" className="font-medium hover:underline">
            {t("publicHeader.auth.login")}
          </Link>
        )}

        {onRegister ? (
          <button
            type="button"
            onClick={onRegister}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            {t("publicHeader.auth.getStarted")}
          </button>
        ) : (
          <Link
            to="/auth/register"
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            {t("publicHeader.auth.getStarted")}
          </Link>
        )}
      </div>
    </nav>
  );
}
