// src/components/AccountModal.jsx
import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import useAuth from "../hooks/useAuth";

export default function AccountModal({ isOpen, onClose }) {
  const { t } = useTranslation("common");
  const { updateUser, user } = useAuth();

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    email: "",
    trailname: "",
    marketingOptIn: false,
    notificationEmailEnabled: true,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [tab, setTab] = useState("profile"); // "profile" | "security"
  const [error, setError] = useState("");
  const [pendingPayload, setPendingPayload] = useState(null); // set when awaiting trailname confirmation

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
          notificationEmailEnabled:
            data.notifications?.emailEnabled !== false,
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

  const buildPayload = () => {
    const payload = {};
    if (tab === "profile") {
      const lockedUntil = settings.trailnameChangedAt
        ? new Date(new Date(settings.trailnameChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
        : null;
      const isLocked = lockedUntil && lockedUntil > new Date() && !user?.isAdmin;
      if (!isLocked && (form.trailname || "").trim() !== (settings.trailname || "").trim()) {
        payload.trailname = form.trailname.trim();
      }
      const previousOptIn =
        settings.marketing && typeof settings.marketing.optedIn === "boolean"
          ? settings.marketing.optedIn
          : false;
      if (form.marketingOptIn !== previousOptIn) {
        payload.marketing = { optedIn: form.marketingOptIn };
      }
      const previousNotifEmail = settings.notifications?.emailEnabled !== false;
      if (form.notificationEmailEnabled !== previousNotifEmail) {
        payload.notifications = { emailEnabled: form.notificationEmailEnabled };
      }
    }
    if (tab === "security") {
      if (form.newPassword) {
        payload.password = form.newPassword;
        payload.currentPassword = form.currentPassword;
      }
    }
    return payload;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (tab === "security" && form.newPassword !== form.confirmPassword) {
      setError(t("accountModal.errors.passwordMismatch"));
      return;
    }
    if (tab === "security" && form.newPassword && form.newPassword.length < 8) {
      setError(t("validation.passwordMinLength"));
      return;
    }
    if (tab === "security" && form.newPassword && !form.currentPassword) {
      setError(t("accountModal.errors.currentPasswordRequired"));
      return;
    }

    const payload = buildPayload();

    if (Object.keys(payload).length === 0) {
      toast(t("accountModal.toast.nothingToSave"), { icon: "ℹ️" });
      return onClose();
    }

    // If the trailname is changing, pause for confirmation before submitting
    if (payload.trailname !== undefined) {
      setPendingPayload(payload);
      return;
    }

    doSave(payload);
  };

  const doSave = async (payload) => {
    setError("");
    try {
      const { data } = await api.patch("/settings", payload);
      if (payload.trailname !== undefined) {
        updateUser({ trailname: data.trailname || payload.trailname, trailnameConfirmed: true });
      }
      toast.success(t("accountModal.toast.saveSuccess"));
      setPendingPayload(null);
      onClose();
    } catch (err) {
      console.error(err);
      const code = err?.response?.data?.code;
      const msg =
        code === "TRAILNAME_TAKEN"      ? t("trailnamePrompt.errorTaken") :
        code === "TRAILNAME_RATE_LIMIT" ? t("trailnamePrompt.errorRateLimit") :
        code === "TRAILNAME_CHARS"      ? t("trailnamePrompt.errorChars") :
        code === "TRAILNAME_LENGTH"     ? t("trailnamePrompt.errorTooShort") :
        code === "TRAILNAME_EMPTY"      ? t("trailnamePrompt.errorEmpty") :
        err.response?.data?.message     || t("accountModal.toast.saveFailed");
      setError(msg);
      toast.error(msg);
      setPendingPayload(null);
    }
  };

  if (!isOpen) return null;

  // Trailname confirmation screen
  if (pendingPayload) {
    return (
      <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-neutralAlt rounded-lg shadow-2xl max-w-sm w-full px-4 py-4 sm:px-6 sm:py-6 my-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-primary">{t("trailnamePrompt.confirmTitle")}</h2>
            <button onClick={() => setPendingPayload(null)} className="text-error hover:text-error/80" aria-label={t("trailnamePrompt.goBack")}>
              <FiX size={20} />
            </button>
          </div>
          <p className="text-sm text-secondary mb-2">
            {t("trailnamePrompt.confirmSetting")}
          </p>
          <p className="text-base font-semibold text-primary mb-4">"{pendingPayload.trailname}"</p>
          <p className="text-sm text-secondary mb-6">
            {t("trailnamePrompt.confirmWarning")}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingPayload(null)}
              className="px-4 py-1.5 rounded text-sm text-primary hover:bg-primary/10"
            >
              {t("trailnamePrompt.goBack")}
            </button>
            <button
              type="button"
              onClick={() => doSave(pendingPayload)}
              className="px-4 py-1.5 rounded text-sm text-base-100 bg-primary hover:bg-primary/80"
            >
              {t("trailnamePrompt.yesConfirm")}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <FiX size={20} />
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
                  {(() => {
                    const lockedUntil = settings.trailnameChangedAt
                      ? new Date(new Date(settings.trailnameChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
                      : null;
                    const isLocked = lockedUntil && lockedUntil > new Date() && !user?.isAdmin;
                    const unlockDate = isLocked
                      ? lockedUntil.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                      : null;
                    return (
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
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-gray-700">
                            {t("accountModal.labels.trailname")}
                          </label>
                          <input
                            name="trailname"
                            value={form.trailname}
                            onChange={isLocked ? undefined : handleChange}
                            readOnly={isLocked}
                            disabled={isLocked}
                            aria-disabled={isLocked}
                            className={`mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1 ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                          />
                          {isLocked ? (
                            <p className="mt-1 text-xs text-gray-500">
                              {t("accountModal.messages.trailnameLocked", { date: unlockDate })}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500">
                          {t("accountModal.messages.contactSupportPrompt")}{" "}
                          <a href="mailto:support@treklist.co" className="underline hover:text-gray-700">
                            support@treklist.co
                          </a>
                          .
                        </p>
                      </>
                    );
                  })()}
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
                  </div>
                  <div className="mt-3">
                    <label className="flex items-start space-x-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.notificationEmailEnabled}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            notificationEmailEnabled: e.target.checked,
                          }))
                        }
                        className="mt-1"
                      />
                      <span>Email me when someone replies to my post or comment</span>
                    </label>
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
