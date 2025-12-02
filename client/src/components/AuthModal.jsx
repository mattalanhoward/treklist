// src/components/AuthModal.jsx
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FaTimes } from "react-icons/fa";
import useAuth from "../hooks/useAuth";
import api from "../services/api";
import { toast } from "react-hot-toast";

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
  const firstFieldRef = useRef(null);

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
      setErr("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      onAuthed?.();
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErr("");

    if (!email || !password) {
      setErr("Email and password are required.");
      return;
    }

    if (!acceptTerms) {
      setErr(
        "Please accept the Terms of Use and Privacy Policy to create an account."
      );
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        email,
        trailname,
        password,
        acceptTerms,
        marketingOptIn,
        next,
      });
      // No toast here; we switch into the "Check your email" step instead.
      setMode("verify");
    } catch (e) {
      setErr(e?.response?.data?.message || "Registration failed");
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
        toast("Not verified yet — try again in a few seconds.");
      }
    } catch (error) {
      // No valid token yet (user clicked too quickly / wrong link, etc.)
      toast("Not verified yet — try again in a few seconds.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await api.post("/auth/resend-verification", { email });
      toast.success("Verification email resent.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to resend verification email."
      );
    } finally {
      setLoading(false);
    }
  };

  const renderVerifyStep = () => (
    <div className="space-y-4 text-sm text-primary">
      <p>
        We&apos;ve sent a verification link to <strong>{email}</strong>.
      </p>
      <p>
        1. Open your email and click the verification link.
        <br />
        2. Then come back to this window and press the button below.
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
          {loading ? "Checking…" : "I’ve verified my email"}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className={`px-4 py-2 rounded border border-primary/30 text-primary hover:bg-white/60 ${
            loading ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          Resend verification email
        </button>
      </div>

      <p className="text-xs text-primary/80">
        You can also close this window and come back later. Once your email is
        verified, you&apos;ll be able to sign in normally.
      </p>
    </div>
  );

  const title =
    mode === "login"
      ? "Sign In"
      : mode === "register"
      ? "Create your account"
      : "Check your email";

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
            aria-label="Close modal"
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
              Sign In
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
              Sign Up
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
              Email
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
              Password
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
                Forgot password?
              </a>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded bg-secondary text-white hover:bg-secondary/80 ${
                  loading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <>
            {err && <div className="text-error text-sm mb-3">{err}</div>}
            <form onSubmit={handleRegister} noValidate className="space-y-3">
              <label className="block text-sm text-primary">
                Trail Name (optional)
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
                Email
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
                Password
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
                <span>
                  Email me about new TrekList features, tips, and occasional
                  offers.
                </span>
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
                  I agree to the{" "}
                  <a
                    href="/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary underline"
                  >
                    Terms of Use
                  </a>{" "}
                  and{" "}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary underline"
                  >
                    Privacy Policy
                  </a>
                  .
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
                  {loading ? "Creating…" : "Create Account"}
                </button>
              </div>
            </form>
          </>
        )}

        {mode === "verify" && <div className="mt-2">{renderVerifyStep()}</div>}
      </div>
    </div>
  );
}
