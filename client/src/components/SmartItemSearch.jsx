// src/components/SmartItemSearch.jsx
// Unified item search: My Gear + Catalog + AI fill-in fallback.
// Drop this inside any modal/drawer shell — it manages its own search state.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiX, FiPlus, FiLoader, FiCamera } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { CATALOG_CATEGORIES, CATALOG_SUBCATEGORIES, tCategory } from "../config/catalogTaxonomy";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import Spinner from "./ui/Spinner";
import LinkInput from "./LinkInput";
import CatalogItemPreviewModal from "./CatalogItemPreviewModal";
import PhotoScanModal from "./PhotoScanModal";

// key = translation lookup key; value = API filter value (must stay English)
const CHIPS = [
  { key: "sleep",       value: "Sleep System" },
  { key: "shelter",     value: "Shelter" },
  { key: "packs",       value: "Backpacks & Bags" },
  { key: "clothing",    value: "Unisex Clothing" },
  { key: "footwear",    value: "Footwear" },
  { key: "kitchen",     value: "Kitchen & Cooking" },
  { key: "hydration",   value: "Hydration" },
  { key: "electronics", value: "Electronics & Power" },
  { key: "tools",       value: "Accessories & Tools" },
  { key: "health",      value: "Health & Hygiene" },
  { key: "navigation",  value: "Navigation & Planning" },
];

function normalize(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ item, selected, onToggle, onViewDetails, multiSelect, disabled, badge, subLabel, priceLabel }) {
  const id = String(item._id);
  return (
    <li
      className={`flex items-center px-3 py-2 rounded border transition-colors ${
        disabled
          ? "border-primary/10 opacity-50"
          : selected
            ? "border-secondary/40 bg-secondary/10"
            : "border-primary/20 hover:bg-primary/5"
      }`}
    >
      <button
        type="button"
        onClick={() => !disabled && onToggle(id)}
        disabled={disabled}
        className="mr-3 flex-shrink-0 flex items-center cursor-pointer"
        tabIndex={-1}
      >
        <input
          type={multiSelect ? "checkbox" : "radio"}
          checked={selected}
          onChange={() => {}}
          disabled={disabled}
          className="h-4 w-4 text-secondary border-primary rounded pointer-events-none"
        />
      </button>
      <div
        className={`flex-1 min-w-0 ${onViewDetails && !disabled ? "cursor-pointer" : ""}`}
        onClick={() => onViewDetails && !disabled && onViewDetails(item)}
      >
        <div className={`text-sm font-medium text-primary truncate ${onViewDetails && !disabled ? "hover:underline" : ""}`}>
          {item.brand && <span className="mr-1">{item.brand}</span>}
          {item.name}
        </div>
        {subLabel && <div className="text-xs text-primary/50">{subLabel}</div>}
      </div>
      {priceLabel && (
        <span className="text-xs text-secondary ml-2 flex-shrink-0 font-medium">{priceLabel}</span>
      )}
      {badge && (
        <span className="text-xs text-primary/40 ml-2 flex-shrink-0">{badge}</span>
      )}
    </li>
  );
}

// ── Section (My Gear or Catalog) ──────────────────────────────────────────────
function ResultSection({ title, items, type, myGearSelected, catalogSelected, onToggleMyGear, onToggleCatalog, onViewCatalogDetails, multiSelect, existingGlobalIds, loading }) {
  const { t } = useTranslation("common");
  if (loading) {
    return (
      <div className="mb-3">
        <p className="text-xs text-primary/40 font-medium uppercase tracking-wide px-1 mb-2">{title}</p>
        <Spinner centered />
      </div>
    );
  }
  if (!loading && (!items || items.length === 0)) return null;

  return (
    <div className="mb-3">
      <p className="text-xs text-primary/40 font-medium uppercase tracking-wide px-1 mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const id = String(item._id);
          if (type === "myGear") {
            const disabled = existingGlobalIds?.has(id);
            return (
              <ItemRow
                key={id}
                item={item}
                selected={myGearSelected.has(id)}
                onToggle={onToggleMyGear}
                multiSelect={multiSelect}
                disabled={disabled}
                badge={disabled ? t("smartItemSearch.added", "Added") : null}
                subLabel={item.itemType || null}
              />
            );
          } else {
            const offer = item.offers?.[0];
            const priceLabel =
              offer?.price ? `$${offer.price} · ${offer.merchantName || ""}`.replace(/ · $/, "") : null;
            return (
              <ItemRow
                key={id}
                item={item}
                selected={catalogSelected.has(id)}
                onToggle={onToggleCatalog}
                onViewDetails={onViewCatalogDetails}
                multiSelect={multiSelect}
                subLabel={item.itemType || item.subcategory || null}
                priceLabel={priceLabel}
              />
            );
          }
        })}
      </ul>
    </div>
  );
}

// ── No results view ───────────────────────────────────────────────────────────
function NoResults({ query, onAiSearch, onManual, aiLoading, onCreateCustom }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
      <p className="text-sm text-primary/50 text-center">
        {t("smartItemSearch.noResultsFor", "No results for")}{" "}
        <span className="font-medium text-primary">"{query}"</span>
      </p>
      <button
        onClick={onAiSearch}
        disabled={aiLoading}
        className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary text-sm rounded-lg border border-secondary/30 hover:bg-secondary/20 disabled:opacity-50 transition-colors"
      >
        {aiLoading ? (
          <FiLoader size={14} className="animate-spin" />
        ) : (
          <span>✨</span>
        )}
        {aiLoading
          ? t("smartItemSearch.aiSearching", "Searching with AI...")
          : t("smartItemSearch.aiFill", "Fill with AI")}
      </button>
      {!aiLoading && (
        <p className="text-xs text-primary/35 text-center">
          {t("smartItemSearch.aiTip", "Tip: include brand, model & size for better results")}
        </p>
      )}
      {!aiLoading && (
        onCreateCustom ? (
          <button
            onClick={onCreateCustom}
            className="flex items-center gap-1.5 text-sm text-secondary/80 hover:text-secondary border border-secondary/20 hover:border-secondary/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            <FiPlus size={14} />
            {t("smartItemSearch.createCustomItem", 'Create "{query}" as a custom item').replace("{query}", query)}
          </button>
        ) : (
          <button
            onClick={onManual}
            className="flex items-center gap-1.5 text-sm text-primary/50 hover:text-primary transition-colors"
          >
            <FiPlus size={14} />
            {t("smartItemSearch.addManually", "Add manually")}
          </button>
        )
      )}
    </div>
  );
}

// ── Create row (always visible above results, non-tabLayout mode only) ────────
function CreateRow({ query, onManual, onAiSearch, aiLoading }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-center gap-2 px-5 py-2 border-b border-primary/10 flex-shrink-0">
      <button
        type="button"
        onClick={onManual}
        className="flex items-center gap-1.5 text-sm text-primary/50 hover:text-primary transition-colors"
      >
        <FiPlus size={13} className="flex-shrink-0" />
        {t("smartItemSearch.addManually", "Add manually")}
      </button>
      <span className="text-primary/20 text-xs">·</span>
      <button
        type="button"
        onClick={onAiSearch}
        disabled={aiLoading || !query}
        className="flex items-center gap-1 text-sm text-secondary/70 hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title={!query ? t("smartItemSearch.aiTypeFirst", "Type a name first to use AI fill") : undefined}
      >
        {aiLoading ? (
          <FiLoader size={12} className="animate-spin" />
        ) : (
          <span className="text-xs">✨</span>
        )}
        {aiLoading
          ? t("smartItemSearch.aiSearchingShort", "Searching…")
          : t("smartItemSearch.aiFill", "Fill with AI")}
      </button>
    </div>
  );
}

// ── Custom / edit form ────────────────────────────────────────────────────────
function CustomForm({ form, onChange, unitLabel }) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1 gap-3 py-2 pb-4 min-h-0">
        {/* Row 1: Name + Brand */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              {t("smartItemSearch.form.name", "Name")} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              autoFocus
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 placeholder:text-primary/40 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              {t("smartItemSearch.form.brand", "Brand")}
            </label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => onChange({ ...form, brand: e.target.value })}
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
            />
          </div>
        </div>
        {/* Row 2: Category + Item Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              {t("smartItemSearch.form.category", "Category")}
            </label>
            <select
              value={form.catalogCategory}
              onChange={(e) => onChange({ ...form, catalogCategory: e.target.value })}
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
            >
              <option value="">{t("smartItemSearch.form.uncategorized", "Uncategorized")}</option>
              {CATALOG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              {t("smartItemSearch.form.itemType", "Item type")}
            </label>
            <input
              type="text"
              value={form.itemType}
              onChange={(e) => onChange({ ...form, itemType: e.target.value })}
              placeholder={t("smartItemSearch.form.itemTypePlaceholder", "e.g. Canister Stove")}
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
            />
          </div>
        </div>
        {/* Row 3: Weight + Link */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              {t("smartItemSearch.form.weight", "Weight")} ({unitLabel})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => onChange({ ...form, weight: e.target.value })}
              placeholder={unitLabel === "g" ? "0" : "0.0"}
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
            />
          </div>
          <LinkInput
            value={form.link}
            onChange={(v) => onChange({ ...form, link: v })}
            label={t("smartItemSearch.form.link", "Link")}
            placeholder="https://"
            required={false}
          />
        </div>
        {/* Image URL - full width */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1">
            {t("smartItemSearch.form.imageUrl", "Image URL")}
          </label>
          <input
            type="text"
            value={form.imageUrl}
            onChange={(e) => onChange({ ...form, imageUrl: e.target.value })}
            placeholder={t("smartItemSearch.form.imageUrlPlaceholder", "example.com/image.jpg")}
            className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
          />
        </div>
        {/* Description - expands to fill remaining space */}
        <div className="flex flex-col flex-1 min-h-0">
          <label className="block text-sm font-medium text-primary mb-1">
            {t("smartItemSearch.form.description", "Description")}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="flex-1 w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
/**
 * Props:
 *   multiSelect          boolean  — true for add-to-list/library; false for swap
 *   showMyGear           boolean  — false for library-only contexts (AddGearDrawer, GlobalItemModal)
 *   excludeGlobalItemId  string   — for swap: exclude this globalItem from My Gear results
 *   existingGlobalIds    Set      — items already in list (shown as disabled/Added)
 *   onConfirm            async fn — called with { source, globalItems?, catalogIds?, fields? }
 *   onClose              fn
 *   tabLayout            boolean  — use tabbed Import/Custom layout (AddGearItemModal)
 */
export default function SmartItemSearch({
  multiSelect = true,
  showMyGear = true,
  excludeGlobalItemId = null,
  existingGlobalIds = new Set(),
  onConfirm,
  onClose,
  tabLayout = false,
  confirmLabels = {},
}) {
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { parseInput, formatInput, unitLabel } = useWeightInput(unit);
  // Item request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: "", brand: "", link: "" });
  const [requestSending, setRequestSending] = useState(false);

  async function handleSubmitRequest(e) {
    e.preventDefault();
    if (!requestForm.name.trim() || !requestForm.brand.trim()) return;
    setRequestSending(true);
    try {
      await api.post("/support/catalog-item-requests", requestForm);
      toast.success("Request sent! We'll look into adding it.");
      setShowRequestForm(false);
      setRequestForm({ name: "", brand: "", link: "" });
    } catch {
      toast.error("Failed to send request. Please try again.");
    } finally {
      setRequestSending(false);
    }
  }

  // Search
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState(null);
  const [brandFilter, setBrandFilter] = useState(null);
  const [brandOptions, setBrandOptions] = useState([]);
  const searchRef = useRef(null);

  // My Gear
  const [myGearItems, setMyGearItems] = useState([]);
  const [myGearLoading, setMyGearLoading] = useState(showMyGear);

  // Catalog
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Selection
  const [myGearSelected, setMyGearSelected] = useState(new Set());
  const [catalogSelected, setCatalogSelected] = useState(new Set());

  // AI state
  const [aiLoading, setAiLoading] = useState(false);

  // Custom form (AI edit or manual creation)
  const [customMode, setCustomMode] = useState(null); // null | 'ai' | 'manual'
  const [customForm, setCustomForm] = useState({
    name: "", brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "", imageUrl: "",
  });

  // Submitting state for confirm button
  const [confirming, setConfirming] = useState(false);

  // Photo scan modal
  const [showScanModal, setShowScanModal] = useState(false);

  // Catalog item preview
  const [previewItem, setPreviewItem] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewImporting, setPreviewImporting] = useState(false);

  // Tab state (tabLayout mode only)
  const [activeTab, setActiveTab] = useState("import"); // "import" | "custom"

  // Whether the custom form is currently shown
  const showingCustomForm = tabLayout ? activeTab === "custom" : !!customMode;

  // Switch to Custom tab, optionally pre-filling the name from the search query
  const switchToCustom = (prefillName = "") => {
    setActiveTab("custom");
    if (!customMode) {
      setCustomMode("manual");
      setCustomForm((f) => ({ ...f, name: prefillName || f.name }));
    }
  };

  const handleViewCatalogDetails = async (item) => {
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { data } = await api.get(`/catalog/items/${item._id}`);
      setPreviewItem(data);
    } catch {
      setPreviewError(t("smartItemSearch.toasts.previewLoadFailed", "Failed to load item details."));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!previewItem || previewImporting) return;
    setPreviewImporting(true);
    try {
      await onConfirm({ source: "catalog", catalogIds: [String(previewItem._id)] });
      setPreviewItem(null);
    } finally {
      setPreviewImporting(false);
    }
  };

  // Focus search on mount
  useEffect(() => {
    if (window.innerWidth >= 640) searchRef.current?.focus();
  }, []);

  // Load My Gear
  useEffect(() => {
    if (!showMyGear) return;
    api
      .get("/my-gear/items")
      .then(({ data }) => setMyGearItems(data || []))
      .catch(() => {})
      .finally(() => setMyGearLoading(false));
  }, [showMyGear]);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset dependent filters when category changes
  useEffect(() => {
    setSubcategoryFilter(null);
    setBrandFilter(null);
  }, [categoryFilter]);

  // Fetch brand options for tabLayout dropdowns
  useEffect(() => {
    if (!tabLayout) return;
    const params = {};
    if (categoryFilter) params.category = categoryFilter;
    if (subcategoryFilter) params.subcategory = subcategoryFilter;
    api
      .get("/catalog/brands", { params })
      .then(({ data }) => setBrandOptions(data || []))
      .catch(() => setBrandOptions([]));
  }, [categoryFilter, subcategoryFilter, tabLayout]);

  // Catalog search
  useEffect(() => {
    if (!debouncedQuery && !categoryFilter && !subcategoryFilter && !brandFilter) {
      setCatalogResults([]);
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    const params = {};
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
    if (categoryFilter) params.category = categoryFilter;
    if (subcategoryFilter) params.subcategory = subcategoryFilter;
    if (brandFilter) params.brand = brandFilter;
    api
      .get("/catalog/items", { params })
      .then(({ data }) => setCatalogResults(data || []))
      .catch(() => setCatalogResults([]))
      .finally(() => setCatalogLoading(false));
  }, [debouncedQuery, categoryFilter, subcategoryFilter, brandFilter]);

  // Reset AI/custom state when query changes (non-tabLayout only)
  useEffect(() => {
    if (tabLayout) return;
    if (customMode !== "manual") setCustomMode(null);
  }, [debouncedQuery, categoryFilter, subcategoryFilter, brandFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC to close
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Filtered My Gear (client-side)
  const filteredMyGear = useMemo(() => {
    if (!showMyGear) return [];
    let items = excludeGlobalItemId
      ? myGearItems.filter((i) => String(i._id) !== String(excludeGlobalItemId))
      : myGearItems;
    if (categoryFilter) {
      items = items.filter((i) => i.catalogCategory === categoryFilter);
    }
    if (subcategoryFilter) {
      items = items.filter((i) => i.subcategory === subcategoryFilter || i.itemType === subcategoryFilter);
    }
    if (brandFilter) {
      items = items.filter((i) => i.brand === brandFilter);
    }
    if (!debouncedQuery) return items;
    const tokens = normalize(debouncedQuery).split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const hay = normalize(
        [item.name, item.brand, item.itemType, item.description].filter(Boolean).join(" "),
      );
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [myGearItems, debouncedQuery, excludeGlobalItemId, showMyGear, categoryFilter, subcategoryFilter, brandFilter]);

  // Toggle selection
  const toggleMyGear = (id) => {
    if (!multiSelect) {
      setMyGearSelected(new Set([id]));
      setCatalogSelected(new Set());
    } else {
      setMyGearSelected((prev) => {
        const c = new Set(prev);
        c.has(id) ? c.delete(id) : c.add(id);
        return c;
      });
    }
  };

  const toggleCatalog = (id) => {
    if (!multiSelect) {
      setCatalogSelected(new Set([id]));
      setMyGearSelected(new Set());
    } else {
      setCatalogSelected((prev) => {
        const c = new Set(prev);
        c.has(id) ? c.delete(id) : c.add(id);
        return c;
      });
    }
  };

  // AI fill — skips the preview card and goes straight to the prefilled form
  const handleAiSearch = async () => {
    if (!query.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/fill-item", { query: query.trim() });
      setCustomMode("ai");
      setCustomForm({
        name: data.name || "",
        brand: data.brand || "",
        catalogCategory: data.category || "",
        itemType: data.itemType || "",
        weight: data.weightGrams != null ? formatInput(data.weightGrams) : "",
        description: data.description || "",
        link: data.link || "",
        imageUrl: data.imageUrl || "",
      });
      // In tabLayout, switch to Custom tab to show the AI-filled form
      if (tabLayout) setActiveTab("custom");
    } catch {
      toast.error(t("smartItemSearch.toasts.aiFailed", "AI search failed. Try adding manually."));
    } finally {
      setAiLoading(false);
    }
  };

  // Footer confirm
  const handleConfirm = async () => {
    if (confirming) return;

    if (showingCustomForm) {
      if (!customForm.name.trim()) {
        toast.error(t("smartItemSearch.toasts.nameRequired", "Name is required"));
        return;
      }
      let weightGrams;
      if (customForm.weight !== "") {
        weightGrams = parseInput(customForm.weight);
        if (weightGrams == null || weightGrams < 0) {
          toast.error(t("smartItemSearch.toasts.invalidWeight", "Invalid weight"));
          return;
        }
      }
      setConfirming(true);
      try {
        await onConfirm({
          source: "newItem",
          fields: {
            name: customForm.name.trim(),
            brand: customForm.brand.trim(),
            catalogCategory: customForm.catalogCategory,
            itemType: customForm.itemType.trim(),
            weight: typeof weightGrams === "number" ? weightGrams : null,
            description: customForm.description.trim(),
            link: customForm.link.trim(),
            imageUrl: customForm.imageUrl.trim(),
          },
        });
      } finally {
        setConfirming(false);
      }
      return;
    }

    if (myGearSelected.size > 0) {
      const globalItems = myGearItems.filter((i) => myGearSelected.has(String(i._id)));
      setConfirming(true);
      try {
        await onConfirm({ source: "myGear", globalItems });
      } finally {
        setConfirming(false);
      }
    } else if (catalogSelected.size > 0) {
      setConfirming(true);
      try {
        await onConfirm({ source: "catalog", catalogIds: [...catalogSelected] });
      } finally {
        setConfirming(false);
      }
    }
  };

  const totalSelected = myGearSelected.size + catalogSelected.size;
  const canConfirm = showingCustomForm
    ? customForm.name.trim().length > 0
    : totalSelected > 0;

  const labelAdd    = confirmLabels.add    ?? t("smartItemSearch.add",    "Add");
  const labelImport = confirmLabels.import ?? t("smartItemSearch.import", "Import");
  const labelCreate = confirmLabels.create ?? t("smartItemSearch.create", "Create");

  const confirmLabel = confirming
    ? t("smartItemSearch.saving", "Saving...")
    : showingCustomForm
      ? labelCreate
      : myGearSelected.size > 0
        ? multiSelect && myGearSelected.size > 1
          ? `${labelAdd} (${myGearSelected.size})`
          : labelAdd
        : catalogSelected.size > 0
          ? multiSelect && catalogSelected.size > 1
            ? `${labelImport} (${catalogSelected.size})`
            : labelImport
          : labelAdd;

  const hasSearchIntent = debouncedQuery.trim() || categoryFilter || subcategoryFilter || brandFilter;
  const hasNoResults =
    hasSearchIntent &&
    !catalogLoading &&
    !aiLoading &&
    filteredMyGear.length === 0 &&
    catalogResults.length === 0 &&
    !showingCustomForm;

  return (
    <div className="flex flex-col h-full">

      {/* ── Tab row (tabLayout only) ───────────────────────────────────────── */}
      {tabLayout && (
        <div className="flex items-center border-b border-primary/10 flex-shrink-0 px-5">
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "import"
                ? "border-secondary text-secondary"
                : "border-transparent text-primary/60 hover:text-primary"
            }`}
          >
            {t("smartItemSearch.tabs.import", "Import")}
          </button>
          <button
            type="button"
            onClick={() => switchToCustom(debouncedQuery.trim())}
            className={`py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "custom"
                ? "border-secondary text-secondary"
                : "border-transparent text-primary/60 hover:text-primary"
            }`}
          >
            {t("smartItemSearch.tabs.custom", "Custom")}
          </button>
        </div>
      )}

      {/* ── Search input (hidden in tabLayout Custom tab) ─────────────────── */}
      {(!tabLayout || activeTab === "import") && (
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 text-sm" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!tabLayout) setCustomMode(null);
                }}
                placeholder={t("smartItemSearch.searchPlaceholder", "e.g. Osprey Talon 33 Men's Backpack")}
                className="w-full pl-9 pr-8 py-2 border border-primary/30 rounded-lg text-primary bg-base-100 placeholder:text-primary/40 text-sm"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    if (!tabLayout) setCustomMode(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary/70"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              title={t("smartItemSearch.scanItem", "Scan item with camera")}
              className="flex-shrink-0 p-2 border border-primary/30 rounded-lg text-primary/50 hover:text-secondary hover:border-secondary/50 transition-colors"
            >
              <FiCamera size={16} />
            </button>
          </div>
          {!query && !tabLayout && (
            <p className="text-xs text-primary/35 mt-1.5 px-1">
              {t("smartItemSearch.searchHint", "Brand · Model · Size or variant")}
            </p>
          )}

          {/* Category / Subcategory / Brand dropdowns — tabLayout Import tab only */}
          {tabLayout && (
            <div className="mt-2 flex gap-1.5">
              <select
                value={categoryFilter || ""}
                onChange={(e) => setCategoryFilter(e.target.value || null)}
                className="flex-1 min-w-0 border border-primary/20 rounded-lg px-2 py-1.5 text-xs text-primary bg-base-100 cursor-pointer"
              >
                <option value="">{t("smartItemSearch.allCategories", "All Categories")}</option>
                {CATALOG_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {tCategory(t, cat)}
                  </option>
                ))}
              </select>
              <select
                value={subcategoryFilter || ""}
                onChange={(e) => setSubcategoryFilter(e.target.value || null)}
                disabled={!categoryFilter || !(CATALOG_SUBCATEGORIES[categoryFilter]?.length)}
                className="flex-1 min-w-0 border border-primary/20 rounded-lg px-2 py-1.5 text-xs text-primary bg-base-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">{t("smartItemSearch.allTypes", "All Types")}</option>
                {(CATALOG_SUBCATEGORIES[categoryFilter] || []).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <select
                value={brandFilter || ""}
                onChange={(e) => setBrandFilter(e.target.value || null)}
                disabled={brandOptions.length === 0}
                className="flex-1 min-w-0 border border-primary/20 rounded-lg px-2 py-1.5 text-xs text-primary bg-base-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">{t("smartItemSearch.allBrands", "All Brands")}</option>
                {brandOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile category chips (non-tabLayout only) ────────────────────── */}
      {!tabLayout && (
        <div className="sm:hidden px-5 pb-2 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() =>
                  setCategoryFilter(categoryFilter === chip.value ? null : chip.value)
                }
                className={`px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap border transition-colors flex-shrink-0 ${
                  categoryFilter === chip.value
                    ? "bg-secondary text-white border-secondary"
                    : "border-primary/20 text-primary/60 hover:border-secondary/50 hover:text-primary"
                }`}
              >
                {t(`smartItemSearch.chips.${chip.key}`, chip.key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Create row (non-tabLayout only) ──────────────────────────────── */}
      {!tabLayout && !customMode && !aiLoading && (
        <CreateRow
          query={debouncedQuery.trim()}
          onManual={() => {
            setCustomMode("manual");
            setCustomForm({
              name: debouncedQuery.trim(),
              brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "", imageUrl: "",
            });
          }}
          onAiSearch={handleAiSearch}
          aiLoading={aiLoading}
        />
      )}

      {/* ── Body: sidebar + results ──────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — desktop only, non-tabLayout */}
        {!tabLayout && (
          <div className="hidden sm:flex flex-col w-44 border-r border-primary/10 overflow-y-auto flex-shrink-0 py-2">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`text-left px-4 py-1.5 text-sm transition-colors border-l-2 ${
                !categoryFilter
                  ? "border-secondary bg-secondary/10 text-secondary font-medium"
                  : "border-transparent text-primary/60 hover:text-primary hover:bg-primary/5"
              }`}
            >
              {t("smartItemSearch.allCategories", "All Categories")}
            </button>
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() =>
                  setCategoryFilter(categoryFilter === chip.value ? null : chip.value)
                }
                className={`text-left px-4 py-1.5 text-sm transition-colors border-l-2 ${
                  categoryFilter === chip.value
                    ? "border-secondary bg-secondary/10 text-secondary font-medium"
                    : "border-transparent text-primary/60 hover:text-primary hover:bg-primary/5"
                }`}
              >
                {t(`smartItemSearch.sidebarCategories.${chip.key}`, chip.value)}
              </button>
            ))}
          </div>
        )}

        {/* Results area */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5">
          {showingCustomForm ? (
            <CustomForm
              form={customForm}
              onChange={setCustomForm}
              unitLabel={unitLabel}
            />
          ) : aiLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <FiLoader size={20} className="animate-spin text-secondary" />
              <p className="text-sm text-primary/50">
                {t("smartItemSearch.aiSearching", "Searching with AI...")}
              </p>
            </div>
          ) : hasNoResults ? (
            <NoResults
              query={debouncedQuery}
              onAiSearch={handleAiSearch}
              onManual={() => {
                setCustomMode("manual");
                setCustomForm({
                  name: debouncedQuery.trim(),
                  brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "", imageUrl: "",
                });
              }}
              onCreateCustom={tabLayout ? () => switchToCustom(debouncedQuery.trim()) : null}
              aiLoading={aiLoading}
            />
          ) : (
            <>
              {/* My Gear — shown in empty state (full list) or during search */}
              {showMyGear && (
                <>
                  {!hasSearchIntent && myGearLoading ? (
                    <div className="py-4"><Spinner centered /></div>
                  ) : !hasSearchIntent && filteredMyGear.length === 0 ? (
                    <p className="text-sm text-primary/40 text-center py-8">
                      {t("smartItemSearch.noGearYet", "No gear yet. Search the catalog or describe an item above.")}
                    </p>
                  ) : filteredMyGear.length > 0 ? (
                    <ResultSection
                      title={t("smartItemSearch.myGear", "My Gear")}
                      items={filteredMyGear}
                      type="myGear"
                      myGearSelected={myGearSelected}
                      catalogSelected={catalogSelected}
                      onToggleMyGear={toggleMyGear}
                      onToggleCatalog={toggleCatalog}
                      multiSelect={multiSelect}
                      existingGlobalIds={existingGlobalIds}
                    />
                  ) : null}
                </>
              )}

              {/* Catalog — shown when searching or category filter active */}
              {hasSearchIntent && (
                <ResultSection
                  title={t("smartItemSearch.fromCatalog", "From Catalog")}
                  items={catalogResults}
                  type="catalog"
                  myGearSelected={myGearSelected}
                  catalogSelected={catalogSelected}
                  onToggleMyGear={toggleMyGear}
                  onToggleCatalog={toggleCatalog}
                  onViewCatalogDetails={handleViewCatalogDetails}
                  multiSelect={multiSelect}
                  existingGlobalIds={existingGlobalIds}
                  loading={catalogLoading}
                />
              )}

              {/* Empty state for library mode (no My Gear shown) */}
              {!showMyGear && !hasSearchIntent && (
                <p className="text-sm text-primary/40 text-center py-8">
                  {t("smartItemSearch.browseHint", "Search the catalog above, or tap a category to browse.")}
                </p>
              )}

              {/* Persistent custom item escape hatch — always visible in Import tab */}
              {tabLayout && (
                <div className="border-t border-primary/8 mt-2 pt-2 pb-1">
                  <button
                    type="button"
                    onClick={() => switchToCustom(debouncedQuery.trim())}
                    className="flex items-center gap-1.5 text-sm text-primary/40 hover:text-primary/70 transition-colors py-1"
                  >
                    <FiPlus size={13} className="flex-shrink-0" />
                    {debouncedQuery.trim()
                      ? `${t("smartItemSearch.createCustomItem", 'Create "{query}" as a custom item').replace("{query}", debouncedQuery.trim())}`
                      : t("smartItemSearch.createCustomItemBlank", "Create a custom item")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Request a Gear Item modal */}
      {showRequestForm && createPortal(
        <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-end sm:items-center justify-center z-[70]">
          <form
            onSubmit={handleSubmitRequest}
            className="bg-white sm:rounded-lg shadow-2xl w-full sm:mx-4 sm:max-w-md px-6 py-6 flex flex-col gap-4"
          >
            <h3 className="text-base font-semibold text-primary">Request a Gear Item</h3>
            <p className="text-sm text-primary/60 -mt-2">
              Can't find what you're looking for? Let us know and we'll look into adding it.
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-primary/70 mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Nemo Tensor"
                  value={requestForm.name}
                  onChange={e => setRequestForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-primary/20 rounded px-3 py-1.5 text-sm text-primary"
                  required
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-primary/70 mb-1">Brand *</label>
                <input
                  type="text"
                  placeholder="e.g. Nemo"
                  value={requestForm.brand}
                  onChange={e => setRequestForm(p => ({ ...p, brand: e.target.value }))}
                  className="w-full border border-primary/20 rounded px-3 py-1.5 text-sm text-primary"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary/70 mb-1">Link (optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={requestForm.link}
                onChange={e => setRequestForm(p => ({ ...p, link: e.target.value }))}
                className="w-full border border-primary/20 rounded px-3 py-1.5 text-sm text-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowRequestForm(false); setRequestForm({ name: "", brand: "", link: "" }); }}
                className="px-3 py-1.5 rounded bg-neutralAlt hover:bg-neutralAlt/90 text-primary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={requestSending || !requestForm.name.trim() || !requestForm.brand.trim()}
                className="px-3 py-1.5 rounded bg-secondary text-white text-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {requestSending && <FiLoader size={12} className="animate-spin" />}
                Send Request
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-primary/10 flex-shrink-0">
        <button
          type="button"
          onClick={() => setShowRequestForm(v => !v)}
          className="text-xs text-primary/50 hover:text-primary/80 underline underline-offset-2"
        >
          Request a Gear Item
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-3 py-1.5 rounded bg-neutralAlt hover:bg-neutralAlt/90 text-primary text-sm"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || confirming}
            className={`px-3 py-1.5 rounded bg-secondary text-white text-sm flex items-center gap-1.5 ${
              !canConfirm || confirming
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-secondary/80"
            }`}
          >
            {confirming && <FiLoader size={12} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>

      {/* Catalog item preview modal */}
      <CatalogItemPreviewModal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        item={previewItem}
        loading={previewLoading}
        error={previewError}
        onImport={handlePreviewImport}
        importing={previewImporting}
      />

      {/* Photo scan modal */}
      {showScanModal && (
        <PhotoScanModal
          onClose={() => setShowScanModal(false)}
          onResult={(scanData) => {
            setShowScanModal(false);
            setCustomMode("ai");
            if (tabLayout) setActiveTab("custom");
            setCustomForm({
              name: scanData.name || "",
              brand: scanData.brand || "",
              catalogCategory: scanData.category || "",
              itemType: scanData.itemType || "",
              weight: scanData.weightGrams != null ? formatInput(scanData.weightGrams) : "",
              description: scanData.description || "",
              link: "",
              imageUrl: scanData.imageUrl || "",
            });
          }}
        />
      )}
    </div>
  );
}
