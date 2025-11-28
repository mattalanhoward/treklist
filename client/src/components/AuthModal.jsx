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
  const [mode, setMode] = useState(defaultMode);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trailname, setTrailname] = useState("");
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : null;

  const { login } = useAuth();
  const firstFieldRef = useRef(null);

  // Keep mode in sync whenever the modal opens with a different default
  useEffect(() => {
    if (isOpen) setMode(defaultMode);
  }, [defaultMode, isOpen]);

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
    // slight delay to ensure element is mounted
    const t = setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen, mode]);

  // After ALL hooks, it's safe to early-return
  if (!isOpen) return null;

  // --- Handlers ---
  const switchTo = (m) => {
    setErr("");
    setMode(m);
    // clear fields when switching modes (optional)
    setEmail("");
    setPassword("");
    setTrailname("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
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
    setLoading(true);
    try {
      await api.post("/auth/register", { email, trailname, password, next });
      toast.success("Registered! Check your email to verify.");
      switchTo("login");
    } catch (e) {
      setErr(e?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-xl font-semibold text-primary">
            {mode === "login" ? "Sign In" : "Create your account"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label="Close modal"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Tabs */}
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

        {err && <div className="text-error text-sm mb-3">{err}</div>}

        {/* Forms */}
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block text-sm text-primary">
              Email
              <input
                ref={firstFieldRef}
                type="email"
                className="mt-1 w-full border border-primary rounded p-2 text-primary text-sm bg-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                required
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
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <label className="block text-sm text-primary">
              Trail Name
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
                required
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
                required
                autoComplete="new-password"
              />
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
        )}
      </div>
    </div>
  );
}
