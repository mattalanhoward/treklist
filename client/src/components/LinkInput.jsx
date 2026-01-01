// src/components/LinkInput.jsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export default function LinkInput({
  value,
  onChange,
  label = "Link",
  name = "link",
  placeholder = "",
  required = false,
  disabled = false,
}) {
  const { t } = useTranslation("common");
  const [error, setError] = useState("");

  // Called when the user leaves (blurs) the input, or right before form submit
  const normalizeAndValidate = () => {
    const raw = (value || "").trim();

    if (!raw) {
      // If it's empty and not required, clear any error
      if (!required) {
        setError("");
      } else {
        // browser will also enforce required on submit, but this gives inline feedback
        setError(t("linkInput.errors.required"));
      }
      return;
    }

    // 1) If it doesn’t start with http:// or https://, prepend https://
    let candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = "https://" + candidate;
    }

    // 2) Try the native URL constructor
    try {
      // This will throw if "candidate" is not a syntactically valid URL
      new URL(candidate);

      // If valid, clear error and propagate the normalized value
      setError("");
      onChange(candidate);
    } catch {
      setError(t("linkInput.errors.invalid"));
    }
  };

  // Called on each keystroke
  const handleChange = (e) => {
    if (error) setError("");
    onChange(e.target.value);
  };

  // Use a translated placeholder if none is passed in
  const effectivePlaceholder =
    placeholder || t("linkInput.placeholder", { defaultValue: "example.com" });

  // Remove any leading http(s):// before rendering
  const displayPlaceholder = effectivePlaceholder.replace(/^https?:\/\//i, "");

  const errorId = error ? `${name}-error` : undefined;

  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs sm:text-sm font-medium text-primary mb-0.5"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        id={name}
        name={name}
        type="url"
        placeholder={displayPlaceholder}
        value={value}
        onChange={handleChange}
        onBlur={normalizeAndValidate}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={
          "mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary text-sm " +
          (error ? "border-error" : "")
        }
      />

      {error && (
        <p id={errorId} className="mt-1 text-error text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
