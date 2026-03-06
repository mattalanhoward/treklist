// client/src/pages/MyGearView.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FiSearch, FiGrid, FiList, FiPlus, FiChevronDown, FiCheckSquare, FiTrash2, FiX, FiEye, FiEyeOff } from "react-icons/fi";
import ConfirmDialog from "../components/ConfirmDialog";
import GlobalItemEditModal from "../components/GlobalItemEditModal";
import AddGearDrawer from "../components/AddGearDrawer";
import MyGearTileCard from "../components/MyGearTileCard";
import MyGearListItem from "../components/MyGearListItem";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import { useUserSettings } from "../contexts/UserSettings";

export default function MyGearView({ collapsed }) {
  const { setSidebarCollapsed } = useUserSettings();
  const { t } = useTranslation("common");
  const unit = useUnit();
  const { formatInput, unitLabel } = useWeightInput(unit);
  const searchInputRef = React.useRef(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState("name-asc");
  const [viewMode, setViewMode] = useState(() => {
    // Default to list on mobile, tiles on iPad and above (768px)
    return window.matchMedia("(min-width: 768px)").matches ? "tiles" : "list";
  });

  const [showImported, setShowImported] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDrawer, setShowDrawer] = useState(() =>
    window.matchMedia("(min-width: 1024px)").matches
  );

  const openDrawer = useCallback(() => {
    if (window.innerWidth < 1024) setSidebarCollapsed(true);
    setShowDrawer(true);
  }, [setSidebarCollapsed]);

  // Close drawer when sidebar expands on mobile
  useEffect(() => {
    const handler = () => { if (window.innerWidth < 1024) setShowDrawer(false); };
    window.addEventListener("sidebar:expanded", handler);
    return () => window.removeEventListener("sidebar:expanded", handler);
  }, []);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Fetch ALL items (including imported) — filter client-side so we can show hidden count
  const fetchItems = useCallback(async (signal) => {
    try {
      const { data } = await api.get("/my-gear/items?includeImported=true", { signal });
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

  const hiddenImportedCount = useMemo(
    () => (!showImported ? items.filter((i) => i.importedFromShare).length : 0),
    [items, showImported],
  );

  const filteredItems = useMemo(() => {
    let result = showImported ? items : items.filter((i) => !i.importedFromShare);

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
  }, [items, showImported, searchQuery, categoryFilter, sortOption]);

  // Handle delete
  const handleDelete = async (item) => {
    setActionLoading(item._id);
    try {
      await api.delete(`/global/items/${item._id}`);
      toast.success(t("myGear.toast.deleted", "Item deleted"));
      setItems((prev) => prev.filter((i) => i._id !== item._id));
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

  // Selection handlers
  const toggleSelection = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((item) => item._id)));
  }, [filteredItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Handle bulk delete
  const handleBulkDelete = async () => {
    setActionLoading("bulk");
    try {
      await Promise.all(
        [...selectedIds].map((id) => api.delete(`/global/items/${id}`))
      );
      toast.success(
        t("myGear.toast.bulkDeleted", "{{count}} items deleted", {
          count: selectedIds.size,
        })
      );
      setItems((prev) => prev.filter((i) => !selectedIds.has(i._id)));
      fetchItems();
      window.dispatchEvent(new CustomEvent("global-items:updated"));
      exitSelectionMode();
    } catch (err) {
      console.error("Failed to delete items", err);
      toast.error(
        err?.response?.data?.message ||
          t("myGear.toast.bulkDeleteFailed", "Failed to delete some items")
      );
    } finally {
      setActionLoading(null);
      setConfirmBulkDelete(false);
    }
  };

  // Escape key handler for modals and selection mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (confirmBulkDelete) setConfirmBulkDelete(false);
        else if (confirmDelete) setConfirmDelete(null);
        else if (selectionMode) exitSelectionMode();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmDelete, confirmBulkDelete, selectionMode, exitSelectionMode]);

  // Auto focus search input when view opens
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-neutral/10 transition-all duration-300 ${
      showDrawer ? "sm:w-[calc(100%-420px)]" : "w-full"
    }`}>
      {/* Header - single row on desktop, stacked on mobile */}
      <div className={`flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 ${collapsed ? "sm:pl-12" : ""}`}>
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          {/* Left: Title + Select button */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-primary whitespace-nowrap">
              {t("myGear.title", "My Gear")}
              <span className="ml-2 text-base font-normal text-primary/60">
                ({items.length})
              </span>
            </h1>
            <button
              type="button"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              className={`p-1 rounded ${selectionMode ? "text-secondary bg-secondary/10" : "text-secondary hover:text-secondary/80"}`}
              title={t("myGear.actions.select", "Select items")}
            >
              <FiCheckSquare className="text-sm" />
            </button>
          </div>

          {/* Center: Search */}
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("myGear.searchPlaceholder", "Search my gear...")}
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
              <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
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
              <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>

            {/* Show imported toggle */}
            <button
              type="button"
              onClick={() => setShowImported((v) => !v)}
              className={`relative p-1 rounded ${showImported ? "text-secondary bg-secondary/10" : "text-primary/50 hover:text-primary"}`}
              title={showImported ? t("myGear.actions.hideImported", "Hide items from shared lists") : t("myGear.actions.showImported", "Show items from shared lists")}
            >
              {showImported ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
              {!showImported && hiddenImportedCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                  {hiddenImportedCount > 9 ? "9+" : hiddenImportedCount}
                </span>
              )}
            </button>

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
                <FiList className="text-sm" />
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
                <FiGrid className="text-sm" />
              </button>
            </div>

            {/* Add / toggle drawer */}
            {!showDrawer && (
              <button
                type="button"
                onClick={openDrawer}
                className="p-1 text-secondary hover:text-secondary/80 rounded"
                title={t("myGear.actions.addItem", "Add item")}
              >
                <FiPlus className="text-sm" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop: Selection action bar */}
        {selectionMode && (
          <div className="hidden sm:flex items-center justify-between gap-4 mt-2 pt-2 border-t border-primary/10">
            <div className="flex items-center gap-3">
              <span className="text-sm text-primary/60">
                {selectedIds.size > 0
                  ? t("myGear.selected", "{{count}} selected", { count: selectedIds.size })
                  : t("myGear.selectItems", "Select items")}
              </span>
              {selectedIds.size === 0 && filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-sm text-secondary hover:text-secondary/80"
                >
                  {t("myGear.actions.selectAll", "Select all")}
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm text-secondary hover:text-secondary/80"
                >
                  {t("myGear.actions.clearSelection", "Clear")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={actionLoading === "bulk"}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-error/10 text-error hover:bg-error/20 rounded"
                >
                  <FiTrash2 className="text-xs" />
                  {t("myGear.actions.deleteSelected", "Delete")}
                </button>
              )}
              <button
                type="button"
                onClick={exitSelectionMode}
                className="flex items-center gap-1 px-2 py-1 text-sm text-primary/70 hover:text-primary rounded"
              >
                <FiX className="text-xs" />
                {t("actions.cancel", "Cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Mobile: stacked layout */}
        <div className={`sm:hidden space-y-2 ${collapsed ? "pl-8" : ""}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-primary whitespace-nowrap">
                {t("myGear.title", "My Gear")}
                <span className="ml-2 text-base font-normal text-primary/60">
                  ({items.length})
                </span>
              </h1>
              <button
                type="button"
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                className={`p-1 rounded ${selectionMode ? "text-secondary bg-secondary/10" : "text-secondary hover:text-secondary/80"}`}
                title={t("myGear.actions.select", "Select items")}
              >
                <FiCheckSquare className="text-sm" />
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
                  <FiList className="text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("tiles")}
                  className={`px-2 py-1 text-primary ${viewMode === "tiles" ? "bg-primary/5" : "bg-base-100"}`}
                  aria-pressed={viewMode === "tiles"}
                >
                  <FiGrid className="text-sm" />
                </button>
              </div>
              {/* Show imported toggle (mobile) */}
              <button
                type="button"
                onClick={() => setShowImported((v) => !v)}
                className={`relative p-1 rounded ${showImported ? "text-secondary bg-secondary/10" : "text-primary/50 hover:text-primary"}`}
                title={showImported ? t("myGear.actions.hideImported", "Hide items from shared lists") : t("myGear.actions.showImported", "Show items from shared lists")}
              >
                {showImported ? <FiEyeOff className="text-sm" /> : <FiEye className="text-sm" />}
                {!showImported && hiddenImportedCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                    {hiddenImportedCount > 9 ? "9+" : hiddenImportedCount}
                  </span>
                )}
              </button>

              {/* Add / toggle drawer */}
              {!showDrawer && (
                <button
                  type="button"
                  onClick={openDrawer}
                  className="p-1 text-secondary hover:text-secondary/80 rounded"
                  title={t("myGear.actions.addItem", "Add item")}
                >
                  <FiPlus className="text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile selection action bar */}
          {selectionMode && (
            <div className="flex items-center justify-between gap-2 py-1 border-t border-primary/10 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-primary/60">
                  {selectedIds.size > 0
                    ? t("myGear.selected", "{{count}} selected", { count: selectedIds.size })
                    : t("myGear.selectItems", "Select items")}
                </span>
                {selectedIds.size === 0 && filteredItems.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sm text-secondary hover:text-secondary/80"
                  >
                    {t("myGear.actions.selectAll", "Select all")}
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-sm text-secondary hover:text-secondary/80"
                  >
                    {t("myGear.actions.clearSelection", "Clear")}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(true)}
                    disabled={actionLoading === "bulk"}
                    className="p-1.5 text-error hover:bg-error/10 rounded"
                    title={t("myGear.actions.deleteSelected", "Delete selected")}
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-primary/70 hover:text-primary rounded"
                >
                  <FiX className="text-xs" />
                  {t("actions.cancel", "Cancel")}
                </button>
              </div>
            </div>
          )}

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
              <FiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
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
              <FiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>
          </div>

          {/* Search - full width on mobile */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("myGear.searchPlaceholder", "Search my gear...")}
              className="w-full pl-9 pr-3 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Add Gear Drawer */}
      <AddGearDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        onItemsChanged={fetchItems}
      />

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
              <div key={item._id}>
                <MyGearListItem
                  item={item}
                  formatWeight={formatInput}
                  unitLabel={unitLabel}
                  t={t}
                  actionLoading={actionLoading}
                  onViewEdit={() => setEditingItem(item)}
                  onDelete={() => setConfirmDelete(item)}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(item._id)}
                  onToggleSelect={() => toggleSelection(item._id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-3 ${showDrawer ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8"}`}>
            {filteredItems.map((item) => (
              <div key={item._id}>
                <MyGearTileCard
                  item={item}
                  formatWeight={formatInput}
                  unitLabel={unitLabel}
                  t={t}
                  actionLoading={actionLoading}
                  onViewEdit={() => setEditingItem(item)}
                  onDelete={() => setConfirmDelete(item)}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(item._id)}
                  onToggleSelect={() => toggleSelection(item._id)}
                />
              </div>
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

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        title={t("myGear.confirm.bulkDeleteTitle", "Delete Items")}
        message={t(
          "myGear.confirm.bulkDeleteMessage",
          "Are you sure you want to delete {{count}} items? This will also remove them from any gear lists.",
          { count: selectedIds.size }
        )}
        confirmText={t("myGear.confirm.bulkDeleteConfirm", "Delete All")}
        cancelText={t("actions.cancel")}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
