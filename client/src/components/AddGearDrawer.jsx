// src/components/AddGearDrawer.jsx
import React, { useState, useEffect } from "react";
import api from "../services/api";
import { FaTimes, FaInfoCircle } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import LinkInput from "./LinkInput";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import CatalogItemPreviewModal from "./CatalogItemPreviewModal";
import Spinner from "./ui/Spinner";
import { CATALOG_CATEGORIES, tCategory } from "../config/catalogTaxonomy";

function ImportTab({ onImported }) {
  const { t } = useTranslation("common");

  // preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [detailsCache, setDetailsCache] = useState({});
  const [previewImporting, setPreviewImporting] = useState(false);

  // catalog results
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // search + filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");

  // multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());

  // already-imported (catalogId -> imported)
  const [importedCatalogIds, setImportedCatalogIds] = useState(new Set());

  // debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 600);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadImported = async () => {
    try {
      const { data } = await api.get("/global/items");
      const set = new Set(
        (data || [])
          .map((g) => g.productId)
          .filter(Boolean)
          .map((x) => String(x))
      );
      setImportedCatalogIds(set);
    } catch (err) {
      console.error("Failed to load global items for import dedupe", err);
    }
  };

  const loadCatalog = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (subcategoryFilter !== "all") params.subcategory = subcategoryFilter;
      if (brandFilter !== "all") params.brand = brandFilter;

      const { data } = await api.get("/catalog/items", { params });
      setItems(data || []);
    } catch (err) {
      console.error("Failed to load catalog items", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          t("globalItemModal.importTab.errors.loadFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewImport = async () => {
    const catalogId = previewId ? String(previewId) : null;
    if (!catalogId) return;

    if (importedCatalogIds.has(catalogId)) {
      return toast.error(t("globalItemModal.importTab.toasts.alreadyImported"));
    }

    setPreviewImporting(true);
    try {
      const { data } = await api.post("/global/items/from-catalog/bulk", {
        ids: [catalogId],
      });

      setImportedCatalogIds((prev) => {
        const copy = new Set(prev);
        copy.add(catalogId);
        return copy;
      });

      toast.success(t("globalItemModal.importTab.toasts.importSuccess"));
      onImported?.(data?.items || []);
    } catch (err) {
      console.error("Preview import failed", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          t("globalItemModal.importTab.toasts.importFailed")
      );
    } finally {
      setPreviewImporting(false);
    }
  };

  useEffect(() => {
    loadImported();
  }, []);

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, subcategoryFilter, brandFilter]);

  const categories = CATALOG_CATEGORIES;

  const subcategories = Array.from(
    new Set(
      items
        .filter((i) =>
          categoryFilter === "all" ? true : i.category === categoryFilter
        )
        .map((i) => i.subcategory)
        .filter(Boolean)
    )
  ).sort();

  const brands = Array.from(
    new Set(items.map((i) => i.brand).filter(Boolean))
  ).sort();

  const toggleCheckbox = (catalogId) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(catalogId)) copy.delete(catalogId);
      else copy.add(catalogId);
      return copy;
    });
  };

  const handleBulkImport = async () => {
    if (selectedIds.size === 0) {
      return toast.error(
        t("globalItemModal.importTab.toasts.selectAtLeastOne")
      );
    }

    const already = Array.from(selectedIds).filter((id) =>
      importedCatalogIds.has(String(id))
    );
    if (already.length > 0) {
      return toast.error(t("globalItemModal.importTab.toasts.alreadyImported"));
    }

    setSaving(true);
    try {
      const ids = Array.from(selectedIds);
      const { data } = await api.post("/global/items/from-catalog/bulk", {
        ids,
      });

      const newlyImported = new Set(importedCatalogIds);
      (data?.catalogIds || ids).forEach((id) => newlyImported.add(String(id)));
      setImportedCatalogIds(newlyImported);

      setSelectedIds(new Set());

      toast.success(t("globalItemModal.importTab.toasts.importSuccess"));
      onImported?.(data?.items || []);
    } catch (err) {
      console.error("Bulk import failed", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          t("globalItemModal.importTab.toasts.importFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const importButtonLabel = saving
    ? t("globalItemModal.importTab.buttons.importing")
    : t("globalItemModal.importTab.buttons.import", {
        count: Number(selectedIds.size) || 0,
      });

  const openPreview = async (catalogId) => {
    setPreviewId(catalogId);
    setPreviewOpen(true);
    setPreviewError("");

    if (detailsCache[catalogId]) {
      setPreviewItem(detailsCache[catalogId]);
      return;
    }

    setPreviewLoading(true);
    try {
      const { data } = await api.get(`/catalog/items/${catalogId}`);
      setDetailsCache((prev) => ({ ...prev, [catalogId]: data }));
      setPreviewItem(data);
    } catch (err) {
      console.error("Failed to load catalog item details", err);
      setPreviewItem(null);
      setPreviewError(
        err?.response?.data?.message ||
          err?.message ||
          t("catalogPreview.errors.loadFailed", {
            defaultValue: "Failed to load details.",
          })
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <input
        type="text"
        placeholder={t("globalItemModal.importTab.searchPlaceholder")}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full border border-primary rounded px-2 py-1 text-primary placeholder:text-primary/50 bg-base-100 text-sm mb-2"
      />

      {/* Filters row */}
      <div className="flex gap-2 mb-2 overflow-hidden">
        <select
          className="flex-1 min-w-0 border border-primary rounded px-2 py-1 text-primary bg-base-100 text-sm"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setSubcategoryFilter("all");
          }}
        >
          <option value="all">
            {t("globalItemModal.importTab.filters.allCategories")}
          </option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {tCategory(t, cat)}
            </option>
          ))}
        </select>

        <select
          className="flex-1 min-w-0 border border-primary rounded px-2 py-1 text-primary bg-base-100 text-sm"
          value={subcategoryFilter}
          onChange={(e) => setSubcategoryFilter(e.target.value)}
          disabled={categoryFilter === "all" && subcategories.length === 0}
        >
          <option value="all">
            {t("globalItemModal.importTab.filters.allSubcategories")}
          </option>
          {subcategories.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>

        <select
          className="flex-1 min-w-0 border border-primary rounded px-2 py-1 text-primary bg-base-100 text-sm"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="all">
            {t("globalItemModal.importTab.filters.allBrands")}
          </option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <Spinner
          centered
          label={t("globalItemModal.importTab.states.loading")}
        />
      )}

      {error && <div className="text-error text-sm">{error}</div>}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ul className="space-y-1">
          {!loading && !error && items.length === 0 && (
            <li className="px-2 py-1 text-primary/80 text-sm">
              {t("globalItemModal.importTab.states.empty")}
            </li>
          )}

          {!loading &&
            !error &&
            items.length > 0 &&
            items.map((item) => {
              const catalogId = String(item._id);
              const disabled = importedCatalogIds.has(catalogId);

              return (
                <li
                  key={item._id}
                  className={`flex items-center px-2 py-1 rounded bg-neutral/20 border border-primary/20 ${
                    disabled
                      ? "opacity-50 cursor-default"
                      : "hover:bg-primary/10 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(catalogId)}
                    onChange={() => !disabled && toggleCheckbox(catalogId)}
                    disabled={disabled || saving}
                    className="mr-2 h-4 w-4 text-secondary border-primary rounded focus:ring-secondary"
                  />

                  <div
                    className="flex-1 select-none"
                    onClick={() => !disabled && toggleCheckbox(catalogId)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-primary text-sm">
                          {item.name}
                        </div>
                        <div className="text-xs text-primary/70">
                          {item.brand || t("globalItemModal.importTab.labels.unknownBrand")}{" "}
                          —{" "}
                          {item.itemType ||
                            item.subcategory ||
                            item.category ||
                            t("globalItemModal.importTab.labels.uncategorized")}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {disabled && (
                          <span className="text-red-500 text-xs">
                            {t("globalItemModal.importTab.badges.added")}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(catalogId);
                          }}
                          className="p-1 text-primary hover:bg-primary/10 rounded"
                          aria-label={t("catalogPreview.buttons.viewDetails")}
                          title={t("catalogPreview.buttons.viewDetails")}
                        >
                          <FaInfoCircle className="text-sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      </div>

      <CatalogItemPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        item={previewItem}
        loading={previewLoading}
        error={previewError}
        alreadyImported={
          previewId ? importedCatalogIds.has(String(previewId)) : false
        }
        onImport={handlePreviewImport}
        importing={previewImporting}
      />

      {/* Footer actions */}
      <div className="pt-1.5 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => setSelectedIds(new Set())}
          className="px-2 py-0.5 text-primary text-sm hover:text-primary/80"
          title={t("globalItemModal.importTab.buttons.clearTitle")}
        >
          {t("globalItemModal.importTab.buttons.clear")}
        </button>

        <button
          type="button"
          onClick={handleBulkImport}
          disabled={saving || selectedIds.size === 0}
          className={`px-2 py-0.5 bg-primary text-base-100 rounded text-sm ${
            saving || selectedIds.size === 0
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-primary/80"
          }`}
        >
          {importButtonLabel}
        </button>
      </div>
    </div>
  );
}

function CustomTab({ onCreated }) {
  const { t } = useTranslation("common");

  const [itemType, setItemType] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  const unit = useUnit();
  const { unitLabel, parseInput } = useWeightInput(unit);
  const [displayWeight, setDisplayWeight] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }

    let grams;
    if (displayWeight !== "") {
      grams = parseInput(displayWeight);
      if (grams == null) {
        toast.error(t("validation.weightInvalid"));
        return;
      }
      if (grams < 0) {
        toast.error(t("validation.weightNegative"));
        return;
      }
    }

    setLoading(true);
    try {
      const payload = { name: name.trim() };
      if (itemType.trim()) payload.itemType = itemType.trim();
      if (brand.trim()) payload.brand = brand.trim();
      if (description.trim()) payload.description = description.trim();
      if (typeof grams === "number") payload.weight = grams;
      if (link.trim()) payload.link = link.trim();

      const { data } = await api.post("/global/items", payload);

      toast.success(t("globalItemModal.toast.created"));

      // Reset form
      setItemType("");
      setName("");
      setBrand("");
      setDescription("");
      setLink("");
      setDisplayWeight("");

      onCreated?.(data);
    } catch (err) {
      console.error("Error creating global item:", err);
      const msg =
        err.response?.data?.message || t("globalItemModal.toast.createFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Row 1: Name */}
      <div>
        <label className="block text-xs font-medium text-primary mb-1">
          {t("globalItemModal.labels.name")}
          <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder={t("globalItemModal.placeholders.name")}
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          className="block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
        />
      </div>

      {/* Row 2: Type, Brand, Weight */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-primary mb-1">
            {t("globalItemModal.labels.itemType")}
          </label>
          <input
            type="text"
            placeholder={t("globalItemModal.placeholders.itemType")}
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className="block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
          />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-primary mb-1">
            {t("globalItemModal.labels.brand")}
          </label>
          <input
            type="text"
            placeholder={t("globalItemModal.placeholders.brand")}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
          />
        </div>

        <div className="w-24">
          <label className="block text-xs font-medium text-primary mb-1">
            {t("globalItemModal.labels.weight", { unit: unitLabel })}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={displayWeight}
            placeholder={unitLabel === "g" ? "0" : "0.0"}
            onChange={(e) => setDisplayWeight(e.target.value)}
            className="block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
          />
        </div>
      </div>

      {/* Row 3: Description */}
      <div>
        <label className="block text-xs font-medium text-primary mb-1">
          {t("globalItemModal.labels.description")}
        </label>
        <input
          type="text"
          placeholder={t("globalItemModal.placeholders.description", "Brief description...")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
        />
      </div>

      {/* Row 4: Link */}
      <div>
        <LinkInput
          value={link}
          onChange={setLink}
          label={t("globalItemModal.labels.link")}
          placeholder={t("globalItemModal.placeholders.link")}
          required={false}
          className="text-sm"
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-1.5 bg-secondary text-white rounded hover:bg-secondary-700 text-sm"
        >
          {loading ? t("actions.saving") : t("actions.save")}
        </button>
      </div>
    </form>
  );
}

export default function AddGearDrawer({ isOpen, onClose, onItemsChanged }) {
  const { t } = useTranslation("common");

  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem("globalItemModal:tab");
    return saved === "custom" ? "custom" : "import";
  });

  // Persist tab selection
  useEffect(() => {
    localStorage.setItem("globalItemModal:tab", tab);
  }, [tab]);

  const handleImported = (items) => {
    onItemsChanged?.();
    window.dispatchEvent(new CustomEvent("global-items:updated"));
  };

  const handleCreated = (item) => {
    onItemsChanged?.();
    window.dispatchEvent(new CustomEvent("global-items:updated"));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile: full-screen overlay */}
      <div className="sm:hidden fixed inset-0 bg-base-100 z-[70] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
          <h2 className="text-lg font-semibold text-primary">
            {t("globalItemModal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-error hover:text-error/80"
            aria-label={t("actions.close")}
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 py-2 border-b border-primary/10">
          <button
            type="button"
            className={`px-3 py-1 rounded text-sm ${
              tab === "import"
                ? "bg-primary/10 text-primary font-medium"
                : "text-primary/70"
            }`}
            onClick={() => setTab("import")}
          >
            {t("globalItemModal.tabs.import")}
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded text-sm ${
              tab === "custom"
                ? "bg-primary/10 text-primary font-medium"
                : "text-primary/70"
            }`}
            onClick={() => setTab("custom")}
          >
            {t("globalItemModal.tabs.custom")}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {tab === "import" ? (
            <ImportTab onImported={handleImported} />
          ) : (
            <CustomTab onCreated={handleCreated} />
          )}
        </div>
      </div>

      {/* Desktop: slide-in drawer from right */}
      <div
        className={`hidden sm:fixed sm:top-12 sm:bottom-0 sm:right-0 sm:flex sm:flex-col w-[420px] bg-base-100 border-l border-primary/20 shadow-xl transition-transform duration-300 ease-out z-40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm ${
                tab === "import"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-primary/70 hover:text-primary"
              }`}
              onClick={() => setTab("import")}
            >
              {t("globalItemModal.tabs.import")}
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm ${
                tab === "custom"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-primary/70 hover:text-primary"
              }`}
              onClick={() => setTab("custom")}
            >
              {t("globalItemModal.tabs.custom")}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-error hover:text-error/80"
            aria-label={t("actions.close")}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {tab === "import" ? (
            <ImportTab onImported={handleImported} />
          ) : (
            <CustomTab onCreated={handleCreated} />
          )}
        </div>
      </div>

    </>
  );
}
