// client/src/pages/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const { t } = useTranslation("common");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setToken(params.get("token"));
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.reset.errors.passwordsDontMatch"));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      toast.success(t("auth.reset.toast.success"));
      // Match the /auth/login route you’re using elsewhere
      navigate("/auth/login");
    } catch (err) {
      toast.error(err.response?.data?.message || t("auth.reset.toast.failed"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p>{t("auth.reset.invalidLink")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-6 rounded shadow"
      >
        <h2 className="text-2xl font-bold mb-4">{t("auth.reset.title")}</h2>

        <label className="block mb-3">
          <span className="text-gray-700">
            {t("auth.reset.labels.newPassword")}
          </span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
            disabled={loading}
          />
        </label>

        <label className="block mb-4">
          <span className="text-gray-700">
            {t("auth.reset.labels.confirmPassword")}
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
            disabled={loading}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? t("auth.reset.buttons.submitting")
            : t("auth.reset.buttons.submit")}
        </button>
      </form>
    </div>
  );
}
