// src/components/GlobalItemEditModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import LinkInput from "../components/LinkInput";
import ConfirmDialog from "./ConfirmDialog";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import { useUserSettings } from "../contexts/UserSettings";
import { FiX } from "react-icons/fi";
import { tItemType, tCategory, CATALOG_CATEGORIES } from "../config/catalogTaxonomy";
import ImageCarousel from "./ImageCarousel";
import ButtonLink from "./ui/ButtonLink";
import Spinner from "../components/ui/Spinner";
import {
  fetchGlobalItemCached,
  invalidateGlobalItemCache,
} from "../services/globalItemCache";
import { formatAttributesForDisplay } from "../utils/attributeLabels";

export default function GlobalItemEditModal({
  item,
  onClose,
  onSaved,
  allowDelete = true,
  listId,
  catId,
  context = "global", // "global" | "list"
}) {
  const { t } = useTranslation("common");

  const [form, setForm] = useState({
    catalogCategory: "",
    itemType: "",
    name: "",
    brand: "",
    description: "",
    weight: "",
    link: "",
  });

  const unit = useUnit();
  const { unitLabel, formatInput, parseInput } = useWeightInput(unit);
  const { measurementSystem } = useUserSettings();

  const [displayWeight, setDisplayWeight] = useState("");
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [globalTemplate, setGlobalTemplate] = useState(null);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const [catalogImages, setCatalogImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [primaryOffer, setPrimaryOffer] = useState(null);

  const [imageFailed, setImageFailed] = useState(false);
  // Start true - will be set to false when we confirm no images or image is loaded
  const [loadingImageAsset, setLoadingImageAsset] = useState(true);

  // Image URL for custom items (single URL, stored as imageUrls[0])
  const [imageUrl, setImageUrl] = useState("");

  const itemId = item ? item._id : null;
  const isListContext = useMemo(() => {
    return (
      context === "list" || (!!listId && !!catId) || Boolean(item?.globalItem)
    );
  }, [context, listId, catId, item?.globalItem]);

  const [catalogLoadedFor, setCatalogLoadedFor] = useState(null);

  // In list context, GearItem may only have globalItem id.
  const globalId = useMemo(() => {
    if (!item) return null;
    return isListContext ? item?.globalItem || null : item?._id || null;
  }, [isListContext, item]);

  // Prefer the fetched global template when present; otherwise use item
  const template = useMemo(() => {
    return globalTemplate || item || null;
  }, [globalTemplate, item]);

  const resolvedProductId = useMemo(() => {
    const pid = item?.productId
      ? String(item.productId)
      : template?.productId
        ? String(template.productId)
        : null;

    return pid || null;
  }, [item?.productId, template?.productId]);

  useEffect(() => {
    setCatalogLoadedFor(null);
  }, [resolvedProductId]);

  // Do we need the GlobalItem fetch to know the mode?
  const needsTemplateToDecide = useMemo(() => {
    if (!isListContext) return false;
    const hasEnoughOnItem =
      Boolean(item?.affiliate?.network) || Boolean(item?.productId);
    return Boolean(globalId) && !hasEnoughOnItem;
  }, [isListContext, globalId, item?.affiliate?.network, item?.productId]);

  // prevents stale template from previous item causing wrong fields briefly
  useEffect(() => {
    setGlobalTemplate(null);
  }, [globalId]);

  // While we wait on the global template ONLY to decide imported vs custom,
  // disable editing + saving until resolved.
  const isResolvingMode =
    Boolean(item) && needsTemplateToDecide && !globalTemplate;

  const resolvedViewMode = useMemo(() => {
    if (!item) return "loading";
    const direct =
      Boolean(item?.affiliate?.network) || Boolean(item?.productId);
    const viaTemplate =
      Boolean(globalTemplate?.productId) ||
      Boolean(globalTemplate?.affiliate?.network);
    return direct || viaTemplate ? "imported" : "custom";
  }, [
    itemId,
    item?.affiliate?.network,
    item?.productId,
    globalTemplate?.productId,
    globalTemplate?.affiliate?.network,
  ]);

  const viewMode = isResolvingMode ? "custom" : resolvedViewMode;

  // --- single global fetch (cached) ---
  useEffect(() => {
    let cancelled = false;

    async function loadGlobal() {
      if (!isListContext || !globalId) {
        setGlobalTemplate(null);
        setLoadingGlobal(false);
        return;
      }

      setGlobalTemplate(null);
      setLoadingGlobal(true);
      try {
        const data = await fetchGlobalItemCached(globalId);
        if (!cancelled) setGlobalTemplate(data);
      } finally {
        if (!cancelled) setLoadingGlobal(false);
      }
    }

    loadGlobal();
    return () => {
      cancelled = true;
    };
  }, [isListContext, globalId]);

  const isCustom = viewMode === "custom";
  const isImported = viewMode === "imported";
  const disableEdits = saving || isResolvingMode;

  // --- Fetch catalog item details (images + offers) for imported items ---
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (viewMode !== "imported") {
        setCatalogImages([]);
        setPrimaryOffer(null);
        setLoadingImages(false);
        return;
      }

      if (!resolvedProductId) {
        setCatalogImages([]);
        setPrimaryOffer(null);
        setLoadingImages(false);
        return;
      }

      setLoadingImages(true);

      try {
        const res = await api.get(`/catalog/items/${resolvedProductId}`);
        const data = res?.data || {};

        const urls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
        if (!cancelled) {
          setCatalogImages(urls);
          // Pre-set loading state if we have images to avoid flash before preload effect runs
          const hasValidImages = urls.some(
            (u) => typeof u === "string" && u.trim() && /^https?:\/\//i.test(u.trim())
          );
          if (hasValidImages) {
            setLoadingImageAsset(true);
          }
        }

        const offers = Array.isArray(data.offers) ? data.offers : [];
        const best = offers
          .slice()
          .sort(
            (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0),
          )[0];

        if (!cancelled) setPrimaryOffer(best || null);
      } catch {
        if (!cancelled) {
          setCatalogImages([]);
          setPrimaryOffer(null);
        }
      } finally {
        if (!cancelled) setLoadingImages(false);
        setCatalogLoadedFor(resolvedProductId);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [resolvedProductId, viewMode]);

  // --- Image helpers ---
  const safeCatalogImages = useMemo(() => {
    return (Array.isArray(catalogImages) ? catalogImages : [])
      .filter((u) => typeof u === "string" && u.trim())
      .filter((u) => /^https?:\/\//i.test(u.trim()));
  }, [catalogImages]);

  const hasImages = safeCatalogImages.length > 0;

  // Collapse image column entirely if no images OR image failed
  const showImageBlock = isImported && hasImages && !imageFailed;

  // Show image column for custom items that have a URL set
  const showCustomImageBlock = isCustom && Boolean(imageUrl.trim());

  // Reset image state when switching products / modes
  // Only reset loadingImageAsset when NOT imported (to avoid flash when becoming imported)
  useEffect(() => {
    setImageFailed(false);
    if (!isImported) {
      setLoadingImageAsset(false);
    }
  }, [resolvedProductId, isImported]);

  // Preload first image: if it errors, treat as "no image"
  useEffect(() => {
    if (!isImported) return;

    if (!hasImages) {
      setLoadingImageAsset(false);
      setImageFailed(false);
      return;
    }

    setLoadingImageAsset(true);
    setImageFailed(false);

    let cancelled = false;
    const img = new Image();

    img.onload = () => {
      if (!cancelled) setLoadingImageAsset(false);
    };

    img.onerror = () => {
      if (!cancelled) {
        setLoadingImageAsset(false);
        setImageFailed(true);
      }
    };

    img.src = safeCatalogImages[0];

    return () => {
      cancelled = true;
    };
  }, [isImported, hasImages, safeCatalogImages]);

  // Hydrate list-editable fields from the *item*
  useEffect(() => {
    if (!item) return;
    const initialGrams = item.weight ?? "";
    setForm((prev) => ({
      ...prev,
      weight: initialGrams,
      ...(viewMode === "custom"
        ? {
            catalogCategory: item.catalogCategory || "",
            itemType: item.itemType || "",
            name: item.name || "",
            brand: item.brand || "",
            description: item.description || "",
            link: item.link || "",
          }
        : null),
    }));
    setWorn(!!item.worn);
    setConsumable(!!item.consumable);
    setQuantity(item.quantity || 1);
    if (viewMode === "custom") {
      const urls = item.imageUrls ?? item.globalItem?.imageUrls ?? [];
      setImageUrl(Array.isArray(urls) && urls[0] ? urls[0] : "");
    }
  }, [itemId, viewMode, item]);

  // Fallback: if imageUrl is empty after hydration but globalTemplate has imageUrls, use those.
  // Handles the case where the list's GearItem.imageUrls is stale (not yet cascaded from GlobalItem).
  useEffect(() => {
    if (viewMode !== "custom") return;
    if (!globalTemplate?.imageUrls?.length) return;
    setImageUrl((prev) => prev || globalTemplate.imageUrls[0]);
  }, [viewMode, globalTemplate]);

  // Hydrate imported read-only fields from the *template*
  useEffect(() => {
    if (!item) return;
    if (!isImported) return;
    if (!template) return;

    setForm((prev) => ({
      ...prev,
      itemType: template.itemType || "",
      name: template.name || "",
      brand: template.brand || "",
      description: template.description || "",
      link: template.link || "",
    }));
  }, [isImported, template, itemId, item]);

  // Recalc display weight when unit or item changes
  useEffect(() => {
    if (!item) return;
    const initialGrams = item.weight ?? "";
    setDisplayWeight(initialGrams !== "" ? formatInput(initialGrams) : "");
  }, [itemId, unit, formatInput, item]);

  const validate = () => {
    if (viewMode === "custom" && !form.name.trim())
      return t("validation.nameRequired");

    const trimmed = String(displayWeight ?? "").trim();
    const parsed = trimmed === "" ? null : parseInput(trimmed);

    if (trimmed !== "" && parsed == null) return t("validation.weightInvalid");
    if (parsed != null && parsed < 0) return t("validation.weightNegative");

    if (viewMode === "custom" && form.link && !/^https?:\/\//.test(form.link)) {
      return t("validation.urlInvalid");
    }

    if (viewMode === "custom" && imageUrl.trim() && !/^https?:\/\//.test(imageUrl.trim())) {
      return t("validation.urlInvalid");
    }

    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Step 1: validate -> open confirm
  const handleSave = (e) => {
    e.preventDefault();
    if (isResolvingMode) {
      toast.error(t("globalItemEditModal.toast.stillLoading"));
      return;
    }
    const err = validate();
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    setConfirmOpen(true);
  };

  // Step 2: user confirmed
  const handleConfirm = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setError("");

    try {
      const weightValue =
        String(displayWeight ?? "").trim() === ""
          ? null
          : parseInput(displayWeight);

      const basePayload = {
        weight: weightValue,
        worn,
        consumable,
        quantity,
      };

      const globalPayload = { ...basePayload };

      if (viewMode === "custom") {
        globalPayload.catalogCategory = form.catalogCategory || null;
        globalPayload.itemType = form.itemType;
        globalPayload.name = form.name.trim();
        globalPayload.brand = form.brand.trim();
        globalPayload.description = form.description.trim();

        const trimmedLink = (form.link || "").trim();
        globalPayload.link = trimmedLink === "" ? null : trimmedLink;

        const trimmedImage = (imageUrl || "").trim();
        globalPayload.imageUrls = trimmedImage ? [trimmedImage] : [];
      }

      const listPayload = { ...basePayload };

      let updatedSomething = false;
      let touchedGlobal = false;

      if (globalId) {
        try {
          await api.patch(`/global/items/${globalId}`, globalPayload);
          invalidateGlobalItemCache(globalId);

          updatedSomething = true;
          touchedGlobal = true;

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("global-items:updated"));
          }
        } catch (err) {
          if (!(isListContext && err.response?.status === 404)) {
            throw err;
          }
        }
      }

      if (isListContext) {
        await api.patch(
          `/dashboard/${listId}/categories/${catId}/items/${item._id}`,
          listPayload,
        );
        updatedSomething = true;
      }

      if (updatedSomething) {
        // toast.success(
        //   isListContext && touchedGlobal
        //     ? t("globalItemEditModal.toast.updatedEverywhere")
        //     : t("globalItemEditModal.toast.updated"),
        // );
        onSaved?.();
        onClose?.();
      }
    } catch (e) {
      console.error("Error saving item:", e);
      const msg =
        e.response?.data?.message || t("globalItemEditModal.toast.saveFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Now using the utility to get human-readable labels
  const importedSpecs = useMemo(() => {
    if (viewMode !== "imported") return null;
    const attrs = template?.attributes;
    if (!attrs) return null;
    const formatted = formatAttributesForDisplay(attrs, template?.itemType, measurementSystem);
    return formatted.length ? formatted : null;
  }, [viewMode, template?.attributes, template?.itemType, measurementSystem]);

  // PreviewModal-style full-screen spinner conditions
  const showFullscreenSpinner =
    !item ||
    viewMode === "loading" ||
    isResolvingMode ||
    (isImported && loadingImages) ||
    (isImported && resolvedProductId && catalogLoadedFor !== resolvedProductId) ||
    (isImported && loadingImageAsset);

  const modalWidthClass =
    showImageBlock || showCustomImageBlock ? "max-w-4xl" : "max-w-2xl";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-[60]">
      {showFullscreenSpinner ? (
        <Spinner tone="white" />
      ) : (
        <form
          onSubmit={handleSave}
          className={
            "bg-base-100 rounded-lg shadow-2xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4 " +
            "border border-primary/15 max-h-[70vh] sm:max-h-[calc(100vh-5rem)] flex flex-col " +
            modalWidthClass
          }
        >
          {/* Header - fixed at top */}
          <div className="flex justify-between items-center mb-2 sm:mb-3 flex-shrink-0">
            <h2 className="text-xl font-semibold text-primary">
              {isListContext
                ? t("globalItemEditModal.titleList")
                : t("globalItemEditModal.titleGlobal")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-error hover:text-error/80"
              aria-label={t("actions.close")}
              title={t("actions.close")}
            >
              <FiX />
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {error && <div className="text-error mb-2">{error}</div>}

            {isCustom ? (
            <>
              {/* Custom items layout: fields left, image right (when URL set), description below */}
              <div className={`sm:grid sm:gap-6 ${showCustomImageBlock ? "sm:grid-cols-2" : ""}`}>
                {/* Left column: editable form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Row 1: Name | Brand */}
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.name")}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      disabled={disableEdits}
                      className="mt-0.5 block w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.brand")}
                    </label>
                    <input
                      name="brand"
                      value={form.brand}
                      onChange={handleChange}
                      disabled={disableEdits}
                      className="mt-0.5 block w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100"
                    />
                  </div>

                  {/* Row 2: Category | Item Type */}
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.category", "Category")}
                    </label>
                    <select
                      name="catalogCategory"
                      value={form.catalogCategory}
                      onChange={handleChange}
                      disabled={disableEdits}
                      className="mt-0.5 block w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100"
                    >
                      <option value="">{t("myGear.filter.uncategorized", "Uncategorized")}</option>
                      {CATALOG_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {tCategory(t, cat)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.itemType")}
                    </label>
                    <input
                      name="itemType"
                      value={form.itemType}
                      onChange={handleChange}
                      disabled={disableEdits}
                      className="mt-0.5 block w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100"
                    />
                  </div>

                  {/* Row 3: Weight | Link */}
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.weight", { unit: unitLabel })}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayWeight}
                      onChange={(e) => setDisplayWeight(e.target.value)}
                      disabled={disableEdits}
                      className="mt-0.5 block w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100"
                    />
                  </div>

                  <div>
                    <LinkInput
                      value={form.link}
                      onChange={(newLink) =>
                        setForm((f) => ({ ...f, link: newLink }))
                      }
                      label="Link"
                      placeholder="tarptent.com"
                      disabled={disableEdits}
                      required={false}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <LinkInput
                      value={imageUrl}
                      onChange={(val) => setImageUrl(val)}
                      label={t("globalItemModal.labels.imageUrl", "Image URL")}
                      placeholder="https://example.com/image.jpg"
                      disabled={disableEdits}
                      required={false}
                    />
                  </div>
                </div>

                {/* Right column: image preview (desktop only, when URL is set) */}
                {showCustomImageBlock && (
                  <div className="hidden sm:flex items-center justify-center">
                    <div className="bg-white rounded border border-primary/15 py-2 px-2 w-full max-w-md">
                      <div className="h-[260px] w-full overflow-hidden flex items-center justify-center">
                        <img
                          src={imageUrl}
                          alt={`${form.brand ? form.brand + " " : ""}${form.name || ""}`}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description — full width below */}
              <div className="mt-2">
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.description")}
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  disabled={disableEdits}
                  className="mt-0.5 block w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 resize-none h-16 sm:h-[6.5rem]"
                  rows={2}
                />
              </div>
            </>
          ) : (
            <>
              {/* Imported layout (locked fields + optional images + specs) */}
              <div
                className={`sm:grid sm:gap-6 ${
                  showImageBlock ? "sm:grid-cols-2" : "sm:grid-cols-1"
                }`}
              >
                <div className="sm:flex-1">
                  <div className="rounded overflow-hidden">
                    <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                      <div className="text-primary font-semibold">
                        {t("globalItemModal.labels.itemType")}:
                      </div>
                      <div className="text-primary break-words">
                        {tItemType(t, form.itemType) || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                      <div className="text-primary font-semibold">
                        {t("globalItemModal.labels.name")}:
                      </div>
                      <div className="text-primary break-words">
                        {form.name || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                      <div className="text-primary font-semibold">
                        {t("globalItemModal.labels.brand")}:
                      </div>
                      <div className="text-primary break-words">
                        {form.brand || "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3">
                      <div className="text-primary font-semibold">
                        {t("globalItemModal.labels.weight", {
                          unit: unitLabel,
                        })}
                        :
                      </div>
                      <div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={displayWeight}
                          onChange={(e) => setDisplayWeight(e.target.value)}
                          className="w-full max-w-[220px] text-primary bg-base-100 border border-primary/30 rounded px-2 py-1"
                        />
                      </div>
                    </div>

                    {/* Imported-only specs — now with human-readable labels */}
                    {importedSpecs &&
                      importedSpecs.map(([label, value]) => (
                        <div
                          key={label}
                          className="grid grid-cols-[140px_1fr] gap-3 items-start px-3 py-1"
                        >
                          <div className="text-primary font-semibold truncate">
                            {label}:
                          </div>
                          <div className="text-primary break-words">
                            {value}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {showImageBlock && (
                  <div className="hidden sm:flex items-center justify-center">
                    <div className="bg-white rounded border border-primary/15 py-2 px-2 w-full max-w-md">
                      <div className="h-[260px] w-full overflow-hidden flex items-center justify-center">
                        {loadingImages || loadingImageAsset ? (
                          <Spinner />
                        ) : (
                          <ImageCarousel
                            images={safeCatalogImages.slice(0, 1)}
                            alt={`${form.brand ? form.brand + " " : ""}${form.name || ""}`}
                            loading={false}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 mb-6 px-3">
                <label className="block font-semibold text-primary mb-1">
                  {t("globalItemModal.labels.description")}
                </label>
                <div className="text-primary/90 whitespace-pre-line leading-6 min-h-[60px] pr-2">
                  {form.description || "—"}
                </div>
              </div>
            </>
          )}
          </div>

          {/* Actions - fixed at bottom */}
          <div className="mt-3 flex justify-between flex-shrink-0">
            <div className="flex space-x-2">
              {allowDelete && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={saving || isResolvingMode}
                  className="px-2 py-1 bg-error text-neutral font-semibold rounded-md shadow hover:bg-error/80 focus:outline-none focus:ring-2 focus:ring-error transition"
                >
                  {t("globalItemEditModal.buttons.delete")}
                </button>
              )}

              {template?.importedFromShare && globalId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      await api.patch(`/global/items/${globalId}/claim`);
                      setGlobalTemplate((prev) =>
                        prev ? { ...prev, importedFromShare: false } : prev,
                      );
                      toast.success(
                        t("globalItemEditModal.toast.claimed", "Added to My Gear"),
                      );
                      window.dispatchEvent(
                        new CustomEvent("global-items:updated"),
                      );
                      onSaved?.();
                      onClose?.();
                    } catch (err) {
                      toast.error(
                        err?.response?.data?.message ||
                          t(
                            "globalItemEditModal.toast.claimFailed",
                            "Failed to add to My Gear",
                          ),
                      );
                    }
                  }}
                  className="px-2 py-1 bg-secondary/10 text-secondary rounded hover:bg-secondary/20 text-sm"
                >
                  {t("globalItemEditModal.buttons.claim", "Add to My Gear")}
                </button>
              )}

              {!isCustom && primaryOffer?.deepLink && (
                <ButtonLink href={primaryOffer.deepLink}>
                  {primaryOffer.merchantName || t("globalItemEditModal.buttons.productPage")}
                </ButtonLink>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary sm:text-base"
              >
                {t("actions.cancel")}
              </button>

              <button
                type="submit"
                disabled={saving || isResolvingMode}
                className={`px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 ${
                  saving || isResolvingMode
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {saving
                  ? t("globalItemEditModal.buttons.saving")
                  : t("actions.save")}
              </button>
            </div>
          </div>

          <ConfirmDialog
            isOpen={confirmOpen}
            title={
              isListContext
                ? t("globalItemEditModal.confirm.saveListTitle")
                : t("globalItemEditModal.confirm.saveGlobalTitle")
            }
            confirmText={
              isListContext
                ? t("globalItemEditModal.confirm.saveListConfirm")
                : t("globalItemEditModal.confirm.saveGlobalConfirm")
            }
            cancelText={t("actions.cancel")}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmOpen(false)}
          />

          {allowDelete && (
            <ConfirmDialog
              isOpen={deleteConfirmOpen}
              title={t("globalItemEditModal.confirm.deleteTitle")}
              message={t("globalItemEditModal.confirm.deleteMessage")}
              confirmText={t("globalItemEditModal.confirm.deleteConfirm")}
              cancelText={t("actions.cancel")}
              onConfirm={async () => {
                setDeleteConfirmOpen(false);
                try {
                  await api.delete(`/global/items/${item._id}`);
                  // toast.success(t("globalItemEditModal.toast.deleted"));
                  window.dispatchEvent(new CustomEvent("global-items:updated"));
                  onSaved?.();
                  onClose?.();
                } catch (err) {
                  toast.error(
                    err.response?.data?.message ||
                      t("globalItemEditModal.toast.deleteFailed"),
                  );
                }
              }}
              onCancel={() => setDeleteConfirmOpen(false)}
            />
          )}
        </form>
      )}
    </div>
  );
}
