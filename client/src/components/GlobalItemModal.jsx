// src/components/GlobalItemModal.jsx
import React, { useState, useEffect } from "react";
import api from "../services/api";
import { FaTimes, FaInfoCircle } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import LinkInput from "../components/LinkInput";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
// import AffiliateProductPicker from "./AffiliateProductPicker";
import { useUserSettings } from "../contexts/UserSettings";
import { detectRegion, normalizeRegion } from "../utils/region";
import CatalogItemPreviewModal from "./CatalogItemPreviewModal";
import Spinner from "../components/ui/Spinner";
import { CATALOG_CATEGORIES } from "../config/catalogTaxonomy";

function ImportCatalogTab({ onImported }) {
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

  // debounce like Sidebar (no search button)
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
      // non-fatal: UI still works, just won't show "Added"
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

      // mark as imported immediately
      setImportedCatalogIds((prev) => {
        const copy = new Set(prev);
        copy.add(catalogId);
        return copy;
      });

      toast.success(t("globalItemModal.importTab.toasts.importSuccess"));

      // inform parent so Sidebar/My Gear can refresh if needed
      onImported?.(data?.items || []);

      // optional: keep modal open (button disables + badge shows)
      // setPreviewOpen(false);
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

  // initial load
  useEffect(() => {
    loadImported();
  }, []);

  // reload catalog when search/filters change
  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, subcategoryFilter, brandFilter]);

  // Category options are locked (always show all)
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

    // block if user selected already-added items (UX clarity)
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

      // mark as imported immediately
      const newlyImported = new Set(importedCatalogIds);
      (data?.catalogIds || ids).forEach((id) => newlyImported.add(String(id)));
      setImportedCatalogIds(newlyImported);

      // clear selection
      setSelectedIds(new Set());

      toast.success(t("globalItemModal.importTab.toasts.importSuccess"));

      // inform parent but DO NOT close modal
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

    // cached?
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
          "Failed to load details."
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search + filters */}
      <div className="flex flex-col gap-2 pb-3">
        <input
          type="text"
          placeholder={t("globalItemModal.importTab.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 border border-primary rounded px-2 py-1 text-primary placeholder:text-primary/50 bg-base-100"
          bg-base-100
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
          <select
            className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setSubcategoryFilter("all"); // reset dependent filter
            }}
          >
            <option value="all">
              {t("globalItemModal.importTab.filters.allCategories")}
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            className="border border-primary rounded px-2 py-1 text-primary bg-base-100"
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
            className="border border-primary rounded px-2 py-1 text-primary bg-base-100"
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
      </div>

      {loading && (
        <Spinner
          centered
          label={t("globalItemModal.importTab.states.loading")}
        />
      )}

      {error && <div className="text-error text-sm">{error}</div>}

      {/* Results list (AddGearItemModal style) */}
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {!loading && !error && items.length === 0 && (
            <li className="px-2 py-1 text-primary/80">
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
                  className={`flex items-center px-2 py-1 rounded bg-neutral/20 border border-primary/20 mb-1 ${
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
                    className="mr-3 h-4 w-4 text-secondary border-primary rounded focus:ring-secondary"
                  />

                  <div
                    className="flex-1 select-none"
                    onClick={() => !disabled && toggleCheckbox(catalogId)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-primary">
                          {item.name}
                        </div>
                        <div className="text-sm text-primary">
                          {item.brand ||
                            t(
                              "globalItemModal.importTab.labels.unknownBrand"
                            )}{" "}
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
                            e.stopPropagation(); // don't toggle checkbox
                            openPreview(catalogId);
                          }}
                          className="p-2 text-primary hover:bg-primary/10 rounded"
                          aria-label={t("catalogPreview.buttons.viewDetails")}
                          title={t("catalogPreview.buttons.viewDetails")}
                        >
                          <FaInfoCircle />
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

      {/* Actions */}
      <div className="mt-3 flex justify-end space-x-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => setSelectedIds(new Set())}
          className="px-2 py-1 bg-base-100 text-primary rounded"
          title={t("globalItemModal.importTab.buttons.clearTitle")}
        >
          {t("globalItemModal.importTab.buttons.clear")}
        </button>

        <button
          type="button"
          onClick={handleBulkImport}
          disabled={saving || selectedIds.size === 0}
          className={`px-2 py-1 bg-primary text-base-100 rounded flex items-center ${
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

export default function GlobalItemModal({
  categories = [],
  onClose,
  onCreated,
}) {
  const { t } = useTranslation("common");
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const unit = useUnit();
  const { unitLabel, parseInput } = useWeightInput(unit);
  const [displayWeight, setDisplayWeight] = useState("");
  const [weightSource, setWeightSource] = useState("user"); // "user" | "heuristic" | "scraped" | "catalog" | "verified"

  const [tab, setTab] = useState("import"); // "import" | "custom"
  const [affProduct, setAffProduct] = useState(null); // selected affiliate product (or null)

  // Derive item type from a category path string (e.g., "A > B > C" -> "C")
  const deriveItemTypeFromCategoryPath = (path) => {
    if (!path) return "";
    if (Array.isArray(path)) {
      const last = path[path.length - 1];
      return typeof last === "string" ? last.trim() : "";
    }
    if (typeof path === "string") {
      const parts = path
        .replace(/›|»|\||\//g, ">")
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);
      return parts[parts.length - 1] || "";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Accept either variable name; keep one source of truth.
    const selectedAffiliate = affProduct || null;

    // Basic validation (still require a name)
    if (!name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }

    // Parse/validate weight (grams) from displayWeight if provided
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
      let created;

      if (selectedAffiliate?._id) {
        // Affiliate-backed: server controls link; we send only overrides
        const payload = {
          affiliateProductId: selectedAffiliate._id,
          name: name.trim(),
          ...(itemType.trim() && { itemType: itemType.trim() }),
          ...(brand.trim() && { brand: brand.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(typeof grams === "number" && { weight: grams }),
          ...(typeof grams === "number" && weightSource && { weightSource }),
          worn,
          consumable,
          quantity: Number(quantity) || 1,
          // Keep whatever category your API expects; omit if not used server-side
          ...(category && { category }),
        };

        created = await api
          .post("/global/items/from-affiliate", payload)
          .then((r) => r.data);
      } else {
        // Custom item: same as your original flow (link allowed)
        const payload = { category, name: name.trim() };
        if (itemType.trim()) payload.itemType = itemType.trim();
        if (brand.trim()) payload.brand = brand.trim();
        if (description.trim()) payload.description = description.trim();
        if (typeof grams === "number") {
          payload.weight = grams;
          if (weightSource === "heuristic") payload.weightSource = "heuristic";
        }

        if (link.trim()) payload.link = link.trim();

        payload.worn = worn;
        payload.consumable = consumable;
        payload.quantity = Number(quantity) || 1;

        created = await api.post("/global/items", payload).then((r) => r.data);
      }

      toast.success(t("globalItemModal.toast.created"));
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      console.error("Error creating global item:", err);
      const msg =
        err.response?.data?.message || t("globalItemModal.toast.createFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleImported = (importedItems) => {
    // Stay open. Just inform parent so Sidebar/My Gear can refresh if needed.
    // importedItems is an array of GlobalItems returned from bulk import.
    onCreated?.(importedItems);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50">
      {" "}
      <form
        onSubmit={handleSubmit}
        className="bg-neutralAlt rounded-lg shadow-2xl max-w-2xl w-full sm:h-[80vh] h-[70vh] px-4 py-4 sm:px-6 sm:py-6 my-4 flex flex-col overflow-hidden"
      >
        {/* Header (smaller on phones) */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            {t("globalItemModal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-error hover:text-error/80"
          >
            <FaTimes />
          </button>
        </div>

        {/* Import / Custom tabs */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-2 py-1 rounded border ${
                tab === "import"
                  ? "bg-primary/10 border-primary"
                  : "bg-neutralAlt border-primary/30"
              }`}
              onClick={() => setTab("import")}
              disabled={loading}
            >
              {t("globalItemModal.tabs.import")}
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded border ${
                tab === "custom"
                  ? "bg-primary/10 border-primary"
                  : "bg-neutralAlt border-primary/30"
              }`}
              onClick={() => setTab("custom")}
              disabled={loading}
            >
              {t("globalItemModal.tabs.custom")}
            </button>
          </div>

          {affProduct ? (
            <div className="flex items-center gap-2">
              {/* <span className=" text-primary">
                Selected: <strong>{affProduct.name}</strong>
              </span> */}
              <button
                type="button"
                className="text-xs underline text-primary"
                onClick={() => {
                  // Remove affiliate selection
                  setAffProduct(null);

                  // Reset every user-editable field
                  setCategory?.(""); // if you keep category in this modal
                  setItemType("");
                  setName("");
                  setBrand("");
                  setDescription("");
                  setDisplayWeight(""); // clears the visible weight input
                  setLink("");
                  setWorn(false);
                  setConsumable(false);
                  setQuantity(1);
                  setWeightSource("user");
                  console.debug("[GlobalItemModal] weightSource reset -> user");

                  // If you want to take the user back to Import, uncomment:
                  // setTab("import");
                }}
                disabled={loading}
              >
                {t("globalItemModal.buttons.clearSelection")}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {tab === "import" && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ImportCatalogTab onImported={handleImported} />
            </div>
          )}

          {/* Grid: only visible on the Custom tab */}
          {tab === "custom" && (
            <div className="flex-1 min-h-0 flex flex-col">
              {" "}
              {/* top form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                {/* Item Type */}
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    {t("globalItemModal.labels.itemType")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("globalItemModal.placeholders.itemType")}
                    required
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value)}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    {t("globalItemModal.labels.name")}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t("globalItemModal.placeholders.name")}
                    value={name}
                    required
                    onChange={(e) => setName(e.target.value)}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
                  />
                </div>

                {/* Brand */}
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    {t("globalItemModal.labels.brand")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("globalItemModal.placeholders.brand")}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
                  />
                </div>

                {/* Link */}
                <div className="relative">
                  <LinkInput
                    value={link}
                    onChange={setLink}
                    label={t("globalItemModal.labels.link")}
                    placeholder={t("globalItemModal.placeholders.link")}
                    required={false}
                    readOnly={!!affProduct}
                  />
                  {affProduct && (
                    <button
                      type="button"
                      aria-label={t(
                        "globalItemModal.messages.affiliateLinkLockedTitle"
                      )}
                      title={t(
                        "globalItemModal.messages.affiliateLinkLockedBody"
                      )}
                      className="absolute inset-0 cursor-not-allowed bg-transparent"
                    />
                  )}
                </div>

                {/* Weight */}
                <div className="flex space-x-1 sm:space-x-2 col-span-1 sm:col-span-2">
                  <div className="flex-1">
                    <label className="block font-medium text-primary mb-0.5">
                      {t("globalItemModal.labels.weight", { unit: unitLabel })}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayWeight}
                      placeholder={
                        unitLabel === "g"
                          ? t("globalItemModal.placeholders.weightGrams")
                          : t("globalItemModal.placeholders.weightOunces")
                      }
                      onChange={(e) => setDisplayWeight(e.target.value)}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
                    />
                  </div>
                </div>
              </div>
              {/* description fills remaining space */}
              <div className="mt-2 flex-1 min-h-0 flex flex-col">
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.description")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full flex-1 min-h-0 border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Worn / Consumable (only on Custom tab) */}
        {/* {tab === "custom" && (
          <div className="flex items-center space-x-4 mt-2">
            <label className="inline-flex items-center text-primary">
              <input
                type="checkbox"
                checked={worn}
                onChange={(e) => setWorn(e.target.checked)}
                className="mr-1 sm:mr-2"
              />
              Worn
            </label>
            <label className="inline-flex items-center text-primary">
              <input
                type="checkbox"
                checked={consumable}
                onChange={(e) => setConsumable(e.target.checked)}
                className="mr-1 sm:mr-2"
              />
              Consumable
            </label>
          </div>
        )} */}

        {/* Actions + merchant note */}
        {tab === "custom" && (
          <div className="mt-3 flex items-center gap-2">
            {affProduct && (
              <p className="flex-1 text-sm text-primary">
                {t("globalItemModal.messages.affiliateNote")}
              </p>
            )}

            <div className="flex space-x-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                title={
                  tab === "import"
                    ? t("globalItemModal.messages.cancelHintImport")
                    : undefined
                }
                className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary"
              >
                {t("actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-2 py-1 bg-secondary text-white rounded hover:bg-secondary-700"
              >
                {t("actions.save")}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
