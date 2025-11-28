// src/components/AccountModal.jsx
import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-hot-toast";
import api from "../services/api";

export default function AccountModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    email: "",
    trailname: "",
    marketingOptIn: false,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [tab, setTab] = useState("Profile");
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
        toast.error("Failed to load account settings");
        onClose();
      });
  }, [isOpen, onClose]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // client‐side validation
    if (tab === "Security" && form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }

    // build payload
    const payload = {};
    if (tab === "Profile") {
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
    if (tab === "Security") {
      if (!form.currentPassword) {
        setError("You must enter your current password to change it");
        return;
      }
      if (form.newPassword) {
        payload.password = form.newPassword;
        payload.currentPassword = form.currentPassword;
      }
    }

    if (Object.keys(payload).length === 0) {
      toast("Nothing to save", { icon: "ℹ️" });
      return onClose();
    }

    try {
      await api.patch("/settings", payload);
      toast.success("Settings saved");
      onClose();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        "Failed to save settings. Please try again.";
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
          <h2 className="text-lg sm:text-xl font-semibold text-primary">
            Account Settings
          </h2>
          <button onClick={onClose} className="text-error hover:text-error/80">
            <FaTimes size={20} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-b mb-2 sm:mb-3">
          {["Profile", "Security"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`mr-6 pb-2 ${
                tab === t
                  ? "border-b-2 border-emerald-500 font-medium"
                  : "text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {/* Error banner */}
        {error && (
          <div className="mb-2 sm:mb-3 px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
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
              {tab === "Profile" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      readOnly
                      disabled
                      aria-disabled="true"
                      className="mt-1 block w-full border-gray-300 rounded shadow-sm px-2 py-1 bg-gray-100 text-gray-700 cursor-not-allowed"
                      title="Email can’t be changed here"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      To change your email, contact support.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Trailname
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
                      <span>
                        Email me about new TrekList features, tips, and
                        occasional offers.
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500">
                      You can change this preference anytime.
                    </p>
                  </div>
                </>
              )}

              {tab === "Security" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Current Password
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
                    <label className="block text-sm font-medium text-gray-700">
                      New Password
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
                    <label className="block text-sm font-medium text-gray-700">
                      Confirm New Password
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2 py-1 bg-primary text-base-100 rounded flex items-center hover:bg-primary/80"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div>Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
