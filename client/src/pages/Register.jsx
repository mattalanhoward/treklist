import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { toast } from "react-hot-toast";

export default function Register() {
  const [email, setEmail] = useState("");
  const [trailname, setTrailname] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const getNext = () => {
    const params = new URLSearchParams(location.search);
    const n = params.get("next");
    return n && n.startsWith("/") ? n : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Front-end guard so the user gets immediate feedback
    if (!acceptTerms) {
      toast.error(
        "Please accept the Terms of Use and Privacy Policy to create an account."
      );
      return;
    }

    setLoading(true);
    try {
      const next = getNext(); // only returns a safe relative path or null

      await api.post("/auth/register", {
        email,
        trailname,
        password,
        acceptTerms,
        marketingOptIn,
        next,
      });

      toast.success("Registered! Check your email to verify.");
      navigate(next ? `/login?next=${encodeURIComponent(next)}` : "/login", {
        replace: true,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
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
        <h2 className="text-2xl font-bold mb-4">Sign Upppp</h2>

        <label className="block mb-3">
          <span className="text-gray-700">Trail Name</span>
          <input
            type="text"
            value={trailname}
            onChange={(e) => setTrailname(e.target.value)}
            className="mt-1 block w-full border p-2 rounded"
            disabled={loading}
          />
        </label>

        <label className="block mb-3">
          <span className="text-gray-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
            disabled={loading}
          />
        </label>

        <label className="block mb-4">
          <span className="text-gray-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
            disabled={loading}
          />
        </label>

        <label className="flex items-start gap-2 mb-2">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            disabled={loading}
            className="mt-1"
          />
          <span className="text-gray-700 text-sm">
            Email me about new TrekList features, tips, and occasional offers.
          </span>
        </label>

        <label className="flex items-start gap-2 mb-4">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            disabled={loading}
            className="mt-1"
          />
          <span className="text-gray-700 text-sm">
            I agree to the{" "}
            <a
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Registering…" : "Register"}
        </button>
      </form>
    </div>
  );
}
