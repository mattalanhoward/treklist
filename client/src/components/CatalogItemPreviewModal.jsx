import React, { useMemo } from "react";
import { FaTimes } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import ImageCarousel from "./ImageCarousel";
import ButtonLink from "./ui/ButtonLink";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";

export default function CatalogItemPreviewModal({
  isOpen,
  onClose,
  item,
  loading,
  error,
  alreadyImported = false,
  onImport,
  importing = false,
}) {
  const { t } = useTranslation("common");

  const unit = useUnit();
  const { unitLabel, formatInput } = useWeightInput(unit);

  const catalogImages = useMemo(() => {
    return Array.isArray(item?.imageUrls) ? item.imageUrls : [];
  }, [item?.imageUrls]);

  const primaryOffer = useMemo(() => {
    const offers = Array.isArray(item?.offers) ? item.offers : [];
    return offers
      .slice()
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))[0];
  }, [item?.offers]);

  // Imported-only specs come from CatalogItem.attributes
  const importedSpecs = useMemo(() => {
    const attrs = item?.attributes;
    if (!attrs) return null;

    // Map vs plain object
    let entries = [];
    if (attrs instanceof Map) entries = Array.from(attrs.entries());
    else if (typeof attrs === "object" && !Array.isArray(attrs))
      entries = Object.entries(attrs);

    const filtered = entries.filter(
      ([k, v]) => String(k || "").trim() && String(v ?? "").trim()
    );
    return filtered.length ? filtered : null;
  }, [item?.attributes]);

  const displayWeight = useMemo(() => {
    if (!item || typeof item.weightGrams !== "number") return "";
    return formatInput(item.weightGrams);
  }, [item, formatInput]);

  if (!isOpen) return null;

  // NOTE: z-index slightly higher than GlobalItemModal so it sits above it.
  // Style/layout matches GlobalItemEditModal imported layout.
  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-[60]">
      <div
        className={
          "bg-neutralAlt rounded-lg shadow-2xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4 " +
          "max-h-[90vh] overflow-y-auto " +
          "max-w-3xl"
        }
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xl font-semibold text-primary truncate">
              {t("catalogPreview.titleFallback")}
            </h2>

            {alreadyImported && (
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                {t("catalogPreview.badges.alreadyAdded")}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label={t("actions.close")}
            title={t("actions.close")}
          >
            <FaTimes />
          </button>
        </div>

        {error && <div className="text-error mb-2">{error}</div>}

        {loading ? (
          <div className="py-8 px-3">
            <div className="mt-4 h-24 bg-white/60 rounded" />
            <div className="mt-3 h-24 bg-white/60 rounded" />
          </div>
        ) : !item ? (
          <div className="py-8 px-3 text-primary/70 text-sm">—</div>
        ) : (
          <>
            {/* Imported layout (locked fields + images + specs display-only) */}
            <div className="sm:grid sm:grid-cols-2 sm:gap-6">
              <div className="sm:flex-1">
                {/* “Details” list (label on left, value on right) */}
                <div className="rounded overflow-hidden">
                  {/* Item Type */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.itemType")}:
                    </div>
                    <div className="text-primary break-words">
                      {item.itemType || "—"}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.name")}:
                    </div>
                    <div className="text-primary break-words">
                      {item.name || "—"}
                    </div>
                  </div>

                  {/* Brand */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.brand")}:
                    </div>
                    <div className="text-primary break-words">
                      {item.brand || "—"}
                    </div>
                  </div>

                  {/* Weight (read-only, display like the other rows) */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.weight", { unit: unitLabel })}:
                    </div>
                    <div className="text-primary break-words">
                      {typeof item.weightGrams === "number"
                        ? displayWeight
                        : "—"}
                    </div>
                  </div>

                  {/* Imported-only specs (display-only) — no header */}
                  {importedSpecs &&
                    importedSpecs.map(([k, v]) => (
                      <div
                        key={k}
                        className={
                          "grid grid-cols-[140px_1fr] gap-3 items-start px-3 py-1 "
                        }
                      >
                        <div className="text-primary font-semibold truncate">
                          {k}:
                        </div>
                        <div className="text-primary break-words">
                          {v == null || String(v).trim() === ""
                            ? "—"
                            : String(v)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right (desktop only) */}
              <div className="hidden sm:flex items-center justify-center">
                <div className="bg-white py-2 px-2 w-full max-w-md">
                  {/* Lock the media area height so the modal never grows when carousel/dots load */}
                  <div className="h-[260px] w-full overflow-hidden flex items-center justify-center">
                    {catalogImages?.length ? (
                      <ImageCarousel
                        images={catalogImages}
                        alt={`${item.brand ? item.brand + " " : ""}${
                          item.name || ""
                        }`}
                        loading={false}
                      />
                    ) : (
                      <div className="h-full w-full bg-neutralAlt/20 rounded" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description (label above, plain text, not textarea) */}
            <div className="mt-4 mb-6 px-3">
              <label className="block font-semibold text-primary mb-1">
                {t("globalItemModal.labels.description")}
              </label>
              <div className="text-primary/90 whitespace-pre-line leading-6 min-h-[120px] max-h-[160px] overflow-y-auto pr-2">
                {item.description || "—"}
              </div>
            </div>
          </>
        )}

        {/* Actions (match layout: left = Buy, right = Close) */}
        <div className="mt-3 flex justify-between">
          <div className="flex space-x-2">
            {primaryOffer?.deepLink ? (
              <ButtonLink href={primaryOffer.deepLink}>
                {primaryOffer.merchantName
                  ? primaryOffer.merchantName
                  : "Product Page"}
              </ButtonLink>
            ) : loading ? (
              <button
                type="button"
                disabled
                className="px-2 py-1 bg-primary/10 text-primary/60 rounded-md shadow"
                style={{ minWidth: 110 }}
              >
                Loading…
              </button>
            ) : null}
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onImport}
              disabled={!item || loading || importing || alreadyImported}
              className={`px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 ${
                !item || loading || importing || alreadyImported
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              title={
                alreadyImported
                  ? t("catalogPreview.messages.alreadyAdded")
                  : undefined
              }
            >
              {importing
                ? t("catalogPreview.buttons.importing")
                : t("catalogPreview.buttons.import")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary sm:text-base"
            >
              {t("actions.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
