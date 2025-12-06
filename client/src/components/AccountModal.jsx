// src/components/AccountModal.jsx
import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-hot-toast";
import api from "../services/api";
import { useTranslation } from "react-i18next";

export default function AccountModal({ isOpen, onClose }) {
  const { t } = useTranslation("common");

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    email: "",
    trailname: "",
    marketingOptIn: false,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [tab, setTab] = useState("profile"); // "profile" | "security"
  const [error, setError] = useState("");

  // Fetch when opening
  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/settings")
      .then(({ data }) => {
        setSettings(data);
        setForm({
          email: data.email,
          trailname: data.trailname || "",
          marketingOptIn:
            data.marketing && typeof data.marketing.optedIn === "boolean"
              ? data.marketing.optedIn
              : false,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setError("");
      })
      .catch((err) => {
        console.error(err);
        const msg = t("accountModal.toast.loadFailed");
        toast.error(msg);
        onClose();
      });
  }, [isOpen, onClose, t]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // client‐side validation
    if (tab === "security" && form.newPassword !== form.confirmPassword) {
      const msg = t("accountModal.errors.passwordMismatch");
      setError(msg);
      return;
    }

    // build payload
    const payload = {};
    if (tab === "profile") {
      // Email is read-only; only allow trailname & marketing prefs to be updated
      if ((form.trailname || "") !== (settings.trailname || "")) {
        payload.trailname = form.trailname;
      }

      const previousOptIn =
        settings.marketing && typeof settings.marketing.optedIn === "boolean"
          ? settings.marketing.optedIn
          : false;

      if (form.marketingOptIn !== previousOptIn) {
        payload.marketing = { optedIn: form.marketingOptIn };
      }
    }
    if (tab === "security") {
      if (!form.currentPassword) {
        const msg = t("accountModal.errors.currentPasswordRequired");
        setError(msg);
        return;
      }
      if (form.newPassword) {
        payload.password = form.newPassword;
        payload.currentPassword = form.currentPassword;
      }
    }

    if (Object.keys(payload).length === 0) {
      toast(t("accountModal.toast.nothingToSave"), { icon: "ℹ️" });
      return onClose();
    }

    try {
      await api.patch("/settings", payload);
      toast.success(t("accountModal.toast.saveSuccess"));
      onClose();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message || t("accountModal.toast.saveFailed");
      setError(msg);
      toast.error(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-neutralAlt rounded-lg shadow-2xl max-w-xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            {t("accountModal.title")}
          </h2>
          <button
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label={t("actions.close")}
          >
            <FaTimes size={20} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-b mb-2 sm:mb-3">
          {["profile", "security"].map((tKey) => (
            <button
              key={tKey}
              onClick={() => {
                setTab(tKey);
                setError("");
              }}
              className={`mr-6 pb-2 ${
                tab === tKey
                  ? "border-b-2 border-emerald-500 font-medium"
                  : "text-gray-600"
              }`}
            >
              {t(
                tKey === "profile"
                  ? "accountModal.tabs.profile"
                  : "accountModal.tabs.security"
              )}
            </button>
          ))}
        </div>
        {/* Error banner */}
        {error && (
          <div className="mb-2 sm:mb-3 px-2 py-1 bg-red-100 text-red-800 rounded">
            {error}
          </div>
        )}
        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          {settings ? (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col space-y-3 h-full"
            >
              {tab === "profile" && (
                <>
                  <div>
                    <label className="block font-medium text-gray-700">
                      {t("accountModal.labels.email")}
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      readOnly
                      disabled
                      aria-disabled="true"
                      className="mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1 bg-gray-100 text-gray-700 cursor-not-allowed"
                      title={t("accountModal.messages.emailImmutable")}
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {t("accountModal.messages.emailChangeSupport")}
                    </p>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">
                      {t("accountModal.labels.trailname")}
                    </label>
                    <input
                      name="trailname"
                      value={form.trailname}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="flex items-start space-x-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.marketingOptIn}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            marketingOptIn: e.target.checked,
                          }))
                        }
                        className="mt-1"
                      />
                      <span>{t("auth.text.marketingOptIn")}</span>
                    </label>
                    <p className="mt-1 text-sm text-gray-500">
                      {t("accountModal.messages.marketingHint")}
                    </p>
                  </div>
                </>
              )}

              {tab === "security" && (
                <>
                  <div>
                    <label className="block font-medium text-gray-700">
                      {t("accountModal.labels.currentPassword")}
                    </label>
                    <input
                      name="currentPassword"
                      type="password"
                      value={form.currentPassword}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">
                      {t("accountModal.labels.newPassword")}
                    </label>
                    <input
                      name="newPassword"
                      type="password"
                      value={form.newPassword}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">
                      {t("accountModal.labels.confirmNewPassword")}
                    </label>
                    <input
                      name="confirmPassword"
                      type="password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1"
                    />
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="mt-auto flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2 py-1 bg-base-100 text-primary rounded hover:bg-base-100/80"
                >
                  {t("actions.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-2 py-1 bg-primary text-base-100 rounded flex items-center hover:bg-primary/80"
                >
                  {t("actions.save")}
                </button>
              </div>
            </form>
          ) : (
            <div>{t("accountModal.loading")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
