// src/components/PublicItemModal.jsx
import React from "react";
import { FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";

function gToOz(g) {
  return typeof g === "number" ? g / 28.349523125 : null;
}

function fmtWeight(g, unit) {
  if (g == null || Number.isNaN(g)) return "";
  if (unit === "oz") return `${(gToOz(Number(g)) ?? 0).toFixed(2)} oz`;
  return `${Math.round(Number(g))} g`;
}

export default function PublicItemModal({ item, onClose, unit }) {
  const { t } = useTranslation("common");

  React.useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const g = Number(item.weight_g) || 0;
  const safeImages = (Array.isArray(item.imageUrls) ? item.imageUrls : []).filter(
    (u) => typeof u === "string" && u.trim() && /^https?:\/\//i.test(u.trim()),
  );
  const hasImage = safeImages.length > 0;
  const linkHref = item.affiliate?.deepLink || item.affiliate?.url || item.link || null;
  const linkLabel = item.affiliate?.merchantName || item.brand || t("publicList.item.viewProduct");

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={
          "bg-[rgb(var(--color-base-100-rgb))] sm:rounded-lg shadow-2xl w-full sm:mx-4 " +
          "px-4 py-4 sm:px-6 sm:py-6 border border-[rgba(var(--color-primary-rgb),0.15)] " +
          "modal-mobile-h sm:h-auto sm:max-h-[90vh] flex flex-col " +
          (hasImage ? "sm:max-w-4xl" : "sm:max-w-2xl")
        }
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3 flex-shrink-0">
          <h2 className="text-xl font-semibold text-[rgb(var(--color-primary-rgb))]">
            {t("globalItemEditModal.titleList", "Item Details")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[rgb(var(--color-error-rgb))] hover:opacity-70"
            aria-label={t("actions.close")}
          >
            <FiX />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Mobile image */}
          {hasImage && (
            <div className="sm:hidden mb-3 flex items-center justify-center bg-white rounded border border-[rgba(var(--color-primary-rgb),0.15)] py-2 px-2">
              <div className="h-[200px] w-full overflow-hidden flex items-center justify-center">
                <img
                  src={safeImages[0]}
                  alt={`${item.brand ? item.brand + " " : ""}${item.name || ""}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Two-column: fields left, image right */}
          <div className={`sm:grid sm:gap-6 ${hasImage ? "sm:grid-cols-2" : ""}`}>
            <div>
              <div className="rounded overflow-hidden">
                {[
                  [t("globalItemModal.labels.itemType"), item.itemType || "—"],
                  [t("globalItemModal.labels.name"), item.name || "—"],
                  [t("globalItemModal.labels.brand"), item.brand || "—"],
                  [t("globalItemModal.labels.weight", { unit }), fmtWeight(g, unit) || "—"],
                  [t("publicList.item.quantity"), String(item.qty ?? 1)],
                  ...(item.consumable
                    ? [[t("publicList.item.consumable"), <span key="c" className="text-green-600">{t("common.yes", "Yes")}</span>]]
                    : []),
                  ...(item.worn
                    ? [[t("publicList.item.worn"), <span key="w" className="text-blue-600">{t("common.yes", "Yes")}</span>]]
                    : []),
                ].map(([label, value], i) => (
                  <div key={i} className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-[rgb(var(--color-primary-rgb))] font-semibold">{label}:</div>
                    <div className="text-[rgb(var(--color-primary-rgb))] break-words">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop image */}
            {hasImage && (
              <div className="hidden sm:flex items-center justify-center">
                <div className="bg-white rounded border border-[rgba(var(--color-primary-rgb),0.15)] py-2 px-2 w-full max-w-md">
                  <div className="h-[260px] w-full overflow-hidden flex items-center justify-center">
                    <img
                      src={safeImages[0]}
                      alt={`${item.brand ? item.brand + " " : ""}${item.name || ""}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div className="mt-4 mb-6 px-3">
              <div className="font-semibold text-[rgb(var(--color-primary-rgb))] mb-1">
                {t("globalItemModal.labels.description")}
              </div>
              <div className="text-[rgb(var(--color-primary-rgb))]/90 whitespace-pre-line leading-6 min-h-[60px] pr-2">
                {item.description}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex justify-between items-center flex-shrink-0">
          <div>
            {linkHref && (
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2 py-1 bg-[rgb(var(--color-secondary-rgb))] text-[rgb(var(--color-base-100-rgb))] font-semibold rounded hover:opacity-80 sm:text-base"
              >
                {linkLabel}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 bg-[rgb(var(--color-neutral-rgb))] rounded hover:opacity-80 text-[rgb(var(--color-primary-rgb))] sm:text-base"
          >
            {t("actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
