// src/components/SmartItemSearch.jsx
// Unified item search: My Gear + Catalog + AI fill-in fallback.
// Drop this inside any modal/drawer shell — it manages its own search state.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiSearch, FiX, FiPlus, FiLoader, FiCamera } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import { CATALOG_CATEGORIES } from "../config/catalogTaxonomy";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import Spinner from "./ui/Spinner";
import LinkInput from "./LinkInput";
import CatalogItemPreviewModal from "./CatalogItemPreviewModal";
import PhotoScanModal from "./PhotoScanModal";
import useAuth from "../hooks/useAuth";

// Short labels for horizontal chip row
const CHIPS = [
  { label: "Sleep", value: "Sleep System" },
  { label: "Shelter", value: "Shelter" },
  { label: "Packs", value: "Backpacks & Bags" },
  { label: "Clothing", value: "Unisex Clothing" },
  { label: "Footwear", value: "Footwear" },
  { label: "Kitchen", value: "Kitchen & Cooking" },
  { label: "Hydration", value: "Hydration" },
  { label: "Electronics", value: "Electronics & Power" },
  { label: "Tools", value: "Accessories & Tools" },
  { label: "Health", value: "Health & Hygiene" },
  { label: "Navigation", value: "Navigation & Planning" },
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
      {/* Checkbox/radio — clicking this area toggles selection */}
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
      {/* Name/brand — clicking opens details if handler provided */}
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
                badge={disabled ? "Added" : null}
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
function NoResults({ query, onAiSearch, onManual, aiLoading }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
      <p className="text-sm text-primary/50 text-center">
        No results for{" "}
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
        {aiLoading ? "Searching with AI..." : "Fill with AI"}
      </button>
      {!aiLoading && (
        <p className="text-xs text-primary/35 text-center">
          Tip: include brand, model &amp; size for better results
        </p>
      )}
      <button
        onClick={onManual}
        className="flex items-center gap-1.5 text-sm text-primary/50 hover:text-primary transition-colors"
      >
        <FiPlus size={14} />
        Add manually
      </button>
    </div>
  );
}

// ── Create row (shown at bottom of results when a search is active) ───────────
function CreateRow({ query, onManual, onAiSearch, aiLoading }) {
  const label = "Add item manually";
  return (
    <div className="flex items-center gap-2 px-5 py-2 border-b border-primary/10 flex-shrink-0">
      <button
        type="button"
        onClick={onManual}
        className="flex items-center gap-1.5 text-sm text-primary/50 hover:text-primary transition-colors"
      >
        <FiPlus size={13} className="flex-shrink-0" />
        {label}
      </button>
      <span className="text-primary/20 text-xs">·</span>
      <button
        type="button"
        onClick={onAiSearch}
        disabled={aiLoading || !query}
        className="flex items-center gap-1 text-sm text-secondary/70 hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title={!query ? "Type a name first to use AI fill" : undefined}
      >
        {aiLoading ? (
          <FiLoader size={12} className="animate-spin" />
        ) : (
          <span className="text-xs">✨</span>
        )}
        {aiLoading ? "Searching…" : "Fill with AI"}
      </button>
    </div>
  );
}

// ── Custom / edit form ────────────────────────────────────────────────────────
function CustomForm({ form, onChange, unitLabel }) {
  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-3 py-2 pb-4">
        {/* Row 1: Name + Brand */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Name <span className="text-error">*</span>
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
            <label className="block text-sm font-medium text-primary mb-1">Brand</label>
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
            <label className="block text-sm font-medium text-primary mb-1">Category</label>
            <select
              value={form.catalogCategory}
              onChange={(e) => onChange({ ...form, catalogCategory: e.target.value })}
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
            >
              <option value="">Uncategorized</option>
              {CATALOG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Item type</label>
            <input
              type="text"
              value={form.itemType}
              onChange={(e) => onChange({ ...form, itemType: e.target.value })}
              placeholder="e.g. Canister Stove"
              className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
            />
          </div>
        </div>
        {/* Row 3: Weight + Link */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Weight ({unitLabel})
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
            label="Link"
            placeholder="https://"
            required={false}
          />
        </div>
        {/* Image URL - full width */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Image URL</label>
          <input
            type="text"
            value={form.imageUrl}
            onChange={(e) => onChange({ ...form, imageUrl: e.target.value })}
            placeholder="example.com/image.jpg"
            className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm"
          />
        </div>
        {/* Description - full width */}
        <div>
          <label className="block text-sm font-medium text-primary mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="w-full border border-base-300 rounded-lg px-3 py-2 text-primary bg-base-100 text-sm resize-none h-24"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
/**
 * Props:
 *   multiSelect      boolean  — true for add-to-list/library; false for swap
 *   showMyGear       boolean  — false for library-only contexts (AddGearDrawer, GlobalItemModal)
 *   excludeGlobalItemId string — for swap: exclude this globalItem from My Gear results
 *   existingGlobalIds Set     — items already in list (shown as disabled/Added)
 *   onConfirm        async fn — called with { source, globalItems?, catalogIds?, fields? }
 *   onClose          fn
 */
export default function SmartItemSearch({
  multiSelect = true,
  showMyGear = true,
  excludeGlobalItemId = null,
  existingGlobalIds = new Set(),
  onConfirm,
  onClose,
}) {
  const unit = useUnit();
  const { parseInput, formatInput, unitLabel } = useWeightInput(unit);
  const { user } = useAuth();

  // Search
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(null);
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

  const handleViewCatalogDetails = async (item) => {
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { data } = await api.get(`/catalog/items/${item._id}`);
      setPreviewItem(data);
    } catch {
      setPreviewError("Failed to load item details.");
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

  // Catalog search
  useEffect(() => {
    if (!debouncedQuery && !categoryFilter) {
      setCatalogResults([]);
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    const params = {};
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
    if (categoryFilter) params.category = categoryFilter;
    api
      .get("/catalog/items", { params })
      .then(({ data }) => setCatalogResults(data || []))
      .catch(() => setCatalogResults([]))
      .finally(() => setCatalogLoading(false));
  }, [debouncedQuery, categoryFilter]);

  // Reset AI state when query changes
  useEffect(() => {
    if (customMode !== "manual") setCustomMode(null);
  }, [debouncedQuery, categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!debouncedQuery) return items;
    const tokens = normalize(debouncedQuery).split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const hay = normalize(
        [item.name, item.brand, item.itemType, item.description].filter(Boolean).join(" "),
      );
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [myGearItems, debouncedQuery, excludeGlobalItemId, showMyGear, categoryFilter]);

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
    } catch {
      toast.error("AI search failed. Try adding manually.");
    } finally {
      setAiLoading(false);
    }
  };

  // Footer confirm
  const handleConfirm = async () => {
    if (confirming) return;

    if (customMode) {
      if (!customForm.name.trim()) {
        toast.error("Name is required");
        return;
      }
      let weightGrams;
      if (customForm.weight !== "") {
        weightGrams = parseInput(customForm.weight);
        if (weightGrams == null || weightGrams < 0) {
          toast.error("Invalid weight");
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
  const canConfirm = customMode
    ? customForm.name.trim().length > 0
    : totalSelected > 0;

  const confirmLabel = confirming
    ? "Saving..."
    : customMode
      ? "Create and Add"
      : myGearSelected.size > 0
        ? multiSelect && myGearSelected.size > 1
          ? `Add (${myGearSelected.size})`
          : "Add"
        : catalogSelected.size > 0
          ? multiSelect && catalogSelected.size > 1
            ? `Import & Add (${catalogSelected.size})`
            : "Import & Add"
          : "Add";

  const hasSearchIntent = debouncedQuery.trim() || categoryFilter;
  const hasNoResults =
    hasSearchIntent &&
    !catalogLoading &&
    !aiLoading &&
    filteredMyGear.length === 0 &&
    catalogResults.length === 0 &&
    !customMode;

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
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
                setCustomMode(null);
              }}
              placeholder="e.g. Osprey Talon 33 Men's Backpack"
              className="w-full pl-9 pr-8 py-2 border border-primary/30 rounded-lg text-primary bg-base-100 placeholder:text-primary/40 text-sm"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setCustomMode(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary/70"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              title="Scan item with camera"
              className="flex-shrink-0 p-2 border border-primary/30 rounded-lg text-primary/50 hover:text-secondary hover:border-secondary/50 transition-colors"
            >
              <FiCamera size={16} />
            </button>
          )}
        </div>
        {!query && (
          <p className="text-xs text-primary/35 mt-1.5 px-1">Brand · Model · Size or variant</p>
        )}
      </div>

      {/* Mobile category chips */}
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
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Create row — always visible, above results */}
      {!customMode && !aiLoading && (
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

      {/* Body: sidebar + results */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — desktop only */}
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
            All Categories
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
              {chip.value}
            </button>
          ))}
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5">
        {customMode ? (
          <CustomForm
            form={customForm}
            onChange={setCustomForm}
            unitLabel={unitLabel}
          />
        ) : aiLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <FiLoader size={20} className="animate-spin text-secondary" />
            <p className="text-sm text-primary/50">Searching with AI...</p>
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
                    No gear yet. Search the catalog or describe an item above.
                  </p>
                ) : filteredMyGear.length > 0 ? (
                  <ResultSection
                    title={hasSearchIntent ? "My Gear" : "My Gear"}
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

            {/* Catalog — shown when searching or category chip active */}
            {hasSearchIntent && (
              <ResultSection
                title="From Catalog"
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
                Search the catalog above, or tap a category to browse.
              </p>
            )}

          </>
        )}
      </div>
      </div>{/* end sidebar+results wrapper */}

      {/* Footer */}
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-primary/10 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-3 py-1.5 rounded bg-neutralAlt hover:bg-neutralAlt/90 text-primary text-sm"
          >
            Cancel
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
