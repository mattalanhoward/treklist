// src/components/SwapItemModal.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../services/api";
import { FiX, FiSearch, FiRefreshCw } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { tItemType } from "../config/catalogTaxonomy";
import { useWeight } from "../hooks/useWeight";

function ItemRow({ item, isSelected, onClick }) {
  const { t } = useTranslation("common");
  const weightText = useWeight(item.weight);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-colors ${
        isSelected
          ? "bg-secondary/15 border border-secondary/40"
          : "hover:bg-primary/5 border border-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate">
          {item.brand && <span className="mr-1">{item.brand}</span>}
          {item.name}
        </div>
        <div className="text-xs text-primary/60 truncate">
          {tItemType(t, item.itemType) || "—"} · {weightText}
        </div>
      </div>
      {isSelected && (
        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-secondary" />
      )}
    </button>
  );
}

export default function SwapItemModal({ item, listId, catId, onClose, onSwapped }) {
  const { t } = useTranslation("common");
  const searchInputRef = useRef(null);

  const [myGear, setMyGear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  // Fetch all gear including items from shared lists
  useEffect(() => {
    api
      .get("/my-gear/items?includeImported=true")
      .then(({ data }) => setMyGear(data || []))
      .catch(() => toast.error(t("swapModal.toast.loadFailed", "Failed to load gear")))
      .finally(() => setLoading(false));
  }, [t]);

  // Autofocus search
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close on ESC
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function normalize(str = "") {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  const filteredItems = useMemo(() => {
    // Exclude the current item's globalItem from the list
    const currentGlobalId = String(item?.globalItem || item?._id || "");
    let results = myGear.filter((g) => String(g._id) !== currentGlobalId);

    if (searchQuery.trim()) {
      const tokens = normalize(searchQuery).split(/\s+/).filter(Boolean);
      results = results.filter((g) => {
        const searchable = normalize(
          [g.name, g.brand, g.itemType].join(" "),
        );
        return tokens.every((tok) => searchable.includes(tok));
      });
    }

    return results;
  }, [myGear, searchQuery, item]);

  const handleSwap = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const { data } = await api.patch(
        `/dashboard/${listId}/categories/${catId}/items/${item._id}/swap`,
        { newGlobalItemId: selectedId },
      );
      toast.success(t("swapModal.toast.swapped", "Item swapped"));
      onSwapped?.(data);
      onClose?.();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          t("swapModal.toast.swapFailed", "Failed to swap item"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-lg shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-primary/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {t("swapModal.title", "Swap Item")}
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

        {/* Search */}
        <div className="px-4 py-2 border-b border-primary/10 flex-shrink-0">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 text-sm" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("swapModal.searchPlaceholder", "Search my gear...")}
              className="w-full pl-9 pr-3 py-1.5 border border-primary/30 rounded text-primary bg-base-100 placeholder:text-primary/50 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-primary/50 text-center py-6">
              {searchQuery
                ? t("swapModal.noResults", "No matching items")
                : t("swapModal.noGear", "No items in My Gear")}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((g) => (
                <ItemRow
                  key={g._id}
                  item={g}
                  isSelected={selectedId === g._id}
                  onClick={() =>
                    setSelectedId((prev) => (prev === g._id ? null : g._id))
                  }
                />
              ))}
            </div>
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
            onClick={handleSwap}
            disabled={!selectedId || saving}
            className={`px-3 py-1.5 rounded bg-secondary text-white text-sm flex items-center gap-1.5 ${
              !selectedId || saving ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/80"
            }`}
          >
            <FiRefreshCw className={`text-xs ${saving ? "animate-spin" : ""}`} />
            {saving
              ? t("swapModal.swapping", "Swapping...")
              : t("swapModal.confirm", "Swap")}
          </button>
        </div>
      </div>
    </div>
  );
}
