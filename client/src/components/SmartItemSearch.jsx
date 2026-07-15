// src/components/SmartItemSearch.jsx
// Unified item search: My Gear + Catalog + AI fill-in fallback.
// Drop this inside any modal/drawer shell — it manages its own search state.
//
// Desktop two-pane (twoPane): result list on the left, live preview pane on the
// right. Click a row = preview (pane follows); the checkbox is the only thing
// that batches. Keyboard: ↑/↓ move the focused row, Space toggles its checkbox,
// Enter commits the batch.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiX, FiPlus, FiLoader, FiCamera } from "react-icons/fi";
import {
  LuMoon, LuTent, LuBackpack, LuShirt, LuFootprints, LuCookingPot,
  LuDroplet, LuBatteryCharging, LuWrench, LuHeartPulse, LuCompass, LuLuggage,
} from "react-icons/lu";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { CATALOG_CATEGORIES, CATALOG_SUBCATEGORIES, tCategory } from "../config/catalogTaxonomy";
import { FEATURED_BRAND } from "../config/featuredBrand";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import Spinner from "./ui/Spinner";
import LinkInput from "./LinkInput";
import CatalogItemPreviewModal from "./CatalogItemPreviewModal";
import CatalogPreviewPane from "./CatalogPreviewPane";
import { shortLabel } from "./VariantSelector";
import PhotoScanModal from "./PhotoScanModal";
import useStagedMessage from "../hooks/useStagedMessage";
import useHistoryDismiss from "../hooks/useHistoryDismiss";
import useKeyboardOpen from "../hooks/useKeyboardOpen";

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

// Icon per top-level catalog category (browse zero-state tiles). Keyed by the
// English category value so it survives translation.
const CATEGORY_ICONS = {
  "Sleep System": LuMoon,
  "Shelter": LuTent,
  "Backpacks & Bags": LuBackpack,
  "Men's Clothing": LuShirt,
  "Women's Clothing": LuShirt,
  "Unisex Clothing": LuShirt,
  "Footwear": LuFootprints,
  "Kitchen & Cooking": LuCookingPot,
  "Hydration": LuDroplet,
  "Electronics & Power": LuBatteryCharging,
  "Accessories & Tools": LuWrench,
  "Health & Hygiene": LuHeartPulse,
  "Navigation & Planning": LuCompass,
  "Travel": LuLuggage,
};

// Remembers the tab the user last opened (Import / My Gear / Custom).
const TAB_STORAGE_KEY = "treklist.addGear.lastTab";

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
  hideCheckbox,
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
      className={`flex items-center gap-3 px-3 py-2 min-h-[56px] sm:min-h-0 rounded border cursor-pointer transition-colors border-l-[3px] ${
        focused
          ? "border-primary/20 border-l-secondary bg-secondary/5"
          : selected
            ? "border-secondary/40 border-l-transparent bg-secondary/10"
            : "border-primary/15 border-l-transparent hover:bg-primary/5"
      }`}
    >
      {/* Swap mode hides the checkbox entirely — the row previews and the pane/
          sheet "Swap for this" button commits (no batch select). */}
      {!hideCheckbox && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
          className="flex-shrink-0 flex items-center justify-center cursor-pointer -my-2 -ml-1 py-2 pl-1 pr-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:m-0 sm:p-0"
          tabIndex={-1}
          aria-label={t("smartItemSearch.selectRow", "Select {{name}}", { name: item.name })}
        >
          <input
            type={multiSelect ? "checkbox" : "radio"}
            checked={selected}
            onChange={() => {}}
            className="h-[22px] w-[22px] sm:h-4 sm:w-4 text-secondary border-primary rounded pointer-events-none"
          />
        </button>
      )}

      {/* Thumbnail */}
      <div className="h-11 w-11 sm:h-8 sm:w-8 flex-shrink-0 rounded border border-primary/15 bg-white overflow-hidden flex items-center justify-center">
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
  hideCheckbox,
  existingGlobalIds,
  existingProductIds,
  sessionAddedGlobal,
  sessionAddedCatalog,
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
            const justAdded = sessionAddedGlobal?.has(id);
            const added = justAdded || existingGlobalIds?.has(id);
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
                hideCheckbox={hideCheckbox}
                addedBadge={
                  justAdded
                    ? t("smartItemSearch.inListCheck", "✓ In list")
                    : added
                      ? t("smartItemSearch.inList", "Added")
                      : null
                }
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
          const justAdded = sessionAddedCatalog?.has(id);
          const added = justAdded || existingProductIds?.has(id);
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
              hideCheckbox={hideCheckbox}
              addedBadge={
                justAdded
                  ? t("smartItemSearch.inListCheck", "✓ In list")
                  : added
                    ? t("smartItemSearch.inMyGear", "In my gear")
                    : null
              }
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

// ── Browse zero state: optional featured-brand slot (config-driven) ───────────
// Hidden entirely when FEATURED_BRAND is unset (decision 6). Browse zero state
// only — never influences search relevance.
function FeaturedBrand({ brand, onOpen }) {
  const { t } = useTranslation("common");
  if (!brand) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(brand)}
      className="mx-5 mt-3 flex items-center gap-3 rounded-lg border border-primary/15 px-3 py-2 text-left hover:bg-primary/5 transition-colors"
    >
      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-accent flex-none">
        {t("smartItemSearch.featured", "Featured")}
      </span>
      {brand.imageUrl && (
        <img src={brand.imageUrl} alt="" className="h-6 w-6 rounded object-contain flex-none" />
      )}
      <span className="text-sm font-semibold text-primary truncate">{brand.name}</span>
      <span className="ml-auto text-xs text-primary/50 underline underline-offset-2 whitespace-nowrap">
        {t("smartItemSearch.browseRange", "Browse the range →")}
      </span>
    </button>
  );
}

// ── Browse zero state: 14 locked category tiles (decision 6 / 15) ─────────────
// Name + count, never icon-only; taxonomy order; ragged last row accepted (no
// filler tiles). A tile drills into results scoped to that category.
function CategoryTileGrid({ counts, onPick }) {
  const { t, i18n } = useTranslation("common");
  const fmt = (n) => Number(n).toLocaleString(i18n.language || undefined);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 sm:flex-1 sm:auto-rows-fr sm:content-stretch">
      {CATALOG_CATEGORIES.map((cat) => {
        const Icon = CATEGORY_ICONS[cat];
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onPick(cat)}
            className="flex items-center gap-2.5 rounded-lg border border-primary/15 px-3 py-2 sm:py-3 text-left hover:bg-primary/5 hover:border-secondary/40 transition-colors"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-secondary/10 text-secondary">
              {Icon ? <Icon size={16} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-primary leading-tight">
                {tCategory(t, cat)}
              </span>
              <span className="block text-[10.5px] text-primary/40 tabular-nums">
                {counts?.[cat] != null ? fmt(counts[cat]) : "—"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Facet row: count + active category chip + subcategory chips (decision 7) ──
// Horizontal scroll; Brand chip is a later drop-in.
function FacetRow({
  shownCount, totalCount, category, subcategory, onClearCategory, onPickSub,
  brands, brand, onPickBrand,
}) {
  const { t, i18n } = useTranslation("common");
  const fmt = (n) => Number(n).toLocaleString(i18n.language || undefined);
  const subs = category ? CATALOG_SUBCATEGORIES[category] || [] : [];
  const countLabel =
    shownCount != null && totalCount != null
      ? t("smartItemSearch.facetCount", "{{shown}} of {{total}} items", {
          shown: fmt(shownCount),
          total: fmt(totalCount),
        })
      : shownCount != null
        ? t("smartItemSearch.catalogResultCount", "{{count}} items in catalog", { count: shownCount })
        : "";
  return (
    <div
      className="flex items-center gap-2 px-5 py-2 border-b border-primary/10 overflow-x-auto flex-shrink-0"
      style={{ scrollbarWidth: "none" }}
    >
      {countLabel && (
        <span className="text-[11.5px] text-primary/45 tabular-nums whitespace-nowrap flex-none">
          {countLabel}
        </span>
      )}
      {category && (
        <button
          type="button"
          onClick={onClearCategory}
          className="flex-none flex items-center gap-1 rounded-full bg-secondary text-white px-2.5 py-0.5 text-xs whitespace-nowrap"
        >
          {tCategory(t, category)}
          <FiX size={11} />
        </button>
      )}
      {brands?.length > 0 && (
        <div className="relative flex-none">
          <select
            value={brand || ""}
            onChange={(e) => onPickBrand(e.target.value || null)}
            className={`appearance-none rounded-full border pl-2.5 pr-6 py-0.5 text-xs whitespace-nowrap transition-colors cursor-pointer ${
              brand
                ? "bg-secondary text-white border-secondary"
                : "border-primary/20 text-primary/60 hover:border-secondary/50 bg-base-100"
            }`}
          >
            <option value="">{t("smartItemSearch.allBrands", "All brands")}</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] ${brand ? "text-white" : "text-primary/40"}`}>▾</span>
        </div>
      )}
      {subs.map((sub) => (
        <button
          key={sub}
          type="button"
          onClick={() => onPickSub(subcategory === sub ? null : sub)}
          className={`flex-none rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap border transition-colors ${
            subcategory === sub
              ? "bg-secondary text-white border-secondary"
              : "border-primary/20 text-primary/60 hover:border-secondary/50 hover:text-primary"
          }`}
        >
          {sub}
        </button>
      ))}
    </div>
  );
}

// ── Mobile preview bottom sheet (the mobile counterpart of the desktop pane) ──
// Slides up over the takeover; swipe-down, scrim tap, or back gesture dismisses.
// Reuses CatalogPreviewPane's content in sheet mode so the preview stays DRY.
function CatalogPreviewSheet({
  open,
  onClose,
  item,
  loading,
  error,
  initialSelectedOptions,
  onExplicitVariantChange,
  sizeUnset,
  onAdd,
  adding,
  added,
  addLabel,
}) {
  const [dragY, setDragY] = useState(0);
  const [entered, setEntered] = useState(false);
  const startY = useRef(null);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setDragY(0);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const dragging = startY.current != null;
  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 90) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col justify-end sm:hidden">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        style={{ opacity: entered ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="relative bg-base-100 rounded-t-2xl shadow-2xl max-h-[88dvh] flex flex-col"
        style={{
          transform: `translateY(${entered ? dragY : 640}px)`,
          transition: dragging ? "none" : "transform 260ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Drag handle — swipe down to dismiss */}
        <div
          className="flex-shrink-0 pt-2.5 pb-1.5 flex items-center justify-center touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-primary/20" />
        </div>
        <div
          className="overflow-y-auto min-h-0"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <CatalogPreviewPane
            sheet
            item={item}
            loading={loading}
            error={error}
            initialSelectedOptions={initialSelectedOptions}
            onExplicitVariantChange={onExplicitVariantChange}
            sizeUnset={sizeUnset}
            onAdd={onAdd}
            adding={adding}
            added={added}
            addLabel={addLabel}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
/**
 * Props:
 *   multiSelect          boolean  — true for add-to-list/library; false for swap
 *   swapMode             boolean  — single-select swap: hides checkboxes + batch bar,
 *                                   pane/sheet primary button reads "Swap for this" and
 *                                   commits immediately (replaces the source gear item)
 *   showMyGear           boolean  — false for library-only contexts (GlobalItemModal)
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
  swapMode = false,
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
  // Mobile counterpart of the two-pane preview: tapping a row opens a bottom
  // sheet (the mobile preview surface) instead of the stacked modal.
  const wantsSheet = twoPane && !isDesktop;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAdding, setSheetAdding] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  // Items added during this session (mobile sheet single-adds) — badge their
  // rows "✓ In list" without ejecting from the takeover (mobile build contract).
  const [sessionAddedGlobal, setSessionAddedGlobal] = useState(() => new Set());
  const [sessionAddedCatalog, setSessionAddedCatalog] = useState(() => new Set());

  // My Gear
  const [myGearItems, setMyGearItems] = useState([]);
  const [myGearLoading, setMyGearLoading] = useState(showMyGear);

  // Catalog
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(null);
  const [catalogAllTotal, setCatalogAllTotal] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState(null); // { [category]: count } for browse tiles
  const [catalogBrands, setCatalogBrands] = useState([]); // brand facet options (scoped to category)
  const [loadingMore, setLoadingMore] = useState(false); // "Show more" pagination

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

  // Restore the tab the user last explicitly chose (add-gear feedback). Only
  // the three tab buttons persist; programmatic switches (e.g. an AI-no-match
  // jump to Custom) don't, so it reflects a deliberate choice. A stored
  // "myGear" is ignored where the library tab doesn't exist.
  const [activeTab, setActiveTab] = useState(() => {
    if (!tabLayout) return "import";
    let stored = null;
    try {
      stored = localStorage.getItem(TAB_STORAGE_KEY);
    } catch {
      /* localStorage unavailable */
    }
    if (stored === "custom") return "custom";
    if (stored === "myGear") return showMyGear ? "myGear" : "import";
    return "import";
  });
  const setAndPersistTab = (tab) => setActiveTab(tab);
  const chooseTab = (tab) => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      /* localStorage unavailable */
    }
    setActiveTab(tab);
  };

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
    if (wantsSheet) {
      // Mobile two-pane: preview in a bottom sheet (loaded by the pane effect).
      setFocused({ source, id: String(item._id) });
      setSheetOpen(true);
      return;
    }
    if (source === "catalog") {
      handleViewCatalogDetails(item, initialOptions);
    } else {
      setMyGearPreview(item);
    }
  };

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  // Back gesture / Android back closes the sheet first, never the app.
  useHistoryDismiss(sheetOpen, closeSheet);

  // Sheet single-add (mobile): adds this one item, flips its row to "✓ In list",
  // and keeps the takeover open (no eject). onConfirm is told to keepOpen.
  const handleSheetAdd = async (variantKey) => {
    if (!focused || sheetAdding) return;
    setSheetAdding(true);
    try {
      if (focused.source === "myGear") {
        const gi = myGearItems.find((i) => String(i._id) === focused.id);
        if (!gi) return;
        await onConfirm({ source: "myGear", globalItems: [gi] }, { keepOpen: true });
        setSessionAddedGlobal((prev) => new Set(prev).add(focused.id));
      } else {
        const id = focused.id;
        const key = variantKey || catalogVariantSelections[id];
        const hasVariants =
          (paneFull?.variantAxes?.length || 0) > 0 && (paneFull?.variants?.length || 0) > 0;
        await onConfirm(
          {
            source: "catalog",
            catalogIds: [id],
            ...(key ? { variantSelections: { [id]: key } } : {}),
            ...(hasVariants && !key ? { sizeUnset: [id] } : {}),
          },
          { keepOpen: true },
        );
        setSessionAddedCatalog((prev) => new Set(prev).add(id));
      }
      toast.success(t("smartItemSearch.toasts.addedToList", "Added to list"));
      closeSheet();
    } catch {
      // onConfirm surfaces its own error toast; keep the sheet open to retry.
    } finally {
      setSheetAdding(false);
    }
  };

  // Swap-mode commit (desktop pane + mobile sheet): replaces the source gear
  // item with the focused result. onConfirm (doSwap) closes the modal on
  // success; the shared `sheetAdding` flag also drives the pane button spinner.
  const handleSwap = async (variantKey) => {
    if (!focused || sheetAdding) return;
    setSheetAdding(true);
    try {
      if (focused.source === "myGear") {
        const gi = myGearItems.find((i) => String(i._id) === focused.id);
        if (!gi) return;
        await onConfirm({ source: "myGear", globalItems: [gi] });
      } else {
        const id = focused.id;
        const key = variantKey || catalogVariantSelections[id];
        await onConfirm({
          source: "catalog",
          catalogIds: [id],
          ...(key ? { variantSelections: { [id]: key } } : {}),
        });
      }
    } catch {
      // onConfirm surfaces its own error toast; keep the modal open to retry.
    } finally {
      setSheetAdding(false);
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

  // Per-category counts for the browse zero-state tiles (tabLayout only).
  useEffect(() => {
    if (!tabLayout) return;
    api
      .get("/catalog/category-counts")
      .then(({ data }) => setCategoryCounts(data || {}))
      .catch(() => {});
  }, [tabLayout]);

  // Brand facet options, scoped to the active category (tabLayout only). Lets
  // the user filter results by brand from the facet row.
  useEffect(() => {
    if (!tabLayout) return;
    const params = {};
    if (categoryFilter) params.category = categoryFilter;
    api
      .get("/catalog/brands", { params })
      .then(({ data }) => setCatalogBrands(Array.isArray(data) ? data : []))
      .catch(() => setCatalogBrands([]));
  }, [tabLayout, categoryFilter]);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSubcategoryFilter(null);
    setBrandFilter(null);
  }, [categoryFilter]);


  // Catalog search — skipped for URL queries (they never match catalog text fields)
  useEffect(() => {
    // The My Gear tab browses the user's library only — never hit the catalog
    // (and drop any results carried over from the Import tab).
    if (tabLayout && activeTab === "myGear") {
      setCatalogResults([]);
      setCatalogLoading(false);
      setCatalogTotal(null);
      return;
    }
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
    // Guard against a stale in-flight response clobbering a newer state (e.g.
    // clearing a category while a brand fetch is still resolving would otherwise
    // repopulate results with no facet row to clear them — a dead end).
    let cancelled = false;
    api
      .get("/catalog/items", { params })
      .then(({ data }) => {
        if (cancelled) return;
        setCatalogResults(data?.items || []);
        setCatalogTotal(data?.total ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogResults([]);
        setCatalogTotal(null);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, categoryFilter, subcategoryFilter, brandFilter, tabLayout, activeTab]);

  // "Show more": append the next page of catalog results (skip = current count).
  // Browsing a large category (e.g. Shelter) exceeds one page, so paginate
  // instead of silently truncating at the first 100.
  const loadMoreCatalog = useCallback(async () => {
    if (loadingMore) return;
    if (catalogTotal != null && catalogResults.length >= catalogTotal) return;
    setLoadingMore(true);
    const params = { skip: catalogResults.length, limit: 100 };
    if (debouncedQuery.trim()) {
      const brandNumberMatch = debouncedQuery.trim().match(/^\S+\s+(\d{5,})$/);
      params.q = brandNumberMatch ? brandNumberMatch[1] : debouncedQuery.trim();
    }
    if (categoryFilter) params.category = categoryFilter;
    if (subcategoryFilter) params.subcategory = subcategoryFilter;
    if (brandFilter) params.brand = brandFilter;
    try {
      const { data } = await api.get("/catalog/items", { params });
      const page = data?.items || [];
      setCatalogResults((prev) => {
        const seen = new Set(prev.map((i) => String(i._id)));
        return [...prev, ...page.filter((i) => !seen.has(String(i._id)))];
      });
    } catch {
      // non-fatal — leave the current page in place
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, catalogTotal, catalogResults, debouncedQuery, categoryFilter, subcategoryFilter, brandFilter]);

  // Zero-result search log (handoff CUT section → demand signal). Fires
  // fire-and-forget once per settled text query that returns nothing — a
  // catalog-gap signal that feeds the admin backlog. Debounced by using the
  // already-debounced query; deduped per session so one query logs once.
  const loggedZeroQueries = useRef(new Set());
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || isUrl(q) || catalogLoading) return;
    if (catalogResults.length > 0) return;
    const key = q.toLowerCase();
    if (loggedZeroQueries.current.has(key)) return;
    loggedZeroQueries.current.add(key);
    api.post("/catalog/search-log", { query: q }).catch(() => {});
  }, [debouncedQuery, catalogLoading, catalogResults]);

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

  // Load the focused item into the pane (desktop) or the bottom sheet (mobile).
  const paneActive = usePane || (wantsSheet && sheetOpen);
  const focusKey = focused ? `${focused.source}:${focused.id}` : null;
  useEffect(() => {
    if (!paneActive || !focused) {
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
  }, [paneActive, focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pane selection wiring for the focused item (Space toggles the row checkbox).
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

  // Sheet "Add" button state (mobile): already-in-list or added this session.
  const sheetItemAdded = focused
    ? focused.source === "catalog"
      ? sessionAddedCatalog.has(focused.id) || effectiveProductIds.has(focused.id)
      : sessionAddedGlobal.has(focused.id) || existingGlobalIds.has(focused.id)
    : false;
  const sheetAddLabel = destinationLabel
    ? t("smartItemSearch.addToDest", "Add to {{dest}}", { dest: destinationLabel })
    : t("smartItemSearch.add", "Add");
  const swapLabel = t("smartItemSearch.swapForThis", "Swap for this");

  // Desktop preview-pane commit affordance: an immediate action button in both
  // modes. Swap mode → "Swap for this"; add mode → "Add to {dest}" adds the
  // previewed item directly (no separate select-then-add step). Batch multi-add
  // still lives on the result-list checkboxes + footer.
  const paneCommitProps = swapMode
    ? { onAdd: handleSwap, adding: sheetAdding, added: false, addLabel: swapLabel }
    : { onAdd: handleSheetAdd, adding: sheetAdding, added: sheetItemAdded, addLabel: sheetAddLabel };

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
      if (swapMode) return; // no batch selection in swap mode
      e.preventDefault();
      if (focused) toggleFocusedSelect(focused.id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (swapMode) {
        if (focused && !sheetAdding) handleSwap();
      } else if (canConfirm && !confirming) {
        handleConfirm();
      }
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

  // My Gear tab: browse the user's own library directly — no search or category
  // needed (add-gear feedback: you shouldn't have to remember the item's name).
  const browseMyGear = tabLayout && showMyGear && activeTab === "myGear";

  const hasNoResults =
    hasSearchIntent &&
    !browseMyGear &&
    !catalogLoading &&
    !aiLoading &&
    filteredMyGear.length === 0 &&
    catalogResults.length === 0 &&
    !showingCustomForm;

  // The result list (shared between single-column and the two-pane left column).
  // onlyMyGear = the My Gear tab: show just the user's library, no catalog.
  const renderResults = (onlyMyGear = false) => (
    <>
      {showMyGear && (
        <>
          {myGearLoading && filteredMyGear.length === 0 ? (
            <div className="py-4"><Spinner centered /></div>
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
              hideCheckbox={swapMode}
              existingGlobalIds={existingGlobalIds}
              sessionAddedGlobal={sessionAddedGlobal}
              fmtWeight={fmtWeight}
            />
          ) : onlyMyGear ? (
            <p className="text-sm text-primary/40 text-center py-8 px-4">
              {hasSearchIntent
                ? t("smartItemSearch.noGearMatch", "No gear in your library matches that.")
                : t(
                    "smartItemSearch.libraryEmpty",
                    "Your library is empty. Import from the catalog or create a custom item and it’ll show up here.",
                  )}
            </p>
          ) : !hasSearchIntent ? (
            <p className="text-sm text-primary/40 text-center py-8">
              {t("smartItemSearch.noGearYet", "No gear yet. Search the catalog or describe an item above.")}
            </p>
          ) : null}
        </>
      )}

      {!onlyMyGear && (hasSearchIntent || catalogResults.length > 0) && (
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
          hideCheckbox={swapMode}
          existingGlobalIds={existingGlobalIds}
          existingProductIds={effectiveProductIds}
          sessionAddedGlobal={sessionAddedGlobal}
          sessionAddedCatalog={sessionAddedCatalog}
          loading={catalogLoading}
          fmtWeight={fmtWeight}
          catalogVariantSelections={catalogVariantSelections}
          expandedVariantRowId={expandedVariantRowId}
          onToggleVariantExpand={toggleVariantExpand}
          onPickVariant={pickCatalogVariant}
        />
      )}

      {/* Pagination — reveal the rest of a large category/result set */}
      {!onlyMyGear && !catalogLoading && catalogTotal != null && catalogResults.length < catalogTotal && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={loadMoreCatalog}
            disabled={loadingMore}
            className="flex items-center gap-1.5 rounded-lg border border-primary/20 px-4 py-1.5 text-sm text-primary/70 hover:bg-primary/5 disabled:opacity-50 transition-colors"
          >
            {loadingMore && <FiLoader size={13} className="animate-spin" />}
            {loadingMore
              ? t("smartItemSearch.loadingMore", "Loading…")
              : t("smartItemSearch.showMore", "Show more ({{n}} left)", {
                  n: catalogTotal - catalogResults.length,
                })}
          </button>
        </div>
      )}

      {!showMyGear && !hasSearchIntent && (
        <p className="text-sm text-primary/40 text-center py-8">
          {t("smartItemSearch.browseHint", "Search the catalog above, or tap a category to browse.")}
        </p>
      )}

      {/* Inline custom-create row (decision 5) */}
      {!onlyMyGear && tabLayout && debouncedQuery.trim() && !isUrl(debouncedQuery) && (
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
            onClick={() => chooseTab("import")}
            className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "import"
                ? "border-secondary text-secondary"
                : "border-transparent text-primary/60 hover:text-primary"
            }`}
          >
            {t("smartItemSearch.tabs.import", "Import")}
          </button>
          {showMyGear && (
            <button
              type="button"
              onClick={() => {
                // Enter the library cleanly — drop any leftover catalog search.
                setQuery("");
                setCategoryFilter(null);
                setSubcategoryFilter(null);
                setBrandFilter(null);
                chooseTab("myGear");
              }}
              className={`py-3 px-1 mr-5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "myGear"
                  ? "border-secondary text-secondary"
                  : "border-transparent text-primary/60 hover:text-primary"
              }`}
            >
              {t("smartItemSearch.tabs.myGear", "My Gear")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              chooseTab("custom");
              switchToCustom(debouncedQuery.trim());
            }}
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
      {(!tabLayout || activeTab !== "custom") && (
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
                  // My Gear tab filters live — Enter must not fire an AI catalog lookup.
                  if (e.key === "Enter" && query.trim() && !aiLoading && !browseMyGear) {
                    e.preventDefault();
                    handleCreateAction(query.trim());
                  }
                }}
                onPaste={(e) => {
                  if (browseMyGear) return; // library search only, no scan/URL import
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
              {!query && browseMyGear && (
                <span className="absolute left-9 right-9 top-1/2 -translate-y-1/2 text-primary/40 text-base sm:text-sm pointer-events-none select-none truncate">
                  {t("smartItemSearch.searchYourGear", "Search your gear")}
                </span>
              )}
              {!query && !browseMyGear && (
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
            {!browseMyGear && (
              <button
                type="button"
                onClick={() => setShowScanModal(true)}
                title={t("smartItemSearch.scanItem", "Scan item with camera")}
                className="flex-shrink-0 p-2 border border-primary/30 rounded-lg text-primary/50 hover:text-secondary hover:border-secondary/50 transition-colors"
              >
                <FiCamera size={16} />
              </button>
            )}
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
        </div>
      )}

      {/* ── Facet row (tabLayout, search intent) — count + category + subs ──── */}
      {tabLayout && !browseMyGear && hasSearchIntent && !showingCustomForm && !aiLoading && (
        <FacetRow
          shownCount={catalogTotal}
          totalCount={catalogAllTotal}
          category={categoryFilter}
          subcategory={subcategoryFilter}
          onClearCategory={() => setCategoryFilter(null)}
          onPickSub={setSubcategoryFilter}
          brands={catalogBrands}
          brand={brandFilter}
          onPickBrand={setBrandFilter}
        />
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
        ) : tabLayout && activeTab === "import" && !hasSearchIntent && catalogResults.length === 0 ? (
          // Browse zero state (decision 6): featured slot + 14 category tiles
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <FeaturedBrand
              brand={FEATURED_BRAND}
              onOpen={(b) => {
                if (b?.category) setCategoryFilter(b.category);
                setBrandFilter(b?.brand || b?.name || null);
              }}
            />
            <CategoryTileGrid counts={categoryCounts} onPick={(cat) => setCategoryFilter(cat)} />
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
              {renderResults(browseMyGear)}
            </div>
            <CatalogPreviewPane
              item={paneFull}
              loading={paneLoading}
              error={paneError}
              initialSelectedOptions={paneInitialOptions}
              onExplicitVariantChange={recordVariantPick}
              sizeUnset={swapMode ? false : paneSizeUnset}
              {...paneCommitProps}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 px-5">{renderResults(browseMyGear)}</div>
        )}
      </div>

      {/* Footer — sticky commit bar; hides on mobile while the keyboard is up.
          Swap mode has no batch commit bar (the pane/sheet "Swap for this"
          button commits) — the footer only shows for the custom-create form. */}
      {(!swapMode || showingCustomForm) && (
      <div
        className={`items-center justify-end gap-3 px-5 py-3 border-t border-primary/10 flex-shrink-0 ${
          keyboardOpen ? "hidden sm:flex" : "flex"
        }`}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
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
        {/* The footer commit only appears when it has a distinct job: the custom
            form, or a multi-select batch. Single-item quick-add lives on the
            preview pane's own button, so there's no duplicate/disabled "Add". */}
        {(showingCustomForm || totalSelected > 0) && (
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
        )}
      </div>
      )}

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

      {/* Mobile preview bottom sheet (add-gear two-pane on small screens) */}
      {wantsSheet && (
        <CatalogPreviewSheet
          open={sheetOpen}
          onClose={closeSheet}
          item={paneFull}
          loading={paneLoading}
          error={paneError}
          initialSelectedOptions={paneInitialOptions}
          onExplicitVariantChange={recordVariantPick}
          sizeUnset={swapMode ? false : paneSizeUnset}
          onAdd={swapMode ? handleSwap : handleSheetAdd}
          adding={sheetAdding}
          added={swapMode ? false : sheetItemAdded}
          addLabel={swapMode ? swapLabel : sheetAddLabel}
        />
      )}

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
