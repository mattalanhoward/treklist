// client/src/pages/VerifyEmail.jsx
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function VerifyEmail() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending"); // "pending" | "success" | "error"
  const [message, setMessage] = useState("");
  const handledRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();

  useEffect(() => {
    if (handledRef.current) return; // ensure we only run once
    handledRef.current = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("No verification token was provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    verifyEmail(token)
      .then((data) => {
        const msg = data?.message || "Your email has been verified.";
        setStatus("success");
        setMessage(msg);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Verification failed.";
        setStatus("error");
        setMessage(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [location.search, verifyEmail]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p>Verifying your email…</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">
            ✅
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Email verified
          </h1>
          <p className="text-gray-700">
            {message || "Your email has been verified."}
          </p>
          <p className="text-sm text-gray-500">
            You can close this tab and return to TrekList in your original
            window. If you prefer, you can also open TrekList from here.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-2 inline-flex items-center justify-center rounded bg-secondary px-4 py-2 text-white hover:bg-secondary/80"
          >
            Open TrekList
          </button>
        </div>
      </div>
    );
  }

  // status === "error"
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Email verification problem
        </h1>
        <p className="text-red-600">{message}</p>
        <p className="text-sm text-gray-500">
          The verification link may have expired or already been used. If you
          think your email is already verified, you can try signing in from the
          TrekList login page. If that doesn&apos;t work, please start the sign
          up process again with the same email so you can receive a fresh
          verification link.
        </p>
        <Link to="/login" className="text-blue-600 hover:underline">
          Go to Login
        </Link>
      </div>
    </div>
  );
}
