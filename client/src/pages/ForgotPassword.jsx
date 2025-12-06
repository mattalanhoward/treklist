import React, { useState } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success(t("auth.toasts.forgotPasswordEmailSent"));
      navigate("/auth/login");
    } catch (err) {
      const msg =
        err.response?.data?.message || t("auth.toasts.forgotPasswordFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-6 rounded shadow"
      >
        <h2 className="text-2xl font-bold mb-4">
          {t("auth.title.forgotPassword")}
        </h2>

        <label className="block mb-4">
          <span className="text-gray-700">{t("auth.labels.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            ? t("auth.buttons.forgotPasswordSendLoading")
            : t("auth.buttons.forgotPasswordSend")}
        </button>
      </form>
    </div>
  );
}
