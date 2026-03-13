// client/src/pages/MyGearView.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FiSearch, FiGrid, FiList, FiPlus, FiChevronDown, FiCheckSquare, FiTrash2, FiX } from "react-icons/fi";
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
  const [viewMode, setViewMode] = useState("tiles");

  const [gearTab, setGearTab] = useState("all"); // "all" | "owned" | "wishlist" | "shared"
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);

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

  const fetchWishlistItems = useCallback(async () => {
    setWishlistLoading(true);
    try {
      const { data } = await api.get("/wishlist/items");
      setWishlistItems(data || []);
    } catch (err) {
      console.error("Failed to fetch wishlist", err);
    } finally {
      setWishlistLoading(false);
    }
  }, []);

  // Fetch on mount so the count is correct even before visiting the wishlist tab
  useEffect(() => {
    fetchWishlistItems();
  }, [fetchWishlistItems]);

  useEffect(() => {
    if (gearTab === "wishlist") fetchWishlistItems();
  }, [gearTab, fetchWishlistItems]);

  // Listen for global item updates (e.g., when items are created from sidebar)
  useEffect(() => {
    const handleGlobalUpdated = () => {
      fetchItems();
      fetchWishlistItems(); // always keep wishlist in sync so "All Gear" tab stays current
    };
    window.addEventListener("global-items:updated", handleGlobalUpdated);
    return () => window.removeEventListener("global-items:updated", handleGlobalUpdated);
  }, [fetchItems, fetchWishlistItems]);

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
    let result = [...items];

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

    return result;
  }, [items, searchQuery, categoryFilter]);

  const filteredOwnedItems = useMemo(
    () => filteredItems.filter((i) => !i.importedFromShare),
    [filteredItems],
  );

  const filteredSharedItems = useMemo(
    () => filteredItems.filter((i) => i.importedFromShare),
    [filteredItems],
  );

  // Toggle wishlist status on a GlobalItem
  const handleToggleWishlist = async (item) => {
    const newStatus = item.status === "wishlisted" ? "owned" : "wishlisted";
    try {
      await api.patch(`/global/items/${item._id}`, { status: newStatus });
      // Move the item between lists — avoids duplicate in the "All Gear" combined view
      if (newStatus === "wishlisted") {
        setItems((prev) => prev.filter((i) => i._id !== item._id));
        setWishlistItems((prev) => [...prev, { ...item, status: newStatus }]);
      } else {
        setWishlistItems((prev) => prev.filter((i) => i._id !== item._id));
        setItems((prev) => [{ ...item, status: newStatus }, ...prev]);
      }
      window.dispatchEvent(new CustomEvent("global-items:updated"));
    } catch (err) {
      console.error("Failed to toggle wishlist", err);
      toast.error(t("wishlist.toasts.toggleFailed", "Failed to update wishlist"));
    }
  };

  const filteredWishlistItems = useMemo(() => {
    let result = [...wishlistItems];
    if (searchQuery.trim()) {
      const tokens = normalize(searchQuery).split(/\s+/).filter(Boolean);
      result = result.filter((item) => {
        const searchable = normalize([item.name, item.brand, item.itemType].join(" "));
        return tokens.every((tok) => searchable.includes(tok));
      });
    }
    return result;
  }, [wishlistItems, searchQuery]);

  const filteredAllItems = useMemo(() => {
    return [...filteredItems, ...filteredWishlistItems];
  }, [filteredItems, filteredWishlistItems]);

  const displayItems = useMemo(() => {
    if (gearTab === "wishlist") return filteredWishlistItems;
    if (gearTab === "owned") return filteredOwnedItems;
    if (gearTab === "shared") return filteredSharedItems;
    return filteredAllItems; // "all"
  }, [gearTab, filteredWishlistItems, filteredOwnedItems, filteredSharedItems, filteredAllItems]);

  const displayLoading = (gearTab === "wishlist" || gearTab === "all") ? (loading || wishlistLoading) : loading;

  const groupedItems = useMemo(() => {
    const groups = new Map();
    displayItems.forEach((item) => {
      const cat = item.catalogCategory || "Uncategorized";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(item);
    });
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    return sorted.map(([category, items]) => ({ category, items }));
  }, [displayItems]);

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
    setSelectedIds(new Set(displayItems.map((item) => item._id)));
  }, [displayItems]);

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

  // Auto focus search input when view opens (desktop only)
  useEffect(() => {
    if (window.innerWidth >= 640) searchInputRef.current?.focus();
  }, []);

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-neutral/10 transition-all duration-300 ${
      showDrawer ? "sm:w-[calc(100%-420px)]" : "w-full"
    }`}>
      {/* Header - single row on desktop, stacked on mobile */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100">
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-primary whitespace-nowrap">
              {t("myGear.title", "My Gear")}
            </h1>
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

            {/* Select items */}
            <button
              type="button"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              className={`p-1 rounded ${selectionMode ? "text-secondary bg-secondary/10" : "text-primary/50 hover:text-primary"}`}
              title={t("myGear.actions.select", "Select items")}
            >
              <FiCheckSquare className="text-sm" />
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

        {/* Tab bar */}
        <div className="hidden sm:flex gap-4 mt-2 pt-2 border-t border-primary/10">
          {[
            { key: "all", label: t("myGear.tabs.all", "All Gear"), count: items.length + wishlistItems.length },
            { key: "owned", label: t("myGear.tabs.owned", "My Gear"), count: items.filter(i => !i.importedFromShare).length },
            { key: "wishlist", label: t("myGear.tabs.wishlist", "Wishlist"), count: wishlistItems.length },
            { key: "shared", label: t("myGear.tabs.shared", "From Packs"), count: items.filter(i => i.importedFromShare).length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setGearTab(key)}
              className={`text-sm font-medium pb-1 transition-colors ${gearTab === key ? "border-b-2 border-secondary text-secondary" : "text-primary/60 hover:text-primary"}`}
            >
              {label}
              <span className="ml-1.5 text-xs text-primary/40">({count})</span>
            </button>
          ))}
        </div>
        <p className="hidden sm:block text-xs text-primary/50 mt-1">
          {t(`myGear.tabs.desc.${gearTab}`)}
        </p>

        {/* Desktop: Selection action bar */}
        {selectionMode && (
          <div className="hidden sm:flex items-center justify-between gap-4 mt-2 pt-2 border-t border-primary/10">
            <div className="flex items-center gap-3">
              <span className="text-sm text-primary/60">
                {selectedIds.size > 0
                  ? t("myGear.selected", "{{count}} selected", { count: selectedIds.size })
                  : t("myGear.selectItems", "Select items")}
              </span>
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
              {filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-sm text-secondary hover:text-secondary/80"
                >
                  {t("myGear.actions.selectAll", "Select all")}
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
        <div className="sm:hidden space-y-2">
          <div className={`flex items-center justify-between gap-4 ${collapsed ? "pl-8" : ""}`}>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-primary whitespace-nowrap">
                {t("myGear.title", "My Gear")}
              </h1>
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
              {/* Select items */}
              <button
                type="button"
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                className={`p-1 rounded ${selectionMode ? "text-secondary bg-secondary/10" : "text-primary/50 hover:text-primary"}`}
                title={t("myGear.actions.select", "Select items")}
              >
                <FiCheckSquare className="text-sm" />
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
                {filteredItems.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sm text-secondary hover:text-secondary/80"
                  >
                    {t("myGear.actions.selectAll", "Select all")}
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

          </div>

          {/* Mobile: tab dropdown */}
          <div className="pt-1 border-t border-primary/10">
            <div className="relative">
              <select
                value={gearTab}
                onChange={(e) => setGearTab(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 border border-primary/30 rounded text-primary bg-base-100 text-sm cursor-pointer"
              >
                <option value="all">{t("myGear.tabs.all", "All Gear")} ({items.length + wishlistItems.length})</option>
                <option value="owned">{t("myGear.tabs.owned", "My Gear")} ({items.filter(i => !i.importedFromShare).length})</option>
                <option value="wishlist">{t("myGear.tabs.wishlist", "Wishlist")} ({wishlistItems.length})</option>
                <option value="shared">{t("myGear.tabs.shared", "From Packs")} ({items.filter(i => i.importedFromShare).length})</option>
              </select>
              <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none text-xs" />
            </div>
            <p className="text-xs text-primary/50 mt-0.5">
              {t(`myGear.tabs.desc.${gearTab}`)}
            </p>
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
        {displayLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-8 text-primary/60">
            {gearTab === "wishlist"
              ? t("myGear.wishlistEmpty", "No items on your wishlist yet. Star items from your gear lists to add them here.")
              : gearTab === "shared"
                ? t("myGear.sharedEmpty", "No items from packs yet. Browse shared packing lists and import items to see them here.")
                : gearTab === "owned"
                  ? (items.filter(i => !i.importedFromShare).length === 0
                      ? t("myGear.empty", "You haven't added any gear yet. Import items from the catalog or create custom items.")
                      : t("myGear.noResults", "No items match your search."))
                  : (items.length === 0
                      ? t("myGear.empty", "You haven't added any gear yet. Import items from the catalog or create custom items.")
                      : t("myGear.noResults", "No items match your search."))}
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-4">
            {groupedItems.map(({ category, items: groupItems }) => (
              <div key={category}>
                {groupedItems.length > 1 && (
                  <div className="text-sm font-semibold text-primary/50 uppercase tracking-wider px-1 mb-1.5">{category}</div>
                )}
                <div className="space-y-2">
                  {groupItems.map((item) => (
                    <MyGearListItem
                      key={item._id}
                      item={item}
                      formatWeight={formatInput}
                      unitLabel={unitLabel}
                      t={t}
                      actionLoading={actionLoading}
                      onViewEdit={() => setEditingItem(item)}
                      onDelete={() => setConfirmDelete(item)}
                      onToggleWishlist={() => handleToggleWishlist(item)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(item._id)}
                      onToggleSelect={() => toggleSelection(item._id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map(({ category, items: groupItems }) => (
              <div key={category}>
                {groupedItems.length > 1 && (
                  <div className="text-sm font-semibold text-primary/50 uppercase tracking-wider px-1 mb-2">{category}</div>
                )}
                <div className={`grid gap-3 ${showDrawer ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8"}`}>
                  {groupItems.map((item) => (
                    <MyGearTileCard
                      key={item._id}
                      item={item}
                      formatWeight={formatInput}
                      unitLabel={unitLabel}
                      t={t}
                      actionLoading={actionLoading}
                      onViewEdit={() => setEditingItem(item)}
                      onDelete={() => setConfirmDelete(item)}
                      onToggleWishlist={() => handleToggleWishlist(item)}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(item._id)}
                      onToggleSelect={() => toggleSelection(item._id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      {!loading && items.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-primary/10 bg-base-100 text-sm text-primary/60">
          {t("myGear.itemCount", "{{count}} item(s)", { count: displayItems.length })}
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
