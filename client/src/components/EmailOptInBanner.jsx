import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "../services/api";
import useAuth from "../hooks/useAuth";
import { useTranslation } from "react-i18next";

const DISMISS_KEY = "email_updates_banner_dismissed_v1";

export default function EmailOptInBanner() {
  const { t } = useTranslation("common");
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkedSettings, setCheckedSettings] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false);
      return;
    }

    // If user already said "no thanks" on this device, don't show again
    const dismissed =
      typeof window !== "undefined"
        ? window.localStorage.getItem(DISMISS_KEY)
        : null;
    if (dismissed === "1") {
      setVisible(false);
      setCheckedSettings(true);
      return;
    }

    // Fetch settings once to see if they're already opted in
    api
      .get("/settings")
      .then(({ data }) => {
        const optedIn =
          data.marketing && typeof data.marketing.optedIn === "boolean"
            ? data.marketing.optedIn
            : false;
        setVisible(!optedIn);
      })
      .catch((err) => {
        console.error("EmailOptInBanner /settings error:", err);
        // Fail quietly – don't block the app if this fails
        setVisible(false);
      })
      .finally(() => {
        setCheckedSettings(true);
      });
  }, [isAuthenticated]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      await api.patch("/settings", { marketing: { optedIn: true } });
      setVisible(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        // ignore
      }
      toast.success(
        t("emailOptInBanner.toast.success", { appName: t("app.name") })
      );
    } catch (err) {
      console.error("EmailOptInBanner opt-in error:", err);
      toast.error(t("emailOptInBanner.toast.error"));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !checkedSettings || !visible) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <p className="text-amber-900">
        {t("emailOptInBanner.text.body", { appName: t("app.name") })}
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-2 py-1 rounded border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs sm:text-sm"
        >
          {t("emailOptInBanner.buttons.noThanks")}
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading}
          className={`px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 text-xs sm:text-sm ${
            loading ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {loading
            ? t("emailOptInBanner.states.saving")
            : t("emailOptInBanner.buttons.yesEmailMe")}
        </button>
      </div>
    </div>
  );
}
