// client/src/pages/MyGearView.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  FaSearch,
  FaThLarge,
  FaList,
  FaPlus,
  FaChevronDown,
} from "react-icons/fa";
import ConfirmDialog from "../components/ConfirmDialog";
import GlobalItemEditModal from "../components/GlobalItemEditModal";
import GlobalItemModal from "../components/GlobalItemModal";
import MyGearTileCard from "../components/MyGearTileCard";
import MyGearListItem from "../components/MyGearListItem";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";

export default function MyGearView({ collapsed }) {
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { formatInput, unitLabel } = useWeightInput(unit);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState("name-asc");
  const [viewMode, setViewMode] = useState(() => {
    // Default to list on mobile, tiles on iPad and above (768px)
    return window.matchMedia("(min-width: 768px)").matches ? "tiles" : "list";
  });

  const [editingItem, setEditingItem] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch items
  const fetchItems = useCallback(async (signal) => {
    try {
      const { data } = await api.get("/my-gear/items", { signal });
      if (!signal?.aborted) {
        setItems(data || []);
      }
    } catch (err) {
      if (err.name === "CanceledError" || signal?.aborted) return;
      console.error("Failed to fetch my gear", err);
      toast.error(t("myGear.toast.loadFailed", "Failed to load gear"));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchItems(controller.signal);
    return () => controller.abort();
  }, [fetchItems]);

  // Listen for global item updates (e.g., when items are created from sidebar)
  useEffect(() => {
    const handleGlobalUpdated = () => fetchItems();
    window.addEventListener("global-items:updated", handleGlobalUpdated);
    return () => window.removeEventListener("global-items:updated", handleGlobalUpdated);
  }, [fetchItems]);

  // Derive unique categories for filter dropdown
  const categories = useMemo(() => {
    const cats = new Set();
    let hasUncategorized = false;
    items.forEach((item) => {
      if (item.catalogCategory) {
        cats.add(item.catalogCategory);
      } else {
        hasUncategorized = true;
      }
    });
    const sorted = Array.from(cats).sort();
    if (hasUncategorized) {
      sorted.push("Uncategorized");
    }
    return sorted;
  }, [items]);

  // Search/filter logic
  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredItems = useMemo(() => {
    let result = items;

    // Category filter
    if (categoryFilter !== "all") {
      if (categoryFilter === "Uncategorized") {
        result = result.filter((item) => !item.catalogCategory);
      } else {
        result = result.filter((item) => item.catalogCategory === categoryFilter);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const tokens = normalize(searchQuery).split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        result = result.filter((item) => {
          const searchable = normalize(
            [item.name, item.brand, item.itemType, item.description].join(" "),
          );
          return tokens.every((tok) => searchable.includes(tok));
        });
      }
    }

    // Sort
    const [field, direction] = sortOption.split("-");
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (field === "name") {
        cmp = (a.name || "").localeCompare(b.name || "");
      } else if (field === "weight") {
        cmp = (a.weight || 0) - (b.weight || 0);
      } else if (field === "date") {
        cmp = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      return direction === "desc" ? -cmp : cmp;
    });

    return sorted;
  }, [items, searchQuery, categoryFilter, sortOption]);

  // Handle delete
  const handleDelete = async (item) => {
    setActionLoading(item._id);
    try {
      await api.delete(`/global/items/${item._id}`);
      toast.success(t("myGear.toast.deleted", "Item deleted"));
      fetchItems();
      window.dispatchEvent(new CustomEvent("global-items:updated"));
    } catch (err) {
      console.error("Failed to delete item", err);
      toast.error(err?.response?.data?.message || t("myGear.toast.deleteFailed", "Failed to delete"));
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  // Escape key handler for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (confirmDelete) setConfirmDelete(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmDelete]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-neutral/10">
      {/* Header - single row on desktop, stacked on mobile */}
      <div className={`flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 ${collapsed ? "sm:pl-12" : ""}`}>
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          {/* Left: Title + Add button */}
          <div className="flex items-center gap-2">
            <h1 className="text-md text-primary whitespace-nowrap">
              {t("myGear.title", "My Gear")}
              <span className="ml-2 text-base font-normal text-primary/60">
                ({items.length})
              </span>
            </h1>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="p-1 text-secondary hover:text-secondary/80 rounded"
              title={t("myGear.actions.addItem", "Add item")}
            >
              <FaPlus className="text-sm" />
            </button>
          </div>

          {/* Center: Search */}
          <div className="relative flex-1 max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("myGear.searchPlaceholder", "Search gear...")}
              className="w-full pl-9 pr-3 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>

          {/* Right: Filter + Sort + View toggle */}
          <div className="flex items-center gap-2">
            {/* Category filter dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 border border-primary/30 rounded text-primary bg-base-100 text-sm cursor-pointer"
              >
                <option value="all">{t("myGear.filter.allCategories", "All Categories")}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <FaChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="appearance-none pl-3 pr-8 border border-primary/30 rounded text-primary bg-base-100 text-sm cursor-pointer"
              >
                <option value="name-asc">{t("myGear.sort.nameAsc", "Name A-Z")}</option>
                <option value="name-desc">{t("myGear.sort.nameDesc", "Name Z-A")}</option>
                <option value="weight-asc">{t("myGear.sort.weightAsc", "Weight ↑")}</option>
                <option value="weight-desc">{t("myGear.sort.weightDesc", "Weight ↓")}</option>
                <option value="date-desc">{t("myGear.sort.dateDesc", "Newest")}</option>
                <option value="date-asc">{t("myGear.sort.dateAsc", "Oldest")}</option>
              </select>
              <FaChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>

            {/* View mode toggle */}
            <div className="inline-flex rounded border border-primary/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-2 py-1.5 flex items-center text-primary hover:bg-primary/5 ${
                  viewMode === "list" ? "bg-primary/5" : "bg-base-100"
                }`}
                title={t("myGear.view.list", "List view")}
                aria-pressed={viewMode === "list"}
              >
                <FaList className="text-sm" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tiles")}
                className={`px-2 py-1.5 flex items-center text-primary hover:bg-primary/5 ${
                  viewMode === "tiles" ? "bg-primary/5" : "bg-base-100"
                }`}
                title={t("myGear.view.tiles", "Tile view")}
                aria-pressed={viewMode === "tiles"}
              >
                <FaThLarge className="text-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: stacked layout */}
        <div className={`sm:hidden space-y-2 ${collapsed ? "pl-8" : ""}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-md text-primary whitespace-nowrap">
                {t("myGear.title", "My Gear")}
                <span className="ml-2 text-base font-normal text-primary/60">
                  ({items.length})
                </span>
              </h1>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="p-1 text-secondary hover:text-secondary/80 rounded"
                title={t("myGear.actions.addItem", "Add item")}
              >
                <FaPlus className="text-sm" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="inline-flex rounded border border-primary/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-2 py-1 text-primary ${viewMode === "list" ? "bg-primary/5" : "bg-base-100"}`}
                  aria-pressed={viewMode === "list"}
                >
                  <FaList className="text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("tiles")}
                  className={`px-2 py-1 text-primary ${viewMode === "tiles" ? "bg-primary/5" : "bg-base-100"}`}
                  aria-pressed={viewMode === "tiles"}
                >
                  <FaThLarge className="text-sm" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile: Filter and Sort row */}
          <div className="flex items-center gap-2">
            {/* Category filter dropdown */}
            <div className="relative flex-1">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full appearance-none pl-2 pr-6 border border-primary/30 rounded text-primary bg-base-100 text-sm cursor-pointer"
              >
                <option value="all">{t("myGear.filter.allCategories", "All Categories")}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <FaChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>

            {/* Sort dropdown */}
            <div className="relative flex-1">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="w-full appearance-none pl-2 pr-6 border border-primary/30 rounded text-primary bg-base-100 text-sm cursor-pointer"
              >
                <option value="name-asc">{t("myGear.sort.nameAsc", "Name A-Z")}</option>
                <option value="name-desc">{t("myGear.sort.nameDesc", "Name Z-A")}</option>
                <option value="weight-asc">{t("myGear.sort.weightAsc", "Weight ↑")}</option>
                <option value="weight-desc">{t("myGear.sort.weightDesc", "Weight ↓")}</option>
                <option value="date-desc">{t("myGear.sort.dateDesc", "Newest")}</option>
                <option value="date-asc">{t("myGear.sort.dateAsc", "Oldest")}</option>
              </select>
              <FaChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>
          </div>

          {/* Search - full width on mobile */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("myGear.searchPlaceholder", "Search gear...")}
              className="w-full pl-9 pr-3 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-primary/60">
            {items.length === 0
              ? t(
                  "myGear.empty",
                  "You haven't added any gear yet. Import items from the catalog or create custom items.",
                )
              : t("myGear.noResults", "No items match your search.")}
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <MyGearListItem
                key={item._id}
                item={item}
                formatWeight={formatInput}
                unitLabel={unitLabel}
                t={t}
                actionLoading={actionLoading}
                onViewEdit={() => setEditingItem(item)}
                onDelete={() => setConfirmDelete(item)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8
           gap-3">
            {filteredItems.map((item) => (
              <MyGearTileCard
                key={item._id}
                item={item}
                formatWeight={formatInput}
                unitLabel={unitLabel}
                t={t}
                actionLoading={actionLoading}
                onViewEdit={() => setEditingItem(item)}
                onDelete={() => setConfirmDelete(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      {!loading && items.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-primary/10 bg-base-100 text-sm text-primary/60">
          {t("myGear.itemCount", "{{count}} item(s)", { count: items.length })}
          {filteredItems.length !== items.length && (
            <span>
              {" · "}
              {t("myGear.showing", "showing {{count}}", {
                count: filteredItems.length,
              })}
            </span>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <GlobalItemEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            fetchItems();
            setEditingItem(null);
          }}
          allowDelete={true}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <GlobalItemModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            fetchItems();
            setShowCreateModal(false);
            window.dispatchEvent(new CustomEvent("global-items:updated"));
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t("myGear.confirm.deleteTitle", "Delete Item")}
        message={t(
          "myGear.confirm.deleteMessage",
          "Are you sure you want to delete this item? This will also remove it from any gear lists.",
        )}
        confirmText={t("myGear.confirm.deleteConfirm", "Delete")}
        cancelText={t("actions.cancel")}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
