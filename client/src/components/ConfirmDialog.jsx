// src/components/ConfirmDialog.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation("common");

  if (!isOpen) return null;

  const effectiveMessage = message || "";
  const effectiveTitle = title || t("confirm.defaultTitle", "Are you sure?");
  const effectiveConfirmText = confirmText || t("actions.delete", "Delete");
  const effectiveCancelText = cancelText || t("actions.cancel", "Cancel");

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Dialog box */}
      <div className="bg-neutralAlt rounded-lg shadow-lg max-w-sm w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3
            id="confirm-dialog-title"
            className="text-lg text-center font-semibold text-secondary"
          >
            {effectiveTitle}
          </h3>
        </div>

        {/* Body */}
        {effectiveMessage && (
          <div className="px-6 py-4">
            <p className="text-center text-secondary">{effectiveMessage}</p>
          </div>
        )}

        {/* Footer */}
        <div className="rounded-lg px-6 py-4 bg-neutralAlt flex justify-center space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 bg-neutralAlt text-primary rounded hover:bg-neutralAlt/90 focus:outline-none focus:ring-2 focus:ring-neutral"
          >
            {effectiveCancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-2 py-1 bg-error text-neutral font-semibold rounded shadow hover:bg-error/80 focus:outline-none focus:ring-2 focus:ring-error"
          >
            {effectiveConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
