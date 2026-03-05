// src/components/AddGearItemModal.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../services/api";
import { FiX, FiSearch } from "react-icons/fi";
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
function MyGearTab({ items, loading, existingGlobalIds, selectedIds, onToggle }) {
  const { t } = useTranslation("common");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const tokens = normalize(searchQuery).split(/\s+/).filter(Boolean);
    const result =
      tokens.length === 0
        ? items
        : items.filter((item) => {
            const hay = normalize(
              [item.name, item.brand, item.itemType].filter(Boolean).join(" "),
            );
            return tokens.every((tok) => hay.includes(tok));
          });
    return [...result].sort((a, b) =>
      normalize(a.name).localeCompare(normalize(b.name)),
    );
  }, [items, searchQuery]);

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
            placeholder={t("addGearItemModal.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-1.5 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <Spinner centered />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-primary/50 text-center py-6">
            {t("addGearItemModal.empty")}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((item) => {
              const disabled = existingGlobalIds.has(String(item._id));
              const checked = selectedIds.has(String(item._id));
              return (
                <li
                  key={item._id}
                  onClick={() => !disabled && onToggle(String(item._id))}
                  className={`flex items-center px-3 py-2 rounded border cursor-pointer transition-colors ${
                    disabled
                      ? "border-primary/10 opacity-50 cursor-default"
                      : checked
                        ? "border-secondary/40 bg-secondary/10"
                        : "border-primary/20 hover:bg-primary/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    disabled={disabled}
                    className="mr-3 h-4 w-4 text-secondary border-primary rounded flex-shrink-0 pointer-events-none"
                  />
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
                  {disabled && (
                    <span className="text-xs text-primary/40 ml-2 flex-shrink-0">
                      {t("addGearItemModal.badges.added")}
                    </span>
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
function CatalogTab({ selectedIds, onSelectionChange }) {
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
      .catch(() => toast.error(t("addGearItemModal.catalog.loadFailed")))
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

  const toggle = (id) => {
    const copy = new Set(selectedIds);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    onSelectionChange(copy);
  };

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
            placeholder={t("addGearItemModal.catalog.searchPlaceholder")}
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
            {t("addGearItemModal.catalog.empty")}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const id = String(item._id);
              const checked = selectedIds.has(id);
              return (
                <li
                  key={id}
                  onClick={() => toggle(id)}
                  className={`flex items-center px-3 py-2 rounded border cursor-pointer transition-colors ${
                    checked
                      ? "border-secondary/40 bg-secondary/10"
                      : "border-primary/20 hover:bg-primary/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    className="mr-3 h-4 w-4 text-secondary border-primary rounded flex-shrink-0 pointer-events-none"
                  />
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
export default function AddGearItemModal({
  listId,
  categoryId,
  onClose,
  onAdded,
}) {
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { parseInput } = useWeightInput(unit);

  const [tab, setTab] = useState("myGear");
  const [saving, setSaving] = useState(false);

  // My Gear tab
  const [myGearItems, setMyGearItems] = useState([]);
  const [myGearLoading, setMyGearLoading] = useState(true);
  const [myGearSelectedIds, setMyGearSelectedIds] = useState(new Set());

  // Catalog tab
  const [catalogSelectedIds, setCatalogSelectedIds] = useState(new Set());

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

  // Existing items for dup-check
  const [existingItems, setExistingItems] = useState([]);

  useEffect(() => {
    api
      .get("/my-gear/items")
      .then(({ data }) => setMyGearItems(data || []))
      .catch(() => {})
      .finally(() => setMyGearLoading(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: cats } = await api.get(`/dashboard/${listId}/categories`);
        const itemArrays = await Promise.all(
          cats.map((cat) =>
            api
              .get(`/dashboard/${listId}/categories/${cat._id}/items`)
              .then((r) => r.data || []),
          ),
        );
        setExistingItems(itemArrays.flat());
      } catch (err) {
        console.error("Error fetching existing items:", err);
      }
    })();
  }, [listId]);

  // Close on ESC
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const existingGlobalIds = useMemo(
    () => new Set(existingItems.map((it) => String(it.globalItem || it._id))),
    [existingItems],
  );

  const computeStartPos = () => {
    const itemsInCat = existingItems.filter(
      (it) => String(it.category) === String(categoryId),
    );
    const maxPos = itemsInCat.length
      ? Math.max(
          ...itemsInCat.map((it) =>
            Number.isFinite(it.position) ? it.position : -1,
          ),
        )
      : -1;
    return maxPos + 1;
  };

  const addGlobalItemsToList = async (globalItems) => {
    const startPos = computeStartPos();
    await Promise.all(
      globalItems.map((gi, idx) =>
        api.post(`/dashboard/${listId}/categories/${categoryId}/items`, {
          globalItem: gi._id,
          productId: gi.productId || null,
          brand: gi.brand,
          itemType: gi.itemType,
          name: gi.name,
          description: gi.description,
          weight: gi.weight,
          link: gi.link,
          imageUrls: gi.imageUrls || [],
          worn: gi.worn,
          consumable: gi.consumable,
          quantity: 1,
          position: startPos + idx,
        }),
      ),
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (tab === "myGear") {
        if (myGearSelectedIds.size === 0) return;
        const dups = [...myGearSelectedIds].filter((id) =>
          existingGlobalIds.has(id),
        );
        if (dups.length > 0) {
          toast.error(t("addGearItemModal.toasts.alreadyInList"));
          return;
        }
        const selected = myGearItems.filter((i) =>
          myGearSelectedIds.has(String(i._id)),
        );
        await addGlobalItemsToList(selected);
      } else if (tab === "catalog") {
        if (catalogSelectedIds.size === 0) return;
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: [...catalogSelectedIds],
        });
        await addGlobalItemsToList(data.items || []);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
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
        await addGlobalItemsToList([gi]);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
      }
      onAdded?.();
      onClose?.();
    } catch (err) {
      console.error("Error adding items:", err);
      toast.error(t("addGearItemModal.toasts.addFailed"));
    } finally {
      setSaving(false);
    }
  };

  const canConfirm =
    tab === "myGear"
      ? myGearSelectedIds.size > 0
      : tab === "catalog"
        ? catalogSelectedIds.size > 0
        : customForm.name.trim().length > 0;

  const confirmLabel = saving
    ? t("addGearItemModal.buttons.adding")
    : tab === "myGear"
      ? t("addGearItemModal.buttons.add", { count: myGearSelectedIds.size })
      : tab === "catalog"
        ? t("addGearItemModal.buttons.importAndAdd", {
            count: catalogSelectedIds.size,
          })
        : t("addGearItemModal.buttons.createAndAdd");

  const tabs = [
    { key: "myGear", label: t("addGearItemModal.tabs.myGear") },
    { key: "catalog", label: t("addGearItemModal.tabs.catalog") },
    { key: "custom", label: t("addGearItemModal.tabs.custom") },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl shadow-2xl max-w-2xl w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-primary/10 flex-shrink-0">
          <h2 className="text-lg font-semibold text-primary">
            {t("addGearItemModal.title")}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-error hover:text-error/80"
            aria-label={t("addGearItemModal.a11y.close")}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-primary/10 flex-shrink-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
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
        <div className="h-[360px] overflow-hidden flex flex-col px-5 pt-3">
          {tab === "myGear" && (
            <MyGearTab
              items={myGearItems}
              loading={myGearLoading}
              existingGlobalIds={existingGlobalIds}
              selectedIds={myGearSelectedIds}
              onToggle={(id) =>
                setMyGearSelectedIds((prev) => {
                  const c = new Set(prev);
                  c.has(id) ? c.delete(id) : c.add(id);
                  return c;
                })
              }
            />
          )}
          {tab === "catalog" && (
            <CatalogTab
              selectedIds={catalogSelectedIds}
              onSelectionChange={setCatalogSelectedIds}
            />
          )}
          {tab === "custom" && (
            <CustomTab form={customForm} onChange={setCustomForm} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-primary/10 flex-shrink-0">
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
            className={`px-3 py-1.5 rounded bg-secondary text-white text-sm ${
              !canConfirm || saving
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-secondary/80"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
