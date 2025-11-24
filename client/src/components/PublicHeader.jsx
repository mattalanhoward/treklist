// src/components/PublicHeader.jsx
import React from "react";
import { Link } from "react-router-dom";

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
  const base = "w-full flex items-center justify-between px-6 py-4 z-30";

  const variantClasses =
    variant === "overlay"
      ? "absolute top-0 left-0 bg-white/10 backdrop-blur-md"
      : "relative bg-base-100 border-b border-base-300 shadow-sm";

  return (
    <nav className={`${base} ${variantClasses}`}>
      {/* Brand */}
      <Link
        to="/"
        className="text-2xl font-semibold tracking-tight hover:underline"
      >
        TrekList.co
      </Link>

      {/* Section links (landing only) */}
      {showSections && (
        <div className="space-x-6 hidden md:flex">
          <a href="#features" className="hover:underline text-gray-800">
            Features
          </a>
          <a
            href="#recommendedGearList"
            className="hover:underline text-gray-800"
          >
            Recommended Gear List
          </a>
          <a href="#how-it-works" className="hover:underline text-gray-800">
            How it Works
          </a>
        </div>
      )}

      {/* Auth actions */}
      <div className="space-x-4">
        {onLogin ? (
          <button
            type="button"
            onClick={onLogin}
            className="text-sm font-medium hover:underline"
          >
            Log In
          </button>
        ) : (
          <Link
            to="/auth/login"
            className="text-sm font-medium hover:underline"
          >
            Log In
          </Link>
        )}

        {onRegister ? (
          <button
            type="button"
            onClick={onRegister}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            Get Started
          </button>
        ) : (
          <Link
            to="/auth/register"
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            Get Started
          </Link>
        )}
      </div>
    </nav>
  );
}
