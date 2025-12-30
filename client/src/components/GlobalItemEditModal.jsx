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

// --- simple module-level cache so StrictMode remounts don't double-fetch ---
const GLOBAL_ITEM_CACHE = new Map(); // id -> { data } OR { promise }

async function fetchGlobalItemCached(id) {
  if (!id) return null;

  const cached = GLOBAL_ITEM_CACHE.get(id);
  if (cached?.data) return cached.data;
  if (cached?.promise) return await cached.promise;

  const promise = api
    .get(`/global/items/${id}`)
    .then((res) => res?.data || null)
    .catch(() => null)
    .finally(() => {
      const entry = GLOBAL_ITEM_CACHE.get(id);
      // leave data if set; otherwise clear
      if (entry && !entry.data) GLOBAL_ITEM_CACHE.delete(id);
    });

  GLOBAL_ITEM_CACHE.set(id, { promise });

  const data = await promise;
  if (data) GLOBAL_ITEM_CACHE.set(id, { data });
  return data;
}

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

  const [resolvedProductId, setResolvedProductId] = useState(null);
  const [catalogImages, setCatalogImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const itemId = item ? item._id : null;
  const isListContext = context === "list" || (!!listId && !!catId);

  // In list context, GearItem may only have globalItem id.
  const globalId = useMemo(() => {
    if (!item) return null;
    return isListContext ? item?.globalItem || null : item?._id || null;
  }, [isListContext, item]);

  // --- single global fetch (cached) used for:
  //     - affiliate-backed detection
  //     - productId for images
  //     - attributes/specs for imported items
  useEffect(() => {
    let cancelled = false;

    async function loadGlobal() {
      // If we don't have a separate global id (sidebar/global view), don't fetch.
      // (In that case, `item` itself is the global template already.)
      if (!isListContext || !globalId) {
        setGlobalTemplate(null);
        return;
      }

      setLoadingGlobal(true);
      const data = await fetchGlobalItemCached(globalId);

      if (!cancelled) {
        setGlobalTemplate(data);
        setLoadingGlobal(false);
      }
    }

    loadGlobal();
    return () => {
      cancelled = true;
    };
  }, [isListContext, globalId]);

  // Prefer the fetched global template when present; otherwise use item
  const template = useMemo(() => {
    return globalTemplate || item || null;
  }, [globalTemplate, item]);

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

  const isCustom = !isAffiliateBacked;

  // Resolve productId for catalog images from:
  // - item.productId if present
  // - else template.productId (global template)
  useEffect(() => {
    const pid = item?.productId
      ? String(item.productId)
      : template?.productId
      ? String(template.productId)
      : null;

    setResolvedProductId(pid);
  }, [item?.productId, template?.productId]);

  // Fetch catalog images
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!resolvedProductId) {
        setCatalogImages([]);
        return;
      }

      setLoadingImages(true);
      try {
        const res = await api.get(`/catalog/items/${resolvedProductId}`);
        const urls = Array.isArray(res?.data?.imageUrls)
          ? res.data.imageUrls
          : [];
        if (!cancelled) setCatalogImages(urls);
      } catch {
        if (!cancelled) setCatalogImages([]);
      } finally {
        if (!cancelled) setLoadingImages(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedProductId]);

  // Only show image column for imported items when we actually have images (or are loading)
  const showImagesDesktop = useMemo(() => {
    return isAffiliateBacked && (loadingImages || catalogImages.length > 0);
  }, [isAffiliateBacked, loadingImages, catalogImages.length]);

  // Hydrate when item changes
  useEffect(() => {
    if (!item) return;
    const initialGrams = item.weight ?? "";
    setForm({
      category: item.category || "",
      itemType: item.itemType || "",
      name: item.name || "",
      brand: item.brand || "",
      description: item.description || "",
      weight: initialGrams,
      link: item.link || "",
    });
    setWorn(!!item.worn);
    setConsumable(!!item.consumable);
    setQuantity(item.quantity || 1);
  }, [itemId]);

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
    if (!isAffiliateBacked && !form.name.trim())
      return t("validation.nameRequired");

    const trimmed = String(displayWeight ?? "").trim();
    const parsed = trimmed === "" ? null : parseInput(trimmed);

    if (trimmed !== "" && parsed == null) return t("validation.weightInvalid");
    if (parsed != null && parsed < 0) return t("validation.weightNegative");

    if (!isAffiliateBacked && form.link && !/^https?:\/\//.test(form.link)) {
      return t("validation.urlInvalid");
    }

    return "";
  };

  // Step 1: validate -> open confirm
  const handleSave = (e) => {
    e.preventDefault();
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
      const payload = {
        category: form.category,
        weight:
          String(displayWeight ?? "").trim() === ""
            ? null
            : parseInput(displayWeight),
        worn,
        consumable,
        quantity,
      };

      // Editable on custom items only
      if (!isAffiliateBacked) {
        payload.itemType = form.itemType;
        payload.name = form.name.trim();
        payload.brand = form.brand.trim();
        payload.description = form.description.trim();

        const trimmedLink = (form.link || "").trim();
        payload.link = trimmedLink === "" ? null : trimmedLink;
      }

      let updatedSomething = false;
      let touchedGlobal = false;

      // 1) Update the GLOBAL template if we know its id
      if (globalId) {
        try {
          await api.patch(`/global/items/${globalId}`, payload);
          updatedSomething = true;
          touchedGlobal = true;

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("global-items:updated"));
          }
        } catch (err) {
          // In list context, a 404 here just means the global template is gone.
          if (!(isListContext && err.response?.status === 404)) {
            throw err;
          }
        }
      }

      // 2) Update the LIST item when editing from a gear-list card
      if (isListContext) {
        await api.patch(
          `/dashboard/${listId}/categories/${catId}/items/${item._id}`,
          payload
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
    if (!isAffiliateBacked) return null;
    const attrs = template?.attributes;
    if (!attrs || typeof attrs !== "object" || Array.isArray(attrs))
      return null;
    const entries = Object.entries(attrs).filter(
      ([k, v]) => String(k || "").trim() && String(v ?? "").trim()
    );
    return entries.length ? entries : null;
  }, [isAffiliateBacked, template]);

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSave}
        className={
          "bg-neutralAlt rounded-lg shadow-2xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4 " +
          (isCustom ? "max-w-xl" : "max-w-3xl")
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

        {error && <div className="text-error mb-2">{error}</div>}

        {isCustom ? (
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
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  rows={2}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Imported layout (locked fields + images + specs display-only) */}
            <div className="sm:flex gap-2">
              {isAffiliateBacked &&
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
                )}

              <div className="sm:flex-1">
                <div className="space-y-3">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.itemType")}
                    </label>
                    <input
                      name="itemType"
                      value={form.itemType}
                      readOnly
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt/40 opacity-80 cursor-not-allowed"
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
                      readOnly
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt/40 opacity-80 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.brand")}
                    </label>
                    <input
                      name="brand"
                      value={form.brand}
                      readOnly
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt/40 opacity-80 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.weight", { unit: unitLabel })}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayWeight}
                      onChange={(e) => setDisplayWeight(e.target.value)}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    />
                  </div>
                </div>

                {/* Imported-only Specs (display-only, pulled from global template so it works from GearItem) */}
                {importedSpecs && (
                  <div className="mt-3">
                    <label className="block font-medium text-primary mb-1">
                      Specs
                    </label>

                    <div className="border border-primary rounded">
                      {importedSpecs.map(([k, v]) => (
                        <div
                          key={k}
                          className="grid grid-cols-[1fr_1fr] gap-2 px-2 py-1 border-b border-primary last:border-b-0 text-sm"
                        >
                          <div className="text-primary font-medium truncate">
                            {k}
                          </div>
                          <div className="text-primary/90 truncate text-right">
                            {String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional: tiny hint while loading global template in list context */}
                {isListContext && loadingGlobal && (
                  <div className="mt-2 text-xs text-primary/60">
                    Loading item details…
                  </div>
                )}
              </div>

              {showImagesDesktop && (
                <div className="mt-6 hidden sm:block sm:w-72">
                  <ImageCarousel
                    images={catalogImages}
                    alt={`${form.brand ? form.brand + " " : ""}${
                      form.name || ""
                    }`}
                    loading={loadingImages}
                  />
                </div>
              )}
            </div>

            <div className="mt-2">
              <label className="block font-medium text-primary mb-0.5">
                {t("globalItemModal.labels.description")}
              </label>
              <textarea
                name="description"
                value={form.description}
                readOnly
                className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt/40 opacity-80 cursor-not-allowed"
                rows={4}
              />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end">
          {allowDelete && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving}
              className="mr-auto px-2 py-1 bg-error text-neutral font-semibold rounded-md shadow hover:bg-error/80 focus:outline-none focus:ring-2 focus:ring-error transition"
            >
              {t("globalItemEditModal.buttons.delete")}
            </button>
          )}

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
