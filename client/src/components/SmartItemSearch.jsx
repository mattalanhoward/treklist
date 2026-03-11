// src/components/SmartItemSearch.jsx
// Unified item search: My Gear + Catalog + AI fill-in fallback.
// Drop this inside any modal/drawer shell — it manages its own search state.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiSearch, FiX, FiAlertCircle, FiPlus, FiLoader } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import { CATALOG_CATEGORIES } from "../config/catalogTaxonomy";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import Spinner from "./ui/Spinner";
import LinkInput from "./LinkInput";

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
function ItemRow({ item, selected, onToggle, multiSelect, disabled, badge, subLabel, priceLabel }) {
  return (
    <li
      onClick={() => !disabled && onToggle(String(item._id))}
      className={`flex items-center px-3 py-2 rounded border cursor-pointer transition-colors ${
        disabled
          ? "border-primary/10 opacity-50 cursor-default"
          : selected
            ? "border-secondary/40 bg-secondary/10"
            : "border-primary/20 hover:bg-primary/5"
      }`}
    >
      <input
        type={multiSelect ? "checkbox" : "radio"}
        checked={selected}
        onChange={() => {}}
        disabled={disabled}
        className="mr-3 h-4 w-4 text-secondary border-primary rounded flex-shrink-0 pointer-events-none"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate">
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
function ResultSection({ title, items, type, myGearSelected, catalogSelected, onToggleMyGear, onToggleCatalog, multiSelect, existingGlobalIds, loading }) {
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

// ── AI confirm card (Option B) ─────────────────────────────────────────────────
function AiCard({ suggestion, onConfirm, onEdit, onDismiss, confirming }) {
  return (
    <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4 my-2">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-secondary font-medium mb-1.5">✨ AI Suggestion</p>
          <p className="text-sm font-semibold text-primary">
            {suggestion.brand && <span className="mr-1">{suggestion.brand}</span>}
            {suggestion.name}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {suggestion.weightGrams != null && (
              <span className="text-xs text-primary/60">{suggestion.weightGrams}g</span>
            )}
            {suggestion.category && (
              <span className="text-xs text-primary/60">{suggestion.category}</span>
            )}
          </div>
          {suggestion.description && (
            <p className="text-xs text-primary/50 mt-1.5 line-clamp-2">{suggestion.description}</p>
          )}
        </div>
        <div className="flex items-start gap-2 ml-3 flex-shrink-0">
          {suggestion.imageUrl && (
            <img
              src={suggestion.imageUrl}
              alt={suggestion.name}
              className="w-16 h-16 object-contain rounded bg-white border border-primary/10"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <button
            onClick={onDismiss}
            className="text-primary/30 hover:text-primary/60 mt-0.5"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
        <FiAlertCircle size={11} className="text-amber-500 flex-shrink-0" />
        <span className="text-xs text-amber-600 flex-1">Please verify before saving</span>
        <button
          onClick={onEdit}
          disabled={confirming}
          className="px-2.5 py-1 text-xs border border-primary/20 rounded text-primary hover:bg-primary/5 disabled:opacity-50"
        >
          Edit
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="px-2.5 py-1 text-xs bg-secondary text-white rounded hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-1"
        >
          {confirming ? <FiLoader size={11} className="animate-spin" /> : null}
          Add ✓
        </button>
      </div>
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

// ── Custom / edit form ────────────────────────────────────────────────────────
function CustomForm({ form, onChange, unitLabel }) {
  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-2 py-1 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              autoFocus
              className="w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => onChange({ ...form, brand: e.target.value })}
              className="w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Category</label>
            <select
              value={form.catalogCategory}
              onChange={(e) => onChange({ ...form, catalogCategory: e.target.value })}
              className="w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-sm"
            >
              <option value="">Uncategorized</option>
              {CATALOG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">Item Type</label>
            <input
              type="text"
              value={form.itemType}
              onChange={(e) => onChange({ ...form, itemType: e.target.value })}
              placeholder="e.g. Canister Stove"
              className="w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary mb-1">
              Weight ({unitLabel})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => onChange({ ...form, weight: e.target.value })}
              placeholder={unitLabel === "g" ? "0" : "0.0"}
              className="w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-primary mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="w-full border border-primary/30 rounded px-2 py-1 text-primary bg-base-100 text-sm resize-none h-14"
          />
        </div>
        <LinkInput
          value={form.link}
          onChange={(v) => onChange({ ...form, link: v })}
          label="Link"
          placeholder="https://"
          required={false}
          className="text-sm"
        />
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
  const [aiCard, setAiCard] = useState(null);

  // Custom form (AI edit or manual creation)
  const [customMode, setCustomMode] = useState(null); // null | 'ai' | 'manual'
  const [customForm, setCustomForm] = useState({
    name: "", brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "",
  });

  // Submitting state for confirm button
  const [confirming, setConfirming] = useState(false);

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
    setAiCard(null);
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
    if (!debouncedQuery) return items;
    const tokens = normalize(debouncedQuery).split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const hay = normalize(
        [item.name, item.brand, item.itemType].filter(Boolean).join(" "),
      );
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [myGearItems, debouncedQuery, excludeGlobalItemId, showMyGear]);

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

  // AI fill
  const handleAiSearch = async () => {
    if (!query.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/fill-item", { query: query.trim() });
      setAiCard(data);
    } catch {
      toast.error("AI search failed. Try adding manually.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiConfirm = async () => {
    if (!aiCard || confirming) return;
    setConfirming(true);
    try {
      await onConfirm({
        source: "newItem",
        fields: {
          name: aiCard.name,
          brand: aiCard.brand || "",
          catalogCategory: aiCard.category || "",
          itemType: aiCard.itemType || "",
          weight: aiCard.weightGrams ?? null,
          description: aiCard.description || "",
          link: aiCard.link || "",
          imageUrl: aiCard.imageUrl || "",
        },
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleAiEdit = () => {
    setCustomMode("ai");
    setCustomForm({
      name: aiCard.name || "",
      brand: aiCard.brand || "",
      catalogCategory: aiCard.category || "",
      // Convert grams to display unit for the form
      itemType: aiCard.itemType || "",
      weight: aiCard.weightGrams != null ? formatInput(aiCard.weightGrams) : "",
      description: aiCard.description || "",
      link: aiCard.link || "",
    });
    setAiCard(null);
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
    !aiCard &&
    !customMode;

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-5 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
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
                setAiCard(null);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary/70"
            >
              <FiX size={14} />
            </button>
          )}
        </div>
        {!query && (
          <p className="text-xs text-primary/35 mt-1.5 px-1">Brand · Model · Size or variant</p>
        )}
      </div>

      {/* Category chips */}
      <div className="px-5 pb-2 flex-shrink-0">
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
        ) : aiCard ? (
          <AiCard
            suggestion={aiCard}
            onConfirm={handleAiConfirm}
            onEdit={handleAiEdit}
            onDismiss={() => setAiCard(null)}
            confirming={confirming}
          />
        ) : hasNoResults ? (
          <NoResults
            query={debouncedQuery}
            onAiSearch={handleAiSearch}
            onManual={() => {
              setCustomMode("manual");
              setCustomForm({
                name: debouncedQuery.trim(),
                brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "",
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

      {/* Footer — hidden while AI card is showing (it has its own buttons) */}
      {!aiCard && (
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
      )}
    </div>
  );
}
