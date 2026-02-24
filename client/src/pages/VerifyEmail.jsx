// client/src/pages/VerifyEmail.jsx
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import SEO from "../components/SEO";

export default function VerifyEmail() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending"); // "pending" | "success" | "error"
  const [message, setMessage] = useState("");
  const handledRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();
  const { t } = useTranslation("common");

  useEffect(() => {
    if (handledRef.current) return; // ensure we only run once
    handledRef.current = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage(t("verifyEmailPage.missingToken"));
      setLoading(false);
      return;
    }

    setLoading(true);
    verifyEmail(token)
      .then((data) => {
        const msg =
          data?.message || t("verifyEmailPage.fallbackSuccessMessage");
        setStatus("success");
        setMessage(msg);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          t("verifyEmailPage.fallbackErrorMessage");
        setStatus("error");
        setMessage(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [location.search, verifyEmail, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <SEO title="Verify Email" noindex />
        <p>{t("verifyEmailPage.loading")}</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <SEO title="Verify Email" noindex />
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">
            ✅
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("verifyEmailPage.successTitle")}
          </h1>
          <p className="text-gray-700">
            {message || t("verifyEmailPage.fallbackSuccessMessage")}
          </p>
          <p className="text-sm text-gray-500">
            {t("verifyEmailPage.successHelp", {
              appName: t("app.name"),
            })}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-2 inline-flex items-center justify-center rounded bg-secondary px-4 py-2 text-white hover:bg-secondary/80"
          >
            {t("verifyEmailPage.successButton", {
              appName: t("app.name"),
            })}
          </button>
        </div>
      </div>
    );
  }

  // status === "error"
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <SEO title="Verify Email" noindex />
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("verifyEmailPage.errorTitle")}
        </h1>
        <p className="text-red-600">{message}</p>
        <p className="text-sm text-gray-500">
          {t("verifyEmailPage.errorHelp", {
            appName: t("app.name"),
          })}
        </p>
        <Link to="/auth/login" className="text-blue-600 hover:underline">
          {t("verifyEmailPage.errorLoginLink")}
        </Link>
      </div>
    </div>
  );
}
