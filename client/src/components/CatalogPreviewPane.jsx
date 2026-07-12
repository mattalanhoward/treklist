// src/components/CatalogPreviewPane.jsx
// Desktop right-hand preview pane for the two-pane add-gear modal.
// Folds the old CatalogItemPreviewModal content into an inline, non-stacked
// surface: image, brand eyebrow, name, weight hero + precision disclosure,
// key specs, fit-variant picker, description, buy link, and a select checkbox.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiFlag } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import ImageCarousel from "./ImageCarousel";
import VariantSelector from "./VariantSelector";
import ButtonLink from "./ui/ButtonLink";
import ReportIssuePopover from "./ReportIssuePopover";
import { merchantFromUrl } from "../utils/merchantFromUrl";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import { useUserSettings } from "../contexts/UserSettings";
import { formatAttributesForDisplay } from "../utils/attributeLabels";
import { tItemType, tCategory } from "../config/catalogTaxonomy";
import { buildWeightDisclosure } from "../utils/weightDisclosure";

export default function CatalogPreviewPane({
  item,
  loading,
  error,
  selected = false,
  onToggleSelect,
  initialSelectedOptions = null,
  // Called with the resolved variant key whenever the user explicitly picks a
  // fit variant here — lets the parent drop the "size not set" flag.
  onExplicitVariantChange,
  // True when this item has fit variants but no fit has been explicitly chosen.
  sizeUnset = false,
  selectDisabled = false,
  // Mobile bottom-sheet layout (shares all the preview content; swaps the
  // desktop "Select for adding" checkbox for an immediate Add button).
  sheet = false,
  // Immediate-action button (mobile sheet add, or desktop swap "Swap for this").
  // When provided it replaces the batch "Select for adding" checkbox.
  onAdd,
  adding = false,
  added = false,
  addLabel,
}) {
  const { t, i18n } = useTranslation("common");
  const unit = useUnit();
  const { unitLabel, formatInput } = useWeightInput(unit);
  const { measurementSystem } = useUserSettings();
  const reportFlagRef = useRef(null);
  const [reportOpen, setReportOpen] = useState(false);

  const variantAxes = useMemo(
    () => (Array.isArray(item?.variantAxes) ? item.variantAxes : []),
    [item?.variantAxes],
  );
  const variants = useMemo(
    () => (Array.isArray(item?.variants) ? item.variants : []),
    [item?.variants],
  );
  const hasVariants = variantAxes.length > 0 && variants.length > 0;
  const [selectedOptions, setSelectedOptions] = useState({});

  // Seed the picker: honour a caller-supplied selection (carried from a row
  // quick-pick) when it matches a real variant, else the catalog default.
  useEffect(() => {
    if (!hasVariants) {
      setSelectedOptions({});
      return;
    }
    if (initialSelectedOptions) {
      const matches = variants.some((v) =>
        variantAxes.every(
          (a) => (v.options?.[a.name] ?? "") === (initialSelectedOptions?.[a.name] ?? ""),
        ),
      );
      if (matches) {
        setSelectedOptions(initialSelectedOptions);
        return;
      }
    }
    const pick = variants.find((v) => v.key === item?.defaultVariantKey) || variants[0];
    setSelectedOptions(pick ? { ...pick.options } : {});
  }, [hasVariants, variants, variantAxes, item?._id, item?.defaultVariantKey, initialSelectedOptions]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return (
      variants.find((v) =>
        variantAxes.every((a) => (v.options?.[a.name] ?? "") === (selectedOptions?.[a.name] ?? "")),
      ) || null
    );
  }, [hasVariants, variants, variantAxes, selectedOptions]);

  const handleAxisChange = (axisName, value) => {
    const next = { ...selectedOptions, [axisName]: value };
    setSelectedOptions(next);
    const match = variants.find((v) =>
      variantAxes.every((a) => (v.options?.[a.name] ?? "") === (next?.[a.name] ?? "")),
    );
    if (match && onExplicitVariantChange) onExplicitVariantChange(String(item._id), match.key);
  };

  const catalogImages = useMemo(() => {
    const variantUrls = Array.isArray(selectedVariant?.imageUrls) ? selectedVariant.imageUrls : [];
    const baseUrls = Array.isArray(item?.imageUrls) ? item.imageUrls : [];
    const urls = variantUrls.length ? variantUrls : baseUrls;
    return urls
      .filter((u) => typeof u === "string" && u.trim())
      .filter((u) => /^https?:\/\//i.test(u.trim()));
  }, [item?.imageUrls, selectedVariant]);

  const hasImages = catalogImages.length > 0;

  const primaryOffer = useMemo(() => {
    const offers = Array.isArray(item?.offers) ? item.offers : [];
    return offers.slice().sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))[0];
  }, [item?.offers]);

  const importedSpecs = useMemo(() => {
    if (!item?.attributes) return null;
    const merged = selectedVariant?.attributes
      ? { ...item.attributes, ...selectedVariant.attributes }
      : item.attributes;
    const formatted = formatAttributesForDisplay(merged, item.itemType, measurementSystem);
    return formatted.length ? formatted : null;
  }, [item?.attributes, item?.itemType, measurementSystem, selectedVariant]);

  const effectiveWeightGrams =
    selectedVariant && typeof selectedVariant.weightGrams === "number"
      ? selectedVariant.weightGrams
      : item && typeof item.weightGrams === "number"
        ? item.weightGrams
        : null;

  const displayWeight = useMemo(
    () => (typeof effectiveWeightGrams === "number" ? formatInput(effectiveWeightGrams) : ""),
    [effectiveWeightGrams, formatInput],
  );

  // Precision disclosure — honest about what the number is (shared with the
  // Item Details modal via buildWeightDisclosure).
  const disclosure = useMemo(
    () =>
      buildWeightDisclosure({
        t,
        locale: i18n.language,
        hasVariants,
        variants,
        updatedAt: item?.updatedAt,
      }),
    [t, i18n.language, hasVariants, variants, item?.updatedAt],
  );

  // Close the report popover whenever the previewed item changes.
  useEffect(() => {
    setReportOpen(false);
  }, [item?._id]);

  // Desktop hides an empty pane behind the media query; the sheet is only ever
  // mounted with an item to show, so it renders these states inline.
  const stateBase = sheet ? "flex" : "hidden sm:flex";

  if (loading) {
    return (
      <div className={`${stateBase} flex-1 items-center justify-center min-w-0 py-10`}>
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${stateBase} flex-1 items-center justify-center min-w-0 px-6 py-10`}>
        <p className="text-sm text-error text-center">{error}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={`${stateBase} flex-1 items-center justify-center min-w-0 px-6`}>
        <p className="text-sm text-primary/40 text-center">
          {t("catalogPreview.emptyPane", "Select a result to preview it here.")}
        </p>
      </div>
    );
  }

  const buyLink =
    selectedVariant?.deepLink || primaryOffer?.deepLink || item?.affiliate?.deepLink || item?.link;
  const buyLabel =
    (selectedVariant?.deepLink && merchantFromUrl(selectedVariant.deepLink)) ||
    primaryOffer?.merchantName ||
    item?.affiliate?.merchantName ||
    null;

  return (
    <div
      className={
        sheet
          ? "flex min-w-0 flex-col px-4 pt-1 pb-2 gap-4"
          : "hidden sm:flex flex-1 min-w-0 flex-col overflow-y-auto px-5 py-4 gap-4"
      }
    >
      {/* Top: image + identity */}
      <div className="flex gap-4">
        {hasImages && (
          <div className="w-[130px] h-[130px] flex-shrink-0 flex items-center justify-center rounded border border-primary/15 bg-white overflow-hidden">
            <ImageCarousel
              images={catalogImages}
              alt={`${item.brand ? item.brand + " " : ""}${item.name || ""}`}
              loading={false}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {item.brand && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/50">
              {item.brand}
            </span>
          )}
          <h3 className="text-lg font-semibold text-primary leading-snug">{item.name}</h3>
          {/* Weight hero */}
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-3xl font-bold text-primary tabular-nums tracking-tight">
              {displayWeight || "—"}
            </span>
            <span className="text-sm text-primary/60">{unitLabel}</span>
          </div>
          <span className="text-[11.5px] text-primary/45">{disclosure}</span>
        </div>
      </div>

      {/* Key specs */}
      {importedSpecs && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-primary/10 pt-3">
          <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {importedSpecs.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-xs">
                <span className="text-primary/50 break-words">{label}</span>
                <span className="font-medium text-primary text-right break-words">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fit-variant picker */}
      {hasVariants && (
        <div className="border-t border-primary/10 pt-3">
          <VariantSelector
            axes={variantAxes}
            selectedOptions={selectedOptions}
            onChange={handleAxisChange}
            disabled={selectDisabled}
          />
          {sizeUnset && (
            <p className="text-[11.5px] text-primary/45 mt-1.5">
              {t(
                "catalogPreview.sizeNotSetHint",
                "No size chosen — the default fit is added and flagged “size not set”, editable later.",
              )}
            </p>
          )}
        </div>
      )}

      {/* Description */}
      {(selectedVariant?.description || item.description) && (
        <div className="border-t border-primary/10 pt-3">
          <p className="text-xs font-semibold text-primary/60 mb-1">
            {tItemType(t, item.itemType) || t("globalItemModal.labels.description", "Description")}
          </p>
          <div className="text-[13px] text-primary/80 whitespace-pre-line leading-6">
            {selectedVariant?.description || item.description}
          </div>
        </div>
      )}

      {/* Report an issue — quiet flag anchoring the popover (decision 12) */}
      <div className="border-t border-primary/10 pt-3">
        <button
          ref={reportFlagRef}
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11.5px] text-primary/45 hover:text-primary/70 transition-colors"
        >
          <FiFlag size={12} />
          {t("reportIssue.flag", "Report an issue")}
          <span className="font-mono text-[10px] text-primary/30">
            {t("reportIssue.flagHint", "weight · category · name · image")}
          </span>
        </button>
      </div>
      {reportOpen && (
        <ReportIssuePopover
          anchorRef={reportFlagRef}
          item={item}
          variantKey={selectedVariant?.key || null}
          shownWeight={displayWeight ? `${displayWeight} ${unitLabel}` : ""}
          shownCategory={tCategory(t, item.category) || item.category || ""}
          shownItemType={tItemType(t, item.itemType) || item.itemType || ""}
          disclosure={disclosure}
          onClose={() => setReportOpen(false)}
        />
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center gap-3 flex-wrap border-t border-primary/10 pt-3">
        {buyLink && (
          <ButtonLink href={buyLink}>
            {buyLabel ?? t("globalItemEditModal.buttons.productPage", "Product page")}
          </ButtonLink>
        )}
        {onAdd ? (
          <button
            type="button"
            onClick={() => !added && !adding && onAdd?.(selectedVariant?.key)}
            disabled={added || adding}
            className={`ml-auto flex items-center justify-center gap-2 rounded-lg px-4 min-h-[44px] text-sm font-medium transition-colors ${
              added
                ? "bg-secondary/10 text-secondary cursor-default"
                : "bg-secondary text-white hover:bg-secondary/90 disabled:opacity-60"
            }`}
          >
            {added ? (
              <>
                <FiCheck size={15} />
                {t("catalogPreview.inList", "In list")}
              </>
            ) : adding ? (
              t("catalogPreview.buttons.importing", "Adding…")
            ) : (
              addLabel ?? t("catalogPreview.buttons.import", "Add")
            )}
          </button>
        ) : onToggleSelect ? (
          <button
            type="button"
            onClick={() => !selectDisabled && onToggleSelect(String(item._id))}
            disabled={selectDisabled}
            aria-pressed={selected}
            className="ml-auto flex items-center gap-2 text-sm text-primary/70 hover:text-primary disabled:opacity-50 transition-colors"
          >
            <span
              className={`h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 ${
                selected ? "bg-secondary border-secondary text-white" : "border-primary/40 bg-base-100"
              }`}
            >
              {selected && <FiCheck size={13} />}
            </span>
            {selected
              ? t("catalogPreview.selectedForAdding", "Selected for adding")
              : t("catalogPreview.selectForAdding", "Select for adding")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
