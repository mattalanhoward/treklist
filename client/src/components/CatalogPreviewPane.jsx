// src/components/CatalogPreviewPane.jsx
// Desktop right-hand preview pane for the two-pane add-gear modal.
// Folds the old CatalogItemPreviewModal content into an inline, non-stacked
// surface: image, brand eyebrow, name, weight hero + precision disclosure,
// key specs, fit-variant picker, description, buy link, and a select checkbox.
import React, { useEffect, useMemo, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import ImageCarousel from "./ImageCarousel";
import VariantSelector from "./VariantSelector";
import ButtonLink from "./ui/ButtonLink";
import { merchantFromUrl } from "../utils/merchantFromUrl";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import { useUserSettings } from "../contexts/UserSettings";
import { formatAttributesForDisplay } from "../utils/attributeLabels";
import { tItemType } from "../config/catalogTaxonomy";

// Month-year "verified" stamp for the precision disclosure line.
function verifiedStamp(dateish, locale) {
  const d = dateish ? new Date(dateish) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString(locale || undefined, { month: "short", year: "numeric" });
  } catch {
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
}

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
}) {
  const { t, i18n } = useTranslation("common");
  const unit = useUnit();
  const { unitLabel, formatInput } = useWeightInput(unit);
  const { measurementSystem } = useUserSettings();

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

  // Precision disclosure — honest about what the number is.
  // "flat across sizes": variants carry no distinct per-variant weight.
  const disclosure = useMemo(() => {
    const parts = [t("catalogPreview.disclosure.manufacturerSpec", "Manufacturer spec")];
    if (hasVariants) {
      const vw = variants.map((v) => v.weightGrams).filter((n) => typeof n === "number");
      if (vw.length === 0 || new Set(vw).size <= 1) {
        parts.push(t("catalogPreview.disclosure.flatAcrossSizes", "flat across sizes"));
      }
    }
    const stamp = verifiedStamp(item?.updatedAt, i18n.language);
    if (stamp) parts.push(t("catalogPreview.disclosure.verified", "verified {{date}}", { date: stamp }));
    return parts.join(" · ");
  }, [t, i18n.language, hasVariants, variants, item?.updatedAt]);

  if (loading) {
    return (
      <div className="hidden sm:flex flex-1 items-center justify-center min-w-0">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="hidden sm:flex flex-1 items-center justify-center min-w-0 px-6">
        <p className="text-sm text-error text-center">{error}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="hidden sm:flex flex-1 items-center justify-center min-w-0 px-6">
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
    <div className="hidden sm:flex flex-1 min-w-0 flex-col overflow-y-auto px-5 py-4 gap-4">
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

      {/* Actions */}
      <div className="mt-auto flex items-center gap-3 flex-wrap border-t border-primary/10 pt-3">
        {buyLink && (
          <ButtonLink href={buyLink}>
            {buyLabel ?? t("globalItemEditModal.buttons.productPage", "Product page")}
          </ButtonLink>
        )}
        {onToggleSelect && (
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
        )}
      </div>
    </div>
  );
}
