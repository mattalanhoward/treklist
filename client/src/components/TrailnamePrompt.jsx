import React, { useState, useEffect, useRef } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import useAuth from "../hooks/useAuth";

const TRAILNAME_REGEX = /^[a-zA-Z0-9_'-]+$/;

export default function TrailnamePrompt() {
  const { user, updateUser, logout } = useAuth();
  const { t } = useTranslation("common");
  const [value, setValue] = useState(user?.trailname || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!confirming) inputRef.current?.focus();
  }, [confirming]);

  const validate = (v) => {
    if (!v.trim()) return t("trailnamePrompt.errorEmpty");
    if (v.trim().length < 2) return t("trailnamePrompt.errorTooShort");
    if (v.trim().length > 30) return t("trailnamePrompt.errorTooLong");
    if (!TRAILNAME_REGEX.test(v.trim())) return t("trailnamePrompt.errorChars");
    return "";
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    if (error) setError(validate(e.target.value));
  };

  const handleFirstSubmit = (e) => {
    e.preventDefault();
    const validationError = validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patch("/settings", { trailname: value.trim() });
      updateUser({ trailname: value.trim(), trailnameConfirmed: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message;
      setConfirming(false);
      if (code === "TRAILNAME_TAKEN") {
        setError(t("trailnamePrompt.errorTaken"));
      } else if (code === "TRAILNAME_RATE_LIMIT") {
        setError(msg || t("trailnamePrompt.errorRateLimit"));
      } else {
        setError(msg || t("trailnamePrompt.errorGeneric"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (confirming) {
    return (
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
        <div className="bg-neutralAlt rounded-xl shadow-2xl border border-neutral/60 w-full max-w-sm">
          <div className="px-6 pt-6 pb-4 border-b border-neutral/40">
            <h2 className="text-lg font-semibold text-primary">{t("trailnamePrompt.confirmTitle")}</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <p className="text-sm text-secondary">{t("trailnamePrompt.confirmSetting")}</p>
            <p className="text-base font-semibold text-primary">"{value.trim()}"</p>
            <p className="text-sm text-secondary">
              {t("trailnamePrompt.confirmWarning")}
            </p>
            {error && <p className="text-xs text-error">{error}</p>}
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <FiArrowLeft size={14} /> {t("trailnamePrompt.goBack")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="px-4 py-1.5 rounded text-sm font-medium text-base-100 bg-primary hover:bg-primary/80 disabled:opacity-50 transition-colors"
              >
                {saving ? t("trailnamePrompt.saving") : t("trailnamePrompt.yesConfirm")}
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-4 text-xs text-secondary hover:underline"
        >
          {t("topbar.logout")}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div
        className="bg-neutralAlt rounded-xl shadow-2xl border border-neutral/60 w-full max-w-sm"
      >
        <div className="px-6 pt-6 pb-4 border-b border-neutral/40">
          <h2 className="text-lg font-semibold text-primary">{t("trailnamePrompt.title")}</h2>
          <p className="mt-1 text-sm text-secondary">
            {t("trailnamePrompt.description")}
          </p>
        </div>

        <form onSubmit={handleFirstSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label htmlFor="trailname-input" className="block text-xs font-semibold text-primary uppercase mb-1.5">
              {t("trailnamePrompt.label")}
            </label>
            <input
              ref={inputRef}
              id="trailname-input"
              type="text"
              value={value}
              onChange={handleChange}
              maxLength={30}
              placeholder={t("trailnamePrompt.placeholder")}
              className="w-full px-3 py-2 rounded border border-neutral/60 bg-base-100 text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="mt-1.5 text-xs text-error">{error}</p>
            )}
            <p className="mt-1.5 text-xs text-secondary">
              {t("trailnamePrompt.charCount", { count: value.trim().length })}
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded text-sm font-medium text-base-100 bg-primary hover:bg-primary/80 transition-colors"
          >
            {t("trailnamePrompt.continue")}
          </button>
        </form>
      </div>
      <button
        type="button"
        onClick={logout}
        className="mt-4 text-xs text-secondary hover:underline"
      >
        {t("topbar.logout")}
      </button>
    </div>
  );
}
