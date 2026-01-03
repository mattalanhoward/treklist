// src/components/GlobalItemEditModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import LinkInput from "../components/LinkInput";
import ConfirmDialog from "./ConfirmDialog";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import { FaTimes } from "react-icons/fa";
import ImageCarousel from "./ImageCarousel";
import ButtonLink from "./ui/ButtonLink";
import {
  fetchGlobalItemCached,
  invalidateGlobalItemCache,
} from "../services/globalItemCache";

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
    category: "",
    itemType: "",
    name: "",
    brand: "",
    description: "",
    weight: "",
    link: "",
  });

  const unit = useUnit();
  const { unitLabel, formatInput, parseInput } = useWeightInput(unit);

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

  const itemId = item ? item._id : null;
  const isListContext = context === "list" || (!!listId && !!catId);
  const [primaryOffer, setPrimaryOffer] = useState(null);

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

  // Do we need the GlobalItem fetch to know the mode?
  const needsTemplateToDecide = useMemo(() => {
    if (!isListContext) return false;
    // If editing from a gearlist card, item is GearItem and usually lacks affiliate/productId
    const hasEnoughOnItem =
      Boolean(item?.affiliate?.network) || Boolean(item?.productId);
    return Boolean(globalId) && !hasEnoughOnItem;
  }, [isListContext, globalId, item?.affiliate?.network, item?.productId]);

  // prevents stale template from previous item causing wrong fields briefly
  useEffect(() => {
    setGlobalTemplate(null);
  }, [globalId]);

  // While we wait on the global template ONLY to decide imported vs custom,
  // render the custom layout immediately (no skeleton / no width jump),
  // but disable editing + saving until resolved.
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Only relevant for imported items
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
        if (!cancelled) setCatalogImages(urls);

        const offers = Array.isArray(data.offers) ? data.offers : [];
        const best = offers
          .slice()
          .sort(
            (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)
          )[0];

        if (!cancelled) setPrimaryOffer(best || null);
      } catch {
        if (!cancelled) {
          setCatalogImages([]);
          setPrimaryOffer(null);
        }
      } finally {
        if (!cancelled) setLoadingImages(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedProductId, viewMode]);

  // --- single global fetch (cached) used for:
  //     - affiliate-backed detection
  //     - productId for images
  //     - attributes/specs for imported items
  useEffect(() => {
    let cancelled = false;

    async function loadGlobal() {
      if (!isListContext || !globalId) {
        setGlobalTemplate(null);
        setLoadingGlobal(false);
        return;
      }

      setGlobalTemplate(null);
      setLoadingGlobal(true); // important: mark as loading immediately
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

  // Affiliate-backed if:
  // - direct on the item (sometimes GearItem carries affiliate/productId)
  // - OR present on the global template
  const isAffiliateBacked = useMemo(() => {
    const direct =
      Boolean(item?.affiliate?.network) || Boolean(item?.productId);
    const viaTemplate =
      Boolean(template?.productId) || Boolean(template?.affiliate?.network);
    return direct || viaTemplate;
  }, [item, template]);

  const isCustom = viewMode === "custom";
  const isImported = viewMode === "imported";
  const disableEdits = saving || isResolvingMode;

  // Hydrate list-editable fields from the *item* (GearItem can override these)
  useEffect(() => {
    if (!item) return;
    const initialGrams = item.weight ?? "";
    setForm((prev) => ({
      ...prev,
      category: item.category || "",
      weight: initialGrams,
      // NOTE: imported read-only fields are handled in the effect below
      ...(viewMode === "custom"
        ? {
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
  }, [itemId, viewMode, item]);

  // Hydrate imported read-only fields from the *template* (GlobalItem)
  // This removes the “— then values appear” snap.
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validate = () => {
    // only enforce name for custom items (imported is read-only anyway)
    if (viewMode === "custom" && !form.name.trim())
      return t("validation.nameRequired");

    const trimmed = String(displayWeight ?? "").trim();
    const parsed = trimmed === "" ? null : parseInput(trimmed);

    if (trimmed !== "" && parsed == null) return t("validation.weightInvalid");
    if (parsed != null && parsed < 0) return t("validation.weightNegative");

    if (viewMode === "custom" && form.link && !/^https?:\/\//.test(form.link)) {
      return t("validation.urlInvalid");
    }

    return "";
  };

  // Step 1: validate -> open confirm
  const handleSave = (e) => {
    e.preventDefault();
    if (isResolvingMode) {
      // Avoid saving while mode is unknown (prevents editing imported items accidentally)
      toast.error("Still loading item details…");
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

      // Shared fields that are safe for BOTH endpoints
      const basePayload = {
        weight: weightValue,
        worn,
        consumable,
        quantity,
      };

      // ---- GLOBAL TEMPLATE payload (NEVER send list-category IDs here) ----
      const globalPayload = { ...basePayload };

      // Editable on custom items only (global template edits)
      if (viewMode === "custom") {
        globalPayload.itemType = form.itemType;
        globalPayload.name = form.name.trim();
        globalPayload.brand = form.brand.trim();
        globalPayload.description = form.description.trim();

        const trimmedLink = (form.link || "").trim();
        globalPayload.link = trimmedLink === "" ? null : trimmedLink;

        // If later you add a taxonomy picker for GlobalItem, this should be:
        // globalPayload.catalogCategory = form.catalogCategory;
        // globalPayload.catalogSubcategory = form.catalogSubcategory;
      }

      // ---- LIST ITEM payload (GearItem) ----
      // category here is the list Category ObjectId (moving columns), which is valid
      const listPayload = { ...basePayload };

      let updatedSomething = false;
      let touchedGlobal = false;

      // 1) Update GLOBAL template
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

      // 2) Update LIST item (GearItem row)
      if (isListContext) {
        await api.patch(
          `/dashboard/${listId}/categories/${catId}/items/${item._id}`,
          listPayload
        );
        updatedSomething = true;
      }

      if (updatedSomething) {
        toast.success(
          isListContext && touchedGlobal
            ? t("globalItemEditModal.toast.updatedEverywhere")
            : t("globalItemEditModal.toast.updated")
        );
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

  const handleCancelConfirm = () => setConfirmOpen(false);

  // Imported-only specs come from the GLOBAL TEMPLATE (so it works from GearItem too)
  const importedSpecs = useMemo(() => {
    if (viewMode !== "imported") return null;
    const attrs = template?.attributes;
    if (!attrs || typeof attrs !== "object" || Array.isArray(attrs))
      return null;

    const entries = Object.entries(attrs).filter(
      ([k, v]) => String(k || "").trim() && String(v ?? "").trim()
    );
    return entries.length ? entries : null;
  }, [viewMode, template]);

  const modalWidthClass = viewMode === "custom" ? "max-w-xl" : "max-w-3xl";

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSave}
        className={
          "bg-white rounded-lg shadow-2xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4 " +
          "max-h-[90vh] overflow-y-auto " +
          modalWidthClass
        }
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
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
          >
            <FaTimes />
          </button>
        </div>

        {/* {isResolvingMode && (
          <div className="mb-2 text-xs text-primary/60">
            Loading item details…
          </div>
        )} */}

        {error && <div className="text-error mb-2">{error}</div>}

        {viewMode === "loading" ? (
          <div className="py-8 px-3">
            {/* <div className="text-primary/70 text-sm">Loading item details…</div> */}
            <div className="mt-4 h-24 bg-white/60 rounded" />
            <div className="mt-3 h-24 bg-white/60 rounded" />
          </div>
        ) : isCustom ? (
          <>
            {/* Custom items layout (no specs shown, editable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.itemType")}
                </label>
                <input
                  name="itemType"
                  value={form.itemType}
                  onChange={handleChange}
                  // disabled={disableEdits}
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                />
              </div>

              <div>
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.name")}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  // disabled={disableEdits}
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
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
                  // disabled={disableEdits}
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
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
                  // disabled={disableEdits}
                  required={false}
                />
              </div>

              <div className="flex space-x-1 sm:space-x-2 col-span-1 sm:col-span-2">
                <div className="flex-1">
                  <label className="block font-medium text-primary mb-0.5">
                    {t("globalItemModal.labels.weight", { unit: unitLabel })}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displayWeight}
                    onChange={(e) => setDisplayWeight(e.target.value)}
                    // disabled={disableEdits}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.description")}
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  // disabled={disableEdits}
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  rows={2}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Imported layout (locked fields + images + specs display-only) */}
            <div className="sm:grid sm:grid-cols-2 sm:gap-6">
              {/* {isAffiliateBacked &&
                (loadingImages || catalogImages.length > 0) && (
                  <div className="sm:hidden mt-2">
                    <ImageCarousel
                      images={catalogImages}
                      alt={`${form.brand ? form.brand + " " : ""}${
                        form.name || ""
                      }`}
                      loading={loadingImages}
                      heightClass="h-40"
                    />
                  </div>
                )} */}

              <div className="sm:flex-1">
                {/* “Details” list (label on left, value on right) */}
                <div className="rounded overflow-hidden">
                  {/* Item Type */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.itemType")}:
                    </div>
                    <div className="text-primary break-words">
                      {form.itemType || "—"}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.name")}:
                    </div>
                    <div className="text-primary break-words">
                      {form.name || "—"}
                    </div>
                  </div>

                  {/* Brand */}
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center px-3 py-1">
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.brand")}:
                    </div>
                    <div className="text-primary break-words">
                      {form.brand || "—"}
                    </div>
                  </div>

                  {/* Weight (editable) — first row after name/brand */}
                  <div
                    className={
                      "grid grid-cols-[140px_1fr] gap-3 items-center px-3 "
                    }
                  >
                    <div className="text-primary font-semibold">
                      {t("globalItemModal.labels.weight", { unit: unitLabel })}:
                    </div>
                    <div className="">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={displayWeight}
                        onChange={(e) => setDisplayWeight(e.target.value)}
                        className="w-full max-w-[220px] text-primary bg-white text-left px-2"
                      />
                    </div>
                  </div>

                  {/* Imported-only specs (display-only) — no header */}
                  {importedSpecs &&
                    importedSpecs.map(([k, v], idx) => (
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

                {/* Optional: tiny hint while loading global template in list context */}
                {/* {isListContext && loadingGlobal && (
                  <div className="mt-2 text-xs text-primary/60">
                    Loading item details…
                  </div>
                )} */}
              </div>

              {/* Right (desktop only) */}
              {isImported && (
                <div className="hidden sm:flex items-center justify-center">
                  <div className="bg-white py-2 px-2 w-full max-w-md">
                    {/* Lock the media area height so the modal never grows when carousel/dots load */}
                    <div className="h-[260px] w-full overflow-hidden flex items-center justify-center">
                      {loadingImages ? (
                        <div className="h-full w-full bg-neutralAlt/40 rounded animate-pulse" />
                      ) : catalogImages?.length ? (
                        <ImageCarousel
                          images={catalogImages}
                          alt={`${form.brand ? form.brand + " " : ""}${
                            form.name || ""
                          }`}
                          loading={false}
                        />
                      ) : (
                        <div className="h-full w-full bg-neutralAlt/20 rounded" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Description (label above, plain text, not textarea) */}
            <div className="mt-4 mb-6 px-3">
              <label className="block font-semibold text-primary mb-1">
                {t("globalItemModal.labels.description")}
              </label>
              <div className="text-primary/90 whitespace-pre-line leading-6 min-h-[120px] max-h-[160px] overflow-y-auto pr-2">
                {" "}
                {form.description || "—"}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-3 flex justify-between">
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

            {/* BUY button (imported items only) */}
            {!isCustom &&
              (primaryOffer?.deepLink ? (
                <ButtonLink href={primaryOffer.deepLink}>
                  {primaryOffer.merchantName
                    ? primaryOffer.merchantName
                    : "Product Page"}
                </ButtonLink>
              ) : // Reserve space so the button doesn’t “pop in” later
              // Only show placeholder if we expect an offer (imported + has productId)
              resolvedProductId ? (
                <button
                  type="button"
                  disabled
                  className="px-2 py-1 bg-primary/10 text-primary/60 rounded-md shadow"
                  style={{ minWidth: 110 }} // keep layout stable
                >
                  Loading…
                </button>
              ) : null)}
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
              disabled={saving}
              className="px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80"
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
          onCancel={handleCancelConfirm}
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
                toast.success(t("globalItemEditModal.toast.deleted"));
                onSaved?.();
                onClose?.();
              } catch (err) {
                toast.error(
                  err.response?.data?.message ||
                    t("globalItemEditModal.toast.deleteFailed")
                );
              }
            }}
            onCancel={() => setDeleteConfirmOpen(false)}
          />
        )}
      </form>
    </div>
  );
}
