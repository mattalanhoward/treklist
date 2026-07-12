// src/components/SmartItemSearch.jsx
// Unified item search: My Gear + Catalog + AI fill-in fallback.
// Drop this inside any modal/drawer shell — it manages its own search state.
//
// Desktop two-pane (twoPane): result list on the left, live preview pane on the
// right. Click a row = preview (pane follows); the checkbox is the only thing
// that batches. Keyboard: ↑/↓ move the focused row, Space toggles its checkbox,
// Enter commits the batch.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import CatalogPreviewPane from "./CatalogPreviewPane";
import { shortLabel } from "./VariantSelector";
import PhotoScanModal from "./PhotoScanModal";
import useStagedMessage from "../hooks/useStagedMessage";

// key = translation lookup key; value = API filter value (must stay English)
const CHIPS = [
  { key: "sleep",          value: "Sleep System" },
  { key: "shelter",        value: "Shelter" },
  { key: "packs",          value: "Backpacks & Bags" },
  { key: "mensClothing",   value: "Men's Clothing" },
  { key: "womensClothing", value: "Women's Clothing" },
  { key: "clothing",       value: "Unisex Clothing" },
  { key: "footwear",       value: "Footwear" },
  { key: "kitchen",        value: "Kitchen & Cooking" },
  { key: "hydration",      value: "Hydration" },
  { key: "electronics",    value: "Electronics & Power" },
  { key: "tools",          value: "Accessories & Tools" },
  { key: "health",         value: "Health & Hygiene" },
  { key: "navigation",     value: "Navigation & Planning" },
  { key: "travel",         value: "Travel" },
];

function isUrl(s) {
  return /^https?:\/\//i.test((s || "").trim());
}

function normalize(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// ── Item row (two-pane contract: brand eyebrow · name · one spec · weight hero) ──
function ItemRow({
  item,
  source,
  selected,
  focused,
  onToggle,
  onActivate,
  multiSelect,
  addedBadge,
  specLabel,
  weightLabel,
  variantLabel,
  priceLabel,
  variantAxis,
  selectedVariantValue,
  hasVariantSelection,
  hasMultiAxisVariants,
  variantExpanded,
  onToggleVariantExpand,
  onPickVariant,
}) {
  const { t } = useTranslation("common");
  const id = String(item._id);
  const rowRef = useRef(null);
  const thumb = Array.isArray(item.imageUrls) ? item.imageUrls[0] : null;

  // Clicking outside the row while the variant strip is open (without picking a
  // value) collapses it back to the summary pill.
  useEffect(() => {
    if (!variantExpanded) return;
    const handleClickOutside = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        onToggleVariantExpand(id);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [variantExpanded, id, onToggleVariantExpand]);

  return (
    <li
      ref={rowRef}
      onClick={() => onActivate(source, item)}
      className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors border-l-[3px] ${
        focused
          ? "border-primary/20 border-l-secondary bg-secondary/5"
          : selected
            ? "border-secondary/40 border-l-transparent bg-secondary/10"
            : "border-primary/15 border-l-transparent hover:bg-primary/5"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id);
        }}
        className="flex-shrink-0 flex items-center cursor-pointer"
        tabIndex={-1}
        aria-label={t("smartItemSearch.selectRow", "Select {{name}}", { name: item.name })}
      >
        <input
          type={multiSelect ? "checkbox" : "radio"}
          checked={selected}
          onChange={() => {}}
          className="h-4 w-4 text-secondary border-primary rounded pointer-events-none"
        />
      </button>

      {/* Thumbnail */}
      <div className="h-8 w-8 flex-shrink-0 rounded border border-primary/15 bg-white overflow-hidden flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-primary/20 text-[10px]">—</span>
        )}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        {item.brand && (
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-primary/45 leading-tight truncate">
            {item.brand}
          </div>
        )}
        <div className="text-sm font-medium text-primary truncate">{item.name}</div>
        {(specLabel || variantLabel || variantAxis || hasMultiAxisVariants) && (
          <div className="flex items-center gap-2 text-xs text-primary/50 mt-0.5">
            {specLabel && <span className="truncate">{specLabel}</span>}
            {variantLabel && (
              <span
                className="ml-auto max-w-full truncate rounded-full bg-secondary/10 text-secondary px-2 py-0.5 text-[11px] font-medium"
                title={variantLabel}
              >
                {variantLabel}
              </span>
            )}
            {hasMultiAxisVariants && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate(source, item);
                }}
                className="ml-auto max-w-full truncate rounded-full border border-secondary/30 px-2 py-0.5 !text-[11px] font-medium text-secondary hover:bg-secondary/10 transition-colors"
                title={t("smartItemSearch.multipleVariants", "Multiple variants")}
              >
                {t("smartItemSearch.multipleVariants", "Multiple variants")}
              </button>
            )}
            {variantAxis && (
              <div className="ml-auto flex min-w-0 items-center gap-1">
                {!variantExpanded && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVariantExpand(id);
                    }}
                    className={`max-w-full truncate rounded-full px-2 py-0.5 !text-[11px] font-medium transition-colors ${
                      hasVariantSelection
                        ? "bg-secondary/10 text-secondary hover:bg-secondary/20"
                        : "border border-secondary/30 text-secondary hover:bg-secondary/10"
                    }`}
                    title={hasVariantSelection ? selectedVariantValue : t("smartItemSearch.chooseVariant", "Variants")}
                  >
                    {hasVariantSelection ? shortLabel(selectedVariantValue) : t("smartItemSearch.chooseVariant", "Variants")}
                  </button>
                )}
                <div
                  className={`grid min-w-0 transition-[grid-template-columns] duration-200 ease-in-out ${
                    variantExpanded ? "grid-cols-[1fr]" : "grid-cols-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden min-w-0">
                    <div
                      className={`flex items-center gap-1 overflow-x-auto transition-opacity duration-150 ease-in-out ${
                        variantExpanded ? "opacity-100 delay-100" : "opacity-0"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {variantAxis.values.map((val) => {
                        const isSel = val === selectedVariantValue;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPickVariant(id, val);
                            }}
                            title={val}
                            aria-pressed={isSel}
                            className={`flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 !text-[11px] font-medium border transition-colors ${
                              isSel
                                ? "bg-secondary text-white border-secondary"
                                : "border-secondary/30 text-secondary hover:bg-secondary/10"
                            }`}
                          >
                            {shortLabel(val)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weight hero + badge/price */}
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        {weightLabel && (
          <span className="text-sm font-semibold text-primary tabular-nums whitespace-nowrap">
            {weightLabel}
          </span>
        )}
        {priceLabel && <span className="text-[11px] text-secondary font-medium">{priceLabel}</span>}
        {addedBadge && (
          <span className="text-[10.5px] text-primary/45 italic whitespace-nowrap">{addedBadge}</span>
        )}
      </div>
    </li>
  );
}

// ── AI lookup progress ────────────────────────────────────────────────────────
function AiSearchProgress({ urlQuery }) {
  const { t } = useTranslation("common");
  const steps = urlQuery
    ? [
        t("smartItemSearch.aiProgress.reading", "Reading product page…"),
        t("smartItemSearch.aiProgress.identifying", "Identifying the item…"),
        t("smartItemSearch.aiProgress.matching", "Matching against the catalog…"),
      ]
    : [
        t("smartItemSearch.aiProgress.identifying", "Identifying the item…"),
        t("smartItemSearch.aiProgress.matching", "Matching against the catalog…"),
      ];
  const msg = useStagedMessage(steps, 2500);
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <FiLoader size={20} className="animate-spin text-secondary" />
      <p className="text-sm text-primary/50">{msg}</p>
    </div>
  );
}

// ── Section (My Gear or Catalog) ──────────────────────────────────────────────
function ResultSection({
  title,
  items,
  type,
  myGearSelected,
  catalogSelected,
  focused,
  onToggleMyGear,
  onToggleCatalog,
  onActivate,
  multiSelect,
  existingGlobalIds,
  existingProductIds,
  loading,
  fmtWeight,
  catalogVariantSelections,
  expandedVariantRowId,
  onToggleVariantExpand,
  onPickVariant,
}) {
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
          const isFocused = focused && focused.source === type && focused.id === id;
          if (type === "myGear") {
            // Added ≠ locked: keep already-in-list items checkable, just badge them.
            const added = existingGlobalIds?.has(id);
            return (
              <ItemRow
                key={id}
                item={item}
                source="myGear"
                selected={myGearSelected.has(id)}
                focused={isFocused}
                onToggle={onToggleMyGear}
                onActivate={onActivate}
                multiSelect={multiSelect}
                addedBadge={added ? t("smartItemSearch.inList", "Added") : null}
                specLabel={item.itemType || null}
                weightLabel={fmtWeight(item.weight ?? item.weightGrams)}
                variantLabel={item.variantKey || null}
              />
            );
          }
          const offer = item.offers?.[0];
          const priceLabel = offer?.price
            ? `$${offer.price} · ${offer.merchantName || ""}`.replace(/ · $/, "")
            : null;
          const added = existingProductIds?.has(id);
          const axis =
            item.variantAxes?.length === 1 && item.variantAxes[0].values?.length > 1
              ? item.variantAxes[0]
              : null;
          const hasMultiAxisVariants = !axis && (item.variantAxes?.length || 0) > 1;
          const hasVariantSelection = Boolean(axis && catalogVariantSelections?.[id]);
          const selectedVariantValue = axis
            ? catalogVariantSelections?.[id] || item.defaultVariantKey || axis.values[0]
            : null;
          return (
            <ItemRow
              key={id}
              item={item}
              source="catalog"
              selected={catalogSelected.has(id)}
              focused={isFocused}
              onToggle={onToggleCatalog}
              onActivate={(src, it) =>
                onActivate(src, it, hasVariantSelection ? { [axis.name]: selectedVariantValue } : null)
              }
              multiSelect={multiSelect}
              addedBadge={added ? t("smartItemSearch.inMyGear", "In my gear") : null}
              specLabel={item.itemType || item.subcategory || null}
              weightLabel={fmtWeight(item.weightGrams)}
              priceLabel={priceLabel}
              variantAxis={axis}
              selectedVariantValue={selectedVariantValue}
              hasVariantSelection={hasVariantSelection}
              hasMultiAxisVariants={hasMultiAxisVariants}
              variantExpanded={expandedVariantRowId === id}
              onToggleVariantExpand={onToggleVariantExpand}
              onPickVariant={onPickVariant}
            />
          );
        })}
      </ul>
    </div>
  );
}

// ── No results view ───────────────────────────────────────────────────────────
function NoResults({ query, onCreate, aiLoading }) {
  const { t } = useTranslation("common");
  const queryIsUrl = isUrl(query);
  const truncated = query.length > 50 ? query.slice(0, 50) + "…" : query;
  if (queryIsUrl) return null;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
      <p className="text-sm text-primary/50 text-center">
        {t("smartItemSearch.noResultsFor", "No results for")}{" "}
        <span className="font-medium text-primary">"{truncated}"</span>
      </p>
      <button
        onClick={onCreate}
        disabled={aiLoading}
        className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary text-sm rounded-lg border border-secondary/30 hover:bg-secondary/20 disabled:opacity-50 transition-colors"
      >
        {aiLoading ? <FiLoader size={14} className="animate-spin" /> : <FiPlus size={14} />}
        {t("smartItemSearch.createCustomItem", 'Create "{query}" as a custom item').replace("{query}", truncated)}
      </button>
    </div>
  );
}

// ── Create row (always visible above results, non-tabLayout mode only) ────────
function CreateRow({ query, onCreate, onManual, aiLoading }) {
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
        onClick={onCreate}
        disabled={aiLoading || !query}
        className="flex items-center gap-1 text-sm text-secondary/70 hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title={!query ? t("smartItemSearch.aiTypeFirst", "Type a name first to use AI fill") : undefined}
      >
        {aiLoading ? <FiLoader size={12} className="animate-spin" /> : <span className="text-xs">✨</span>}
        {aiLoading ? t("smartItemSearch.aiSearchingShort", "Searching…") : t("smartItemSearch.aiFill", "Fill with AI")}
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
 *   twoPane              boolean  — desktop master–detail (result list + preview pane)
 *   destinationLabel     string   — echoed in the commit button ("Add 2 to Hiking")
 *   excludeGlobalItemId  string   — for swap: exclude this globalItem from My Gear results
 *   existingGlobalIds    Set      — items already in list (badged, still checkable)
 *   onConfirm            async fn — called with { source, globalItems?, catalogIds?, fields?, variantSelections?, sizeUnset? }
 *   onClose              fn
 *   tabLayout            boolean  — use tabbed Import/Custom layout (AddGearItemModal)
 */
export default function SmartItemSearch({
  multiSelect = true,
  showMyGear = true,
  twoPane = false,
  destinationLabel = null,
  excludeGlobalItemId = null,
  existingGlobalIds = new Set(),
  existingProductIds,
  onConfirm,
  onClose,
  tabLayout = false,
  confirmLabels = {},
}) {
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { parseInput, formatInput, unitLabel } = useWeightInput(unit);

  const fmtWeight = useCallback(
    (grams) => (typeof grams === "number" ? `${formatInput(grams)} ${unitLabel}` : null),
    [formatInput, unitLabel],
  );

  const searchPlaceholders = useMemo(() => [
    "Osprey Exos 48",
    "https://atompacks.co.uk/collections/the-atom/products/the-atom-re30-black",
    t("smartItemSearch.placeholders.tent", "Tent"),
    "Nemo Tensor Sleeping Pad",
    "https://durstongear.com/products/wapta-30-ultralight-backpack",
    t("smartItemSearch.placeholders.trekkingPoles", "Trekking Poles"),
    "Black Diamond Distance Carbon Z",
    "https://gossamergear.com/products/mariposa-60",
    "Decathlon 8858286",
  ], [t]);

  // Search
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState(null);
  const [brandFilter, setBrandFilter] = useState(null);
  const [brandOptions, setBrandOptions] = useState([]);
  const searchRef = useRef(null);
  const lastAiFillRef = useRef(null); // { query, data } from the last AI fill

  // Animated placeholder
  const [phIndex, setPhIndex] = useState(0);
  const [phVisible, setPhVisible] = useState(true);

  useEffect(() => {
    if (query) return;
    const id = setInterval(() => {
      setPhVisible(false);
      setTimeout(() => {
        setPhIndex((i) => (i + 1) % searchPlaceholders.length);
        setPhVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(id);
  }, [query]);

  // Desktop vs mobile (drives two-pane vs stacked preview modal)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const h = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const usePane = twoPane && isDesktop;

  // My Gear
  const [myGearItems, setMyGearItems] = useState([]);
  const [myGearLoading, setMyGearLoading] = useState(showMyGear);

  // Catalog
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(null);
  const [catalogAllTotal, setCatalogAllTotal] = useState(null);

  // Selection
  const [myGearSelected, setMyGearSelected] = useState(new Set());
  const [catalogSelected, setCatalogSelected] = useState(new Set());

  // Explicit variant picks (row quick-pick or pane) — { [catalogItemId]: value }
  const [catalogVariantSelections, setCatalogVariantSelections] = useState({});
  const [expandedVariantRowId, setExpandedVariantRowId] = useState(null);

  // Focused row for the preview pane — { source: 'myGear'|'catalog', id }
  const [focused, setFocused] = useState(null);
  const [paneFull, setPaneFull] = useState(null);
  const [paneLoading, setPaneLoading] = useState(false);
  const [paneError, setPaneError] = useState(null);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);

  // Custom form (AI edit or manual creation)
  const [customMode, setCustomMode] = useState(null); // null | 'ai' | 'manual'
  const [customForm, setCustomForm] = useState({
    name: "", brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "", imageUrl: "",
  });

  const [confirming, setConfirming] = useState(false);

  // Photo scan modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFile, setScanFile] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const closeScanModal = () => {
    setShowScanModal(false);
    setScanFile(null);
  };
  const openScanWithFile = (file) => {
    if (!file) return;
    setScanFile(file);
    setShowScanModal(true);
  };

  // Stacked catalog preview modal (mobile / non-two-pane row activation)
  const [previewItem, setPreviewItem] = useState(null);
  const [previewInitialOptions, setPreviewInitialOptions] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewImporting, setPreviewImporting] = useState(false);

  // My Gear item preview (mobile / non-two-pane)
  const [myGearPreview, setMyGearPreview] = useState(null);
  const [myGearPreviewAdding, setMyGearPreviewAdding] = useState(false);

  const [activeTab, setActiveTab] = useState("import");
  const setAndPersistTab = (tab) => setActiveTab(tab);

  const showingCustomForm = tabLayout ? activeTab === "custom" : !!customMode;

  const switchToCustom = (prefillName = "") => {
    setAndPersistTab("custom");
    if (!customMode) {
      setCustomMode("manual");
      const ai = lastAiFillRef.current;
      if (ai && ai.query === prefillName) {
        setCustomForm((f) => ({
          name: f.name || ai.data.name || "",
          brand: f.brand || ai.data.brand || "",
          catalogCategory: f.catalogCategory || ai.data.category || "",
          itemType: f.itemType || ai.data.itemType || "",
          weight: f.weight || (ai.data.weightGrams != null ? formatInput(ai.data.weightGrams) : ""),
          description: f.description || ai.data.description || "",
          link: f.link || ai.data.link || "",
          imageUrl: f.imageUrl || ai.data.imageUrl || "",
        }));
      } else if (isUrl(prefillName)) {
        setCustomForm((f) => ({ ...f, link: f.link || prefillName }));
      } else {
        setCustomForm((f) => ({ ...f, name: prefillName || f.name }));
      }
    }
  };

  // Row activation: desktop two-pane previews in the pane; elsewhere opens the
  // stacked preview modal (mobile, and the narrow single-column contexts).
  const activateRow = (source, item, initialOptions = null) => {
    if (usePane) {
      setFocused({ source, id: String(item._id) });
      return;
    }
    if (source === "catalog") {
      handleViewCatalogDetails(item, initialOptions);
    } else {
      setMyGearPreview(item);
    }
  };

  const handleViewCatalogDetails = async (item, initialOptions = null) => {
    setPreviewItem(item);
    setPreviewInitialOptions(initialOptions);
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

  const handlePreviewImport = async (variantKey) => {
    if (!previewItem || previewImporting) return;
    setPreviewImporting(true);
    try {
      const id = String(previewItem._id);
      await onConfirm({
        source: "catalog",
        catalogIds: [id],
        ...(variantKey ? { variantSelections: { [id]: variantKey } } : {}),
      });
      setPreviewItem(null);
    } finally {
      setPreviewImporting(false);
    }
  };

  const handleMyGearPreviewAdd = async () => {
    if (!myGearPreview || myGearPreviewAdding) return;
    setMyGearPreviewAdding(true);
    try {
      await onConfirm({ source: "myGear", globalItems: [myGearPreview] });
      setMyGearPreview(null);
    } finally {
      setMyGearPreviewAdding(false);
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

  // Whole-catalog size, fetched once
  useEffect(() => {
    api
      .get("/catalog/items", { params: { limit: 1 } })
      .then(({ data }) => setCatalogAllTotal(data?.total ?? null))
      .catch(() => {});
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSubcategoryFilter(null);
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

  // Catalog search — skipped for URL queries (they never match catalog text fields)
  useEffect(() => {
    if (!debouncedQuery && !categoryFilter && !subcategoryFilter && !brandFilter) {
      setCatalogResults([]);
      setCatalogLoading(false);
      setCatalogTotal(null);
      return;
    }
    if (isUrl(debouncedQuery)) {
      setCatalogResults([]);
      setCatalogLoading(false);
      setCatalogTotal(0);
      return;
    }
    setCatalogLoading(true);
    const params = {};
    if (debouncedQuery.trim()) {
      const brandNumberMatch = debouncedQuery.trim().match(/^\S+\s+(\d{5,})$/);
      params.q = brandNumberMatch ? brandNumberMatch[1] : debouncedQuery.trim();
    }
    if (categoryFilter) params.category = categoryFilter;
    if (subcategoryFilter) params.subcategory = subcategoryFilter;
    if (brandFilter) params.brand = brandFilter;
    api
      .get("/catalog/items", { params })
      .then(({ data }) => {
        setCatalogResults(data?.items || []);
        setCatalogTotal(data?.total ?? null);
      })
      .catch(() => {
        setCatalogResults([]);
        setCatalogTotal(null);
      })
      .finally(() => setCatalogLoading(false));
  }, [debouncedQuery, categoryFilter, subcategoryFilter, brandFilter]);

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
    if (categoryFilter) items = items.filter((i) => i.catalogCategory === categoryFilter);
    if (subcategoryFilter) {
      items = items.filter((i) => i.subcategory === subcategoryFilter || i.itemType === subcategoryFilter);
    }
    if (brandFilter) items = items.filter((i) => i.brand === brandFilter);
    if (!debouncedQuery) return items;
    const tokens = normalize(debouncedQuery).split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const hay = normalize([item.name, item.brand, item.itemType, item.description].filter(Boolean).join(" "));
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

  const toggleVariantExpand = (id) => {
    setExpandedVariantRowId((prev) => (prev === id ? null : id));
  };

  // Picking a variant pill records the choice and selects the row.
  const pickCatalogVariant = (id, value) => {
    setCatalogVariantSelections((prev) => ({ ...prev, [id]: value }));
    setExpandedVariantRowId(null);
    if (!catalogSelected.has(id)) toggleCatalog(id);
  };

  // Pane variant pick — record the choice; leave selection alone (the pane has
  // its own select checkbox).
  const recordVariantPick = (id, value) => {
    setCatalogVariantSelections((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    setExpandedVariantRowId(null);
  }, [catalogResults]);

  const effectiveProductIds = useMemo(
    () => existingProductIds ?? new Set(myGearItems.map((i) => i.productId).filter(Boolean).map(String)),
    [existingProductIds, myGearItems],
  );

  const showCatalogMatches = (items, { select } = {}) => {
    setCatalogResults((prev) => {
      const ids = new Set(prev.map((i) => String(i._id)));
      const added = items.filter((m) => !ids.has(String(m._id)));
      return added.length ? [...added, ...prev] : prev;
    });
    const selectable = select && !effectiveProductIds.has(String(select._id));
    setCatalogSelected(selectable ? new Set([String(select._id)]) : new Set());
    setMyGearSelected(new Set());
    setCustomMode(null);
    if (tabLayout) setAndPersistTab("import");
  };

  const selectCatalogItem = (item) => showCatalogMatches([item], { select: item });

  // Flat, in-display-order list of focusable rows for keyboard nav + auto-focus.
  const flatRows = useMemo(() => {
    const rows = [];
    if (showMyGear) filteredMyGear.forEach((it) => rows.push({ source: "myGear", id: String(it._id) }));
    catalogResults.forEach((it) => rows.push({ source: "catalog", id: String(it._id) }));
    return rows;
  }, [showMyGear, filteredMyGear, catalogResults]);

  // Auto-focus the top result so the pane is never empty (decision 9).
  useEffect(() => {
    if (!usePane) return;
    if (!flatRows.length) {
      setFocused(null);
      return;
    }
    setFocused((prev) => {
      const stillThere = prev && flatRows.some((r) => r.source === prev.source && r.id === prev.id);
      return stillThere ? prev : flatRows[0];
    });
  }, [usePane, flatRows]);

  // Load the focused item into the pane.
  const focusKey = focused ? `${focused.source}:${focused.id}` : null;
  useEffect(() => {
    if (!usePane || !focused) {
      setPaneFull(null);
      return;
    }
    if (focused.source === "myGear") {
      const gi = myGearItems.find((i) => String(i._id) === focused.id);
      setPaneFull(gi ? { ...gi, weightGrams: gi.weight ?? gi.weightGrams } : null);
      setPaneLoading(false);
      setPaneError(null);
      return;
    }
    const listItem = catalogResults.find((i) => String(i._id) === focused.id);
    setPaneFull(listItem || null);
    setPaneLoading(true);
    setPaneError(null);
    let cancelled = false;
    api
      .get(`/catalog/items/${focused.id}`)
      .then(({ data }) => {
        if (!cancelled) setPaneFull(data);
      })
      .catch(() => {
        if (!cancelled) setPaneError(t("smartItemSearch.toasts.previewLoadFailed", "Failed to load item details."));
      })
      .finally(() => {
        if (!cancelled) setPaneLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [usePane, focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pane selection wiring for the focused item.
  const focusedSelected = focused
    ? focused.source === "myGear"
      ? myGearSelected.has(focused.id)
      : catalogSelected.has(focused.id)
    : false;
  const toggleFocusedSelect = (id) => {
    if (!focused) return;
    focused.source === "myGear" ? toggleMyGear(id) : toggleCatalog(id);
  };
  const paneHasVariants =
    (paneFull?.variantAxes?.length || 0) > 0 && (paneFull?.variants?.length || 0) > 0;
  const paneSizeUnset =
    focused?.source === "catalog" && paneHasVariants && !catalogVariantSelections[focused.id];
  const paneInitialOptions = useMemo(() => {
    if (focused?.source !== "catalog" || !paneHasVariants) return null;
    const key = catalogVariantSelections[focused.id];
    if (!key) return null;
    const v = paneFull.variants.find((x) => x.key === key);
    return v ? { ...v.options } : null;
  }, [focused, paneHasVariants, catalogVariantSelections, paneFull]);

  // Keyboard nav on the result list (decision 11).
  const onListKeyDown = (e) => {
    if (!flatRows.length) return;
    const idx = focused ? flatRows.findIndex((r) => r.source === focused.source && r.id === focused.id) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused(flatRows[Math.min(idx + 1, flatRows.length - 1)] || flatRows[0]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused(flatRows[Math.max(idx - 1, 0)] || flatRows[0]);
    } else if (e.key === " ") {
      e.preventDefault();
      if (focused) toggleFocusedSelect(focused.id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (canConfirm && !confirming) handleConfirm();
    }
  };

  // Create action — runs AI fill, then either shows a catalog match or pre-fills the custom form
  const handleCreateAction = async (queryOverride) => {
    const inputQuery = (typeof queryOverride === "string" ? queryOverride : query).trim();
    if (!inputQuery || aiLoading) return;
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/fill-item", { query: inputQuery });
      lastAiFillRef.current = { query: inputQuery, data };
      const matches = data.catalogMatches || [];

      if (matches.length === 1) {
        selectCatalogItem(matches[0]);
        toast.success(t("smartItemSearch.toasts.catalogMatch", "Found in catalog"));
      } else if (matches.length > 1) {
        showCatalogMatches(matches);
        toast(t("smartItemSearch.toasts.catalogMatches", "Found possible matches — pick yours below"));
      } else {
        setCustomMode("ai");
        setCustomForm((prev) => ({
          name:            prev.name            || data.name        || "",
          brand:           prev.brand           || data.brand       || "",
          catalogCategory: prev.catalogCategory || data.category    || "",
          itemType:        prev.itemType        || data.itemType    || "",
          weight:          prev.weight          || (data.weightGrams != null ? formatInput(data.weightGrams) : ""),
          description:     prev.description     || data.description || "",
          link:            prev.link            || data.link        || "",
          imageUrl:        prev.imageUrl        || data.imageUrl    || "",
        }));
        if (tabLayout) setAndPersistTab("custom");
      }
    } catch (err) {
      const specific = err?.response?.data?.message;
      toast.error(specific || t("smartItemSearch.toasts.aiFailed", "AI search failed. Try adding manually."));
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
      const variantSelections = Object.fromEntries(
        [...catalogSelected].filter((id) => catalogVariantSelections[id]).map((id) => [id, catalogVariantSelections[id]]),
      );
      // Decision 14: a selected variant item with no explicit fit pick is added
      // at its default fit and flagged "size not set" (never blocks the batch).
      const hasVariantsById = new Map(
        catalogResults.map((c) => [String(c._id), (c.variantAxes?.length || 0) > 0]),
      );
      const sizeUnset = [...catalogSelected].filter(
        (id) => hasVariantsById.get(id) && !catalogVariantSelections[id],
      );
      try {
        await onConfirm({
          source: "catalog",
          catalogIds: [...catalogSelected],
          ...(Object.keys(variantSelections).length ? { variantSelections } : {}),
          ...(sizeUnset.length ? { sizeUnset } : {}),
        });
      } finally {
        setConfirming(false);
      }
    }
  };

  const totalSelected = myGearSelected.size + catalogSelected.size;
  const canConfirm = showingCustomForm ? customForm.name.trim().length > 0 : totalSelected > 0;

  const labelAdd    = confirmLabels.add    ?? t("smartItemSearch.add",    "Add");
  const labelImport = confirmLabels.import ?? t("smartItemSearch.import", "Import");
  const labelCreate = confirmLabels.create ?? t("smartItemSearch.create", "Create");

  // Commit label — echoes count + destination in batch add mode (decision 8).
  const confirmLabel = confirming
    ? t("smartItemSearch.saving", "Saving...")
    : showingCustomForm
      ? labelCreate
      : multiSelect && destinationLabel && totalSelected > 0
        ? t("smartItemSearch.addNToDest", "Add {{count}} to {{dest}}", {
            count: totalSelected,
            dest: destinationLabel,
          })
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
  const catalogCountForDisplay = hasSearchIntent ? catalogTotal : catalogAllTotal;
  const hasNoResults =
    hasSearchIntent &&
    !catalogLoading &&
    !aiLoading &&
    filteredMyGear.length === 0 &&
    catalogResults.length === 0 &&
    !showingCustomForm;

  // The result list (shared between single-column and the two-pane left column).
  const renderResults = () => (
    <>
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
              focused={focused}
              onToggleMyGear={toggleMyGear}
              onToggleCatalog={toggleCatalog}
              onActivate={activateRow}
              multiSelect={multiSelect}
              existingGlobalIds={existingGlobalIds}
              fmtWeight={fmtWeight}
            />
          ) : null}
        </>
      )}

      {(hasSearchIntent || catalogResults.length > 0) && (
        <ResultSection
          title={t("smartItemSearch.fromCatalog", "From Catalog")}
          items={catalogResults}
          type="catalog"
          myGearSelected={myGearSelected}
          catalogSelected={catalogSelected}
          focused={focused}
          onToggleMyGear={toggleMyGear}
          onToggleCatalog={toggleCatalog}
          onActivate={activateRow}
          multiSelect={multiSelect}
          existingGlobalIds={existingGlobalIds}
          existingProductIds={effectiveProductIds}
          loading={catalogLoading}
          fmtWeight={fmtWeight}
          catalogVariantSelections={catalogVariantSelections}
          expandedVariantRowId={expandedVariantRowId}
          onToggleVariantExpand={toggleVariantExpand}
          onPickVariant={pickCatalogVariant}
        />
      )}

      {!showMyGear && !hasSearchIntent && (
        <p className="text-sm text-primary/40 text-center py-8">
          {t("smartItemSearch.browseHint", "Search the catalog above, or tap a category to browse.")}
        </p>
      )}

      {/* Inline custom-create row (decision 5) */}
      {tabLayout && debouncedQuery.trim() && !isUrl(debouncedQuery) && (
        <div className="border-t border-primary/8 mt-2 pt-2 pb-1">
          <button
            type="button"
            onClick={() => switchToCustom(debouncedQuery.trim())}
            className="flex items-center gap-1.5 text-sm text-secondary/80 hover:text-secondary transition-colors py-1"
          >
            <FiPlus size={13} className="flex-shrink-0" />
            {t("smartItemSearch.createCustomItem", 'Create "{query}" as a custom item').replace(
              "{query}",
              debouncedQuery.trim().length > 50 ? debouncedQuery.trim().slice(0, 50) + "…" : debouncedQuery.trim(),
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => {
        const types = e.dataTransfer?.types || [];
        if (["Files", "text/uri-list", "text/plain"].some((tt) => types.includes(tt))) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
        if (file) {
          e.preventDefault();
          openScanWithFile(file);
          return;
        }
        const raw = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text") || "";
        const url = raw.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
        if (isUrl(url)) {
          e.preventDefault();
          setQuery(url);
          handleCreateAction(url);
        }
      }}
    >
      {/* ── Tab row (tabLayout only) ───────────────────────────────────────── */}
      {tabLayout && (
        <div className="flex items-center border-b border-primary/10 flex-shrink-0 px-5">
          <button
            type="button"
            onClick={() => setAndPersistTab("import")}
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
                enterKeyHint="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!tabLayout) setCustomMode(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim() && !aiLoading) {
                    e.preventDefault();
                    handleCreateAction(query.trim());
                  }
                }}
                onPaste={(e) => {
                  const imageItem = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
                  if (imageItem) {
                    e.preventDefault();
                    openScanWithFile(imageItem.getAsFile());
                    return;
                  }
                  const pasted = (e.clipboardData?.getData("text") || "").trim();
                  if (isUrl(pasted)) handleCreateAction(pasted);
                }}
                placeholder=""
                className="w-full pl-9 pr-8 py-2 border border-primary/30 rounded-lg text-primary bg-base-100 text-base sm:text-sm"
              />
              {!query && (
                <span
                  className="absolute left-9 right-9 top-1/2 text-primary/40 text-base sm:text-sm pointer-events-none select-none truncate"
                  style={{
                    transform: `translateY(${phVisible ? "-50%" : "calc(-50% - 5px)"})`,
                    opacity: phVisible ? 1 : 0,
                    transition: "opacity 300ms ease, transform 300ms ease",
                  }}
                >
                  {searchPlaceholders[phIndex]}
                </span>
              )}
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
          {!tabLayout && (
            <p className="text-xs text-primary/35 mt-1.5 px-1">
              {catalogCountForDisplay != null
                ? t("smartItemSearch.catalogResultCount", "{{count}} items in catalog", { count: catalogCountForDisplay })
                : !query
                  ? t("smartItemSearch.searchHint", "Brand · Model · Size or variant")
                  : " "}
            </p>
          )}

          {tabLayout && (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-xs text-primary/35 truncate">
                {catalogCountForDisplay != null
                  ? t("smartItemSearch.catalogResultCount", "{{count}} items in catalog", { count: catalogCountForDisplay })
                  : !query
                    ? t("smartItemSearch.tabSearchHint", "Type & press Enter · Paste a link · Snap a photo")
                    : " "}
              </p>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="text-xs text-primary/50 hover:text-primary/80 underline underline-offset-2 flex-shrink-0"
              >
                {t("smartItemSearch.browseToggle", "Browse categories")}
              </button>
            </div>
          )}

          {tabLayout && (
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                showFilters || categoryFilter || subcategoryFilter || brandFilter ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div
                className={`overflow-hidden transition-opacity duration-150 ease-in-out ${
                  showFilters || categoryFilter || subcategoryFilter || brandFilter ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="mt-2 flex gap-1.5">
                  <select
                    value={categoryFilter || ""}
                    onChange={(e) => setCategoryFilter(e.target.value || null)}
                    className="flex-1 min-w-0 border border-primary/20 rounded-lg px-2 py-1.5 text-xs text-primary bg-base-100 cursor-pointer"
                  >
                    <option value="">{t("smartItemSearch.allCategories", "All Categories")}</option>
                    {CATALOG_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{tCategory(t, cat)}</option>
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
                    {Array.from(new Set(brandFilter ? [brandFilter, ...brandOptions] : brandOptions)).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
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
                onClick={() => setCategoryFilter(categoryFilter === chip.value ? null : chip.value)}
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
          onCreate={handleCreateAction}
          onManual={() => {
            setCustomMode("manual");
            setCustomForm({
              name: debouncedQuery.trim(),
              brand: "", catalogCategory: "", itemType: "", weight: "", description: "", link: "", imageUrl: "",
            });
          }}
          aiLoading={aiLoading}
        />
      )}

      {/* ── Body: results (single column) or two-pane master–detail ──────── */}
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
                onClick={() => setCategoryFilter(categoryFilter === chip.value ? null : chip.value)}
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

        {showingCustomForm ? (
          <div className="flex-1 overflow-y-auto min-h-0 px-5">
            <CustomForm form={customForm} onChange={setCustomForm} unitLabel={unitLabel} />
          </div>
        ) : aiLoading ? (
          <div className="flex-1 overflow-y-auto min-h-0 px-5">
            <AiSearchProgress urlQuery={isUrl(query)} />
          </div>
        ) : hasNoResults ? (
          <div className="flex-1 overflow-y-auto min-h-0 px-5">
            <NoResults query={debouncedQuery} onCreate={handleCreateAction} aiLoading={aiLoading} />
          </div>
        ) : usePane ? (
          // Two-pane master–detail
          <div className="flex-1 flex min-h-0">
            <div
              className="w-[42%] min-w-[280px] max-w-[420px] border-r border-primary/10 overflow-y-auto px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-inset"
              tabIndex={0}
              role="listbox"
              aria-label={t("smartItemSearch.resultsLabel", "Search results")}
              onKeyDown={onListKeyDown}
            >
              {renderResults()}
            </div>
            <CatalogPreviewPane
              item={paneFull}
              loading={paneLoading}
              error={paneError}
              selected={focusedSelected}
              onToggleSelect={toggleFocusedSelect}
              initialSelectedOptions={paneInitialOptions}
              onExplicitVariantChange={recordVariantPick}
              sizeUnset={paneSizeUnset}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 px-5">{renderResults()}</div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-primary/10 flex-shrink-0">
        {multiSelect && totalSelected > 0 && (
          <span className="text-xs text-primary/50 tabular-nums mr-auto">
            {t("smartItemSearch.nSelected", "{{count}} selected", { count: totalSelected })}
          </span>
        )}
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
            !canConfirm || confirming ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/80"
          }`}
        >
          {confirming && <FiLoader size={12} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>

      {/* Stacked catalog preview modal (mobile / non-two-pane) */}
      <CatalogItemPreviewModal
        isOpen={!!previewItem}
        onClose={() => {
          setPreviewItem(null);
          setPreviewInitialOptions(null);
        }}
        item={previewItem}
        initialSelectedOptions={previewInitialOptions}
        loading={previewLoading}
        error={previewError}
        onImport={handlePreviewImport}
        importing={previewImporting}
      />

      {/* My Gear item preview (mobile / non-two-pane) */}
      <CatalogItemPreviewModal
        isOpen={!!myGearPreview}
        onClose={() => setMyGearPreview(null)}
        item={myGearPreview ? { ...myGearPreview, weightGrams: myGearPreview.weight ?? myGearPreview.weightGrams } : null}
        onImport={handleMyGearPreviewAdd}
        importing={myGearPreviewAdding}
        alreadyImported={!!myGearPreview && existingGlobalIds.has(String(myGearPreview._id))}
        importLabel={t("catalogPreview.buttons.addToList", "Add to list")}
      />

      {/* Photo scan modal */}
      {showScanModal && (
        <PhotoScanModal
          initialFile={scanFile}
          onClose={closeScanModal}
          onResult={(scanData) => {
            closeScanModal();
            setCustomMode("ai");
            if (tabLayout) setAndPersistTab("custom");
            setCustomForm({
              name: scanData.name || "",
              brand: scanData.brand || "",
              catalogCategory: scanData.category || "",
              itemType: scanData.itemType || "",
              weight: scanData.weightGrams != null ? formatInput(scanData.weightGrams) : "",
              description: scanData.description || "",
              link: "",
              imageUrl: scanData.photoUrl || scanData.imageUrl || "",
            });
          }}
          onCatalogSelect={(item) => {
            closeScanModal();
            selectCatalogItem(item);
            activateRow("catalog", item);
          }}
        />
      )}
    </div>
  );
}
