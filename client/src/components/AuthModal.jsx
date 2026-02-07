// src/components/AuthModal.jsx
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FaTimes } from "react-icons/fa";
import useAuth from "../hooks/useAuth";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";

export default function AuthModal({
  isOpen,
  defaultMode = "login", // "login" | "register"
  onClose,
  onAuthed,
}) {
  // --- Hooks (order must never change between renders) ---
  const [mode, setMode] = useState(defaultMode); // "login" | "register" | "verify"
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trailname, setTrailname] = useState("");
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : null;
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const { login, hydrateFromStorage } = useAuth();
  const { region, language } = useUserSettings();
  const firstFieldRef = useRef(null);
  const { t } = useTranslation("common");

  // Keep mode and fields in sync when the modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Modal just closed → clear sensitive state
      setErr("");
      setEmail("");
      setPassword("");
      setTrailname("");
      setAcceptTerms(false);
      setMarketingOptIn(false);
      // Next time it opens, start from the default mode
      setMode(defaultMode);
      return;
    }

    // Modal just opened → ensure we start in the right mode
    setMode(defaultMode);
  }, [isOpen, defaultMode]);

  // Close on ESC (the hook always runs; behavior is gated by isOpen)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Autofocus the first input when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen, mode]);

  // After ALL hooks, it's safe to early-return
  if (!isOpen) return null;

  // --- Helpers / handlers ---
  const switchTo = (m) => {
    // only used for login/register tabs — do NOT use for "verify"
    setErr("");
    setMode(m);
    setEmail("");
    setPassword("");
    setTrailname("");
    setAcceptTerms(false);
    setMarketingOptIn(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");

    if (!email || !password) {
      setErr(t("auth.errors.loginMissingFields"));
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // toast.success(t("auth.toasts.welcomeBack"));
      onAuthed?.();
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.message || t("auth.errors.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErr("");

    if (!email || !password) {
      setErr(t("auth.errors.registerMissingFields"));
      return;
    }

    if (!acceptTerms) {
      setErr(t("auth.errors.acceptTermsRequired"));
      return;
    }

    if (password.length < 8) {
      setErr(t("validation.passwordMinLength"));
      return;
    }

    setLoading(true);
    const safeRegion = String(region || "gb").toLowerCase();
    const safeLanguage = String(language || "en").toLowerCase();
    const locale = `${safeLanguage}-${safeRegion.toUpperCase()}`;
    try {
      await api.post("/auth/register", {
        email,
        trailname,
        password,
        acceptTerms,
        marketingOptIn,
        next,
        region: safeRegion,
        language: safeLanguage,
        locale,
      });
      // No toast here; we switch into the "Check your email" step instead.
      setMode("verify");
    } catch (e) {
      const backendMsg = e?.response?.data?.message;

      if (backendMsg === "Email already in use.") {
        // Map known backend message to a translated string
        setErr(t("auth.errors.emailInUse"));
      } else {
        setErr(backendMsg || t("auth.errors.registerFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerified = async () => {
    setLoading(true);
    setErr("");
    try {
      // If email verification succeeded in another tab,
      // /auth/me will now return the user (because the JWT is in localStorage
      // and the axios interceptor sends it as Authorization).
      const { data } = await api.get("/auth/me");

      if (data?.user) {
        // 1) Tell AuthContext in THIS tab to adopt the token from localStorage
        hydrateFromStorage();

        // 2) Normal authed flow: toast + onAuthed (which navigates to /dashboard)
        // toast.success("Email verified — welcome to TrekList!");
        onAuthed?.();
        onClose?.();
      } else {
        toast(t("auth.toasts.notVerifiedYet"));
      }
    } catch (error) {
      // No valid token yet (user clicked too quickly / wrong link, etc.)
      toast(t("auth.toasts.notVerifiedYet"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await api.post("/auth/resend-verification", { email });
      toast.success(t("auth.toasts.verificationEmailResent"));
    } catch (error) {
      toast.error(
        error?.response?.data?.message || t("auth.toasts.resendFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || "";
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  // OAuth divider component
  const OAuthDivider = () => (
    <div className="flex items-center my-4">
      <div className="flex-1 border-t border-primary/20"></div>
      <span className="px-3 text-sm text-primary/60">{t("auth.text.or")}</span>
      <div className="flex-1 border-t border-primary/20"></div>
    </div>
  );

  // Google terms notice component
  const GoogleTermsNotice = () => (
    <p className="text-xs text-primary/70 text-center mb-3">
      {t("auth.text.googleTermsPrefix")}{" "}
      <a
        href="/legal/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="text-secondary underline"
      >
        {t("auth.text.termsTermsOfUse")}
      </a>{" "}
      {t("auth.text.termsAnd")}{" "}
      <a
        href="/legal/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-secondary underline"
      >
        {t("auth.text.termsPrivacyPolicy")}
      </a>
      .
    </p>
  );

  // Google button component
  const GoogleButton = ({ disabled }) => (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-primary/30 rounded bg-white hover:bg-neutral/10 text-primary disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {t("auth.buttons.continueWithGoogle")}
    </button>
  );

  const renderVerifyStep = () => (
    <div className="space-y-4 text-sm text-primary">
      <p>{t("auth.verify.sentTo", { email })}</p>{" "}
      <p>
        {t("auth.verify.step1")}
        <br />
        {t("auth.verify.step2")}
      </p>
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={handleCheckVerified}
          disabled={loading}
          className={`px-4 py-2 rounded bg-secondary text-white hover:bg-secondary/80 ${
            loading ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {loading
            ? t("auth.buttons.verifyCheckLoading")
            : t("auth.buttons.verifyCheck")}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className={`px-4 py-2 rounded border border-primary/30 text-primary hover:bg-white/60 ${
            loading ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {t("auth.buttons.verifyResend")}
        </button>
      </div>
      <p className="text-xs text-primary/80">{t("auth.verify.laterInfo")}</p>
    </div>
  );

  const title =
    mode === "login"
      ? t("auth.title.login")
      : mode === "register"
        ? t("auth.title.register")
        : t("auth.title.verify");

  // --- Render ---
  return (
    <div
      className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      onClick={onClose} // click backdrop to close
    >
      <div
        className="bg-neutralAlt rounded-lg shadow-2xl w-full max-w-md px-6 py-6"
        onClick={(e) => e.stopPropagation()} // prevent close when clicking inside
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label={t("auth.a11y.closeModal")}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Tabs (hidden in verify mode) */}
        {mode !== "verify" && (
          <div className="flex mb-6 border-b border-primary/20">
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium ${
                mode === "login"
                  ? "text-secondary border-b-2 border-secondary"
                  : "text-primary hover:text-secondary"
              }`}
              onClick={() => switchTo("login")}
            >
              {t("auth.tabs.login")}{" "}
            </button>
            <button
              type="button"
              className={`ml-4 px-3 py-2 text-sm font-medium ${
                mode === "register"
                  ? "text-secondary border-b-2 border-secondary"
                  : "text-primary hover:text-secondary"
              }`}
              onClick={() => switchTo("register")}
            >
              {t("auth.tabs.register")}{" "}
            </button>
          </div>
        )}

        {err && mode !== "verify" && (
          <div className="text-error text-sm mb-3">{err}</div>
        )}

        {/* Content */}
        {mode === "login" && (
          <form onSubmit={handleLogin} noValidate className="space-y-3">
            <label className="block text-sm text-primary">
              {t("auth.labels.email")}{" "}
              <input
                ref={firstFieldRef}
                type="email"
                className="mt-1 w-full border border-primary rounded p-2 text-primary text-sm bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </label>

            <label className="block text-sm text-primary">
              {t("auth.labels.password")}{" "}
              <input
                type="password"
                className="mt-1 w-full border border-primary rounded p-2 text-primary text-sm bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            <div className="flex items-center justify-between pt-2">
              <a
                href="/forgot-password"
                className="text-sm text-secondary hover:underline"
              >
                {t("auth.links.forgotPassword")}{" "}
              </a>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded bg-secondary text-white hover:bg-secondary/80 ${
                  loading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {loading
                  ? t("auth.buttons.signInLoading")
                  : t("auth.buttons.signIn")}{" "}
              </button>
            </div>
            <OAuthDivider />
            <GoogleTermsNotice />
            <GoogleButton disabled={loading} />
          </form>
        )}

        {mode === "register" && (
          <>
            <form onSubmit={handleRegister} noValidate className="space-y-3">
              <label className="block text-sm text-primary">
                {t("auth.labels.trailNameOptional")}{" "}
                <input
                  ref={firstFieldRef}
                  type="text"
                  className="mt-1 w-full border border-primary rounded p-2 text-primary text-sm bg-white"
                  value={trailname}
                  onChange={(e) => setTrailname(e.target.value)}
                  autoComplete="nickname"
                />
              </label>

              <label className="block text-sm text-primary">
                {t("auth.labels.email")}{" "}
                <input
                  type="email"
                  className="mt-1 w-full border border-primary rounded p-2 text-primary text-sm bg-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </label>

              <label className="block text-sm text-primary">
                {t("auth.labels.password")}{" "}
                <input
                  type="password"
                  className="mt-1 w-full border border-primary rounded p-2 text-primary text-sm bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>

              {/* Marketing opt-in */}
              <label className="flex items-start gap-2 text-xs text-primary">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <span>{t("auth.text.marketingOptIn")}</span>
              </label>
              {/* Terms acceptance (required) */}
              <label className="flex items-start gap-2 text-xs text-primary">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <span>
                  {t("auth.text.termsPrefix")}
                  <a
                    href="/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary underline"
                  >
                    {t("auth.text.termsTermsOfUse")}
                  </a>{" "}
                  {t("auth.text.termsAnd")}{" "}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary underline"
                  >
                    {t("auth.text.termsPrivacyPolicy")}
                  </a>
                  {t("auth.text.termsSuffix")}
                </span>
              </label>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 rounded bg-secondary text-white hover:bg-secondary/80 ${
                    loading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {loading
                    ? t("auth.buttons.createAccountLoading")
                    : t("auth.buttons.createAccount")}
                </button>
              </div>
            </form>
            <OAuthDivider />
            <GoogleTermsNotice />
            <GoogleButton disabled={loading} />
          </>
        )}

        {mode === "verify" && <div className="mt-2">{renderVerifyStep()}</div>}
      </div>
    </div>
  );
}
