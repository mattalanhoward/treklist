// src/components/SwapItemModal.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../services/api";
import { FiX, FiSearch, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  tItemType,
  CATALOG_CATEGORIES,
  tCategory,
  tSubcategory,
} from "../config/catalogTaxonomy";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import Spinner from "./ui/Spinner";
import LinkInput from "./LinkInput";

function normalize(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ── My Gear Tab ───────────────────────────────────────────────────────────────
function MyGearTab({ items, loading, excludeId, selectedId, onSelect }) {
  const { t } = useTranslation("common");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const available = items.filter((i) => String(i._id) !== excludeId);
    const tokens = normalize(searchQuery).split(/\s+/).filter(Boolean);
    const result =
      tokens.length === 0
        ? available
        : available.filter((item) => {
            const hay = normalize(
              [item.name, item.brand, item.itemType].filter(Boolean).join(" "),
            );
            return tokens.every((tok) => hay.includes(tok));
          });
    return [...result].sort((a, b) =>
      normalize(a.name).localeCompare(normalize(b.name)),
    );
  }, [items, searchQuery, excludeId]);

  return (
    <>
      <div className="pb-3 flex-shrink-0">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 text-sm" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("swapModal.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-1.5 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <Spinner centered />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-primary/50 text-center py-6">
            {searchQuery ? t("swapModal.noResults") : t("swapModal.noGear")}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((item) => {
              const id = String(item._id);
              const isSelected = selectedId === id;
              return (
                <li
                  key={id}
                  onClick={() => onSelect(isSelected ? null : id)}
                  className={`flex items-center px-3 py-2 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-secondary/40 bg-secondary/10"
                      : "border-primary/20 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {item.brand && (
                        <span className="mr-1">{item.brand}</span>
                      )}
                      {item.name}
                    </div>
                    <div className="text-xs text-primary/50">
                      {tItemType(t, item.itemType) || "—"}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-secondary ml-2" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

// ── Catalog Tab ───────────────────────────────────────────────────────────────
function CatalogTab({ selectedId, onSelect }) {
  const { t } = useTranslation("common");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const searchInputRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(h);
  }, [searchQuery]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (categoryFilter !== "all") params.category = categoryFilter;
    if (subcategoryFilter !== "all") params.subcategory = subcategoryFilter;
    if (brandFilter !== "all") params.brand = brandFilter;
    api
      .get("/catalog/items", { params })
      .then(({ data }) => setItems(data || []))
      .catch(() => toast.error(t("swapModal.catalog.loadFailed")))
      .finally(() => setLoading(false));
  }, [debouncedSearch, categoryFilter, subcategoryFilter, brandFilter, t]);

  const subcategories = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter(
              (i) => categoryFilter === "all" || i.category === categoryFilter,
            )
            .map((i) => i.subcategory)
            .filter(Boolean),
        ),
      ].sort(),
    [items, categoryFilter],
  );

  const brands = useMemo(
    () => [...new Set(items.map((i) => i.brand).filter(Boolean))].sort(),
    [items],
  );

  return (
    <>
      <div className="pb-2 flex-shrink-0">
        <div className="relative mb-2">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 text-sm" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("swapModal.catalog.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-1.5 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setSubcategoryFilter("all");
            }}
            className="flex-1 min-w-0 border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-xs"
          >
            <option value="all">
              {t("globalItemModal.importTab.filters.allCategories")}
            </option>
            {CATALOG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {tCategory(t, cat)}
              </option>
            ))}
          </select>
          <select
            value={subcategoryFilter}
            onChange={(e) => setSubcategoryFilter(e.target.value)}
            disabled={subcategories.length === 0}
            className="flex-1 min-w-0 border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-xs"
          >
            <option value="all">
              {t("globalItemModal.importTab.filters.allSubcategories")}
            </option>
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {tSubcategory(t, s)}
              </option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="flex-1 min-w-0 border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-xs"
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
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <Spinner centered />
        ) : items.length === 0 ? (
          <p className="text-sm text-primary/50 text-center py-6">
            {t("swapModal.catalog.empty")}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const id = String(item._id);
              const isSelected = selectedId === id;
              return (
                <li
                  key={id}
                  onClick={() => onSelect(isSelected ? null : id)}
                  className={`flex items-center px-3 py-2 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-secondary/40 bg-secondary/10"
                      : "border-primary/20 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {item.brand && (
                        <span className="mr-1">{item.brand}</span>
                      )}
                      {item.name}
                    </div>
                    <div className="text-xs text-primary/50">
                      {tItemType(t, item.itemType) ||
                        tSubcategory(t, item.subcategory) ||
                        "—"}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-secondary ml-2" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

// ── Custom Tab ────────────────────────────────────────────────────────────────
function CustomTab({ form, onChange }) {
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { unitLabel } = useWeightInput(unit);

  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-2 py-1">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              {t("globalItemModal.labels.name")} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              autoFocus
              placeholder={t("globalItemModal.placeholders.name")}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              {t("globalItemModal.labels.brand")}
            </label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => onChange({ ...form, brand: e.target.value })}
              placeholder={t("globalItemModal.placeholders.brand")}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              {t("globalItemModal.labels.category", "Category")}
            </label>
            <select
              value={form.catalogCategory}
              onChange={(e) => onChange({ ...form, catalogCategory: e.target.value })}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 text-sm"
            >
              <option value="">{t("myGear.filter.uncategorized", "Uncategorized")}</option>
              {CATALOG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{tCategory(t, cat)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              {t("globalItemModal.labels.itemType")}
            </label>
            <input
              type="text"
              value={form.itemType}
              onChange={(e) => onChange({ ...form, itemType: e.target.value })}
              placeholder={t("globalItemModal.placeholders.itemType")}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              {t("globalItemModal.labels.weight", { unit: unitLabel })}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => onChange({ ...form, weight: e.target.value })}
              placeholder={unitLabel === "g" ? "0" : "0.0"}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>
          <div>
            <LinkInput
              value={form.link}
              onChange={(v) => onChange({ ...form, link: v })}
              label={t("globalItemModal.labels.link")}
              placeholder={t("globalItemModal.placeholders.link")}
              required={false}
              className="text-sm"
            />
          </div>
          <div className="col-span-2">
            <LinkInput
              value={form.imageUrl}
              onChange={(v) => onChange({ ...form, imageUrl: v })}
              label={t("globalItemModal.labels.imageUrl", "Image URL")}
              placeholder="https://example.com/image.jpg"
              required={false}
              className="text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-primary mb-1">
            {t("globalItemModal.labels.description")}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder={t("globalItemModal.placeholders.description", "Brief description...")}
            className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm resize-none h-16"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function SwapItemModal({
  item,
  listId,
  catId,
  onClose,
  onSwapped,
}) {
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { parseInput } = useWeightInput(unit);

  const [tab, setTab] = useState(
    () => localStorage.getItem("treklist_swap_item_tab") || "myGear",
  );
  const [saving, setSaving] = useState(false);

  // My Gear tab
  const [myGearItems, setMyGearItems] = useState([]);
  const [myGearLoading, setMyGearLoading] = useState(true);
  const [myGearSelectedId, setMyGearSelectedId] = useState(null);

  // Catalog tab
  const [catalogSelectedId, setCatalogSelectedId] = useState(null);

  // Custom tab
  const [customForm, setCustomForm] = useState({
    name: "",
    brand: "",
    catalogCategory: "",
    itemType: "",
    weight: "",
    link: "",
    imageUrl: "",
    description: "",
  });

  useEffect(() => {
    api
      .get("/my-gear/items?includeImported=true")
      .then(({ data }) => setMyGearItems(data || []))
      .catch(() => toast.error(t("swapModal.toast.loadFailed")))
      .finally(() => setMyGearLoading(false));
  }, [t]);

  // Close on ESC
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const excludeId = String(item?.globalItem || item?._id || "");

  const doSwap = async (newGlobalItemId) => {
    const { data } = await api.patch(
      `/dashboard/${listId}/categories/${catId}/items/${item._id}/swap`,
      { newGlobalItemId },
    );
    toast.success(t("swapModal.toast.swapped"));
    onSwapped?.(data);
    onClose?.();
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (tab === "myGear") {
        if (!myGearSelectedId) return;
        await doSwap(myGearSelectedId);
      } else if (tab === "catalog") {
        if (!catalogSelectedId) return;
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: [catalogSelectedId],
        });
        const gi = data.items?.[0];
        if (!gi) throw new Error("Import failed");
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        await doSwap(String(gi._id));
      } else if (tab === "custom") {
        if (!customForm.name.trim()) {
          toast.error(t("validation.nameRequired"));
          return;
        }
        let grams;
        if (customForm.weight !== "") {
          grams = parseInput(customForm.weight);
          if (grams == null || grams < 0) {
            toast.error(t("validation.weightInvalid"));
            return;
          }
        }
        const payload = { name: customForm.name.trim() };
        if (customForm.catalogCategory) payload.catalogCategory = customForm.catalogCategory;
        if (customForm.brand.trim()) payload.brand = customForm.brand.trim();
        if (customForm.itemType.trim()) payload.itemType = customForm.itemType.trim();
        if (typeof grams === "number") payload.weight = grams;
        if (customForm.link.trim()) payload.link = customForm.link.trim();
        if (customForm.imageUrl.trim()) payload.imageUrls = [customForm.imageUrl.trim()];
        if (customForm.description.trim()) payload.description = customForm.description.trim();
        const { data: gi } = await api.post("/global/items", payload);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        await doSwap(String(gi._id));
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || t("swapModal.toast.swapFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const canConfirm =
    tab === "myGear"
      ? !!myGearSelectedId
      : tab === "catalog"
        ? !!catalogSelectedId
        : customForm.name.trim().length > 0;

  const confirmLabel = saving
    ? t("swapModal.swapping")
    : tab === "myGear"
      ? t("swapModal.confirm")
      : tab === "catalog"
        ? t("swapModal.catalog.confirmLabel")
        : t("swapModal.custom.confirmLabel");

  const tabs = [
    { key: "myGear", label: t("swapModal.tabs.myGear") },
    { key: "catalog", label: t("swapModal.tabs.catalog") },
    { key: "custom", label: t("swapModal.tabs.custom") },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-lg shadow-2xl w-full max-w-2xl mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-primary/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {t("swapModal.title")}
            </h2>
            <p className="text-xs text-primary/60 mt-0.5 truncate max-w-[280px]">
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80 ml-2"
            aria-label={t("actions.close")}
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-primary/10 flex-shrink-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                localStorage.setItem("treklist_swap_item_tab", key);
              }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-b-2 border-secondary text-secondary"
                  : "text-primary/60 hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content — fixed height so tabs don't shift modal size */}
        <div className="h-[360px] overflow-hidden flex flex-col px-4 pt-3">
          {tab === "myGear" && (
            <MyGearTab
              items={myGearItems}
              loading={myGearLoading}
              excludeId={excludeId}
              selectedId={myGearSelectedId}
              onSelect={setMyGearSelectedId}
            />
          )}
          {tab === "catalog" && (
            <CatalogTab
              selectedId={catalogSelectedId}
              onSelect={setCatalogSelectedId}
            />
          )}
          {tab === "custom" && (
            <CustomTab form={customForm} onChange={setCustomForm} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-primary/10 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-neutralAlt hover:bg-neutralAlt/90 text-primary text-sm"
          >
            {t("actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || saving}
            className={`px-3 py-1.5 rounded bg-secondary text-white text-sm flex items-center gap-1.5 ${
              !canConfirm || saving
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-secondary/80"
            }`}
          >
            <FiRefreshCw className={`text-xs ${saving ? "animate-spin" : ""}`} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
