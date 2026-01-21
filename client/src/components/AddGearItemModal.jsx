// src/components/AddGearItemModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function AddGearItemModal({
  listId,
  categoryId,
  onClose,
  onAdded,
}) {
  const { t } = useTranslation("common");

  // 1) Store all global items (fetched once on mount)
  const [allResults, setAllResults] = useState([]);
  // 2) searchQuery (initially empty string)
  const [searchQuery, setSearchQuery] = useState("");
  // 3) Which IDs are currently checked
  const [selectedIds, setSelectedIds] = useState(new Set());
  // 4) Quantity for all selected items
  const [quantity, setQuantity] = useState(1);
  // 5) Loading flag while saving
  const [saving, setSaving] = useState(false);

  // ───────────────────────────────────────────────────────
  // Fetch categories + existing items across entire list for dup-check
  const [existingItems, setExistingItems] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        // 1) get all categories
        const { data: cats } = await api.get(`/dashboard/${listId}/categories`);
        // 2) fetch items for each category
        const itemArrays = await Promise.all(
          cats.map((cat) =>
            api
              .get(`/dashboard/${listId}/categories/${cat._id}/items`)
              .then((res) => res.data || [])
          )
        );
        // flatten
        setExistingItems(itemArrays.flat());
      } catch (err) {
        console.error("Error fetching existing items:", err);
      }
    })();
  }, [listId]);

  // Fetch all global items once (no search param)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/global/items");
        setAllResults(data || []);
      } catch (err) {
        console.error("Error fetching global items:", err);
      }
    })();
  }, []);

  function normalize(str = "") {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .trim();
  }

  function toSearchText(item) {
    // add/remove fields here as your GlobalItem shape supports
    const parts = [
      item.name,
      item.brand,
      item.itemType,
      item.category,
      item.subcategory,
      item.description,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ];
    return normalize(parts.filter(Boolean).join(" "));
  }

  const filteredResults = useMemo(() => {
    const q = normalize(searchQuery);
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const filtered =
      tokens.length === 0
        ? allResults
        : allResults.filter((item) => {
            const hay = toSearchText(item);
            // require every token to match somewhere
            return tokens.every((tok) => hay.includes(tok));
          });

    return [...filtered].sort((a, b) =>
      normalize(a.name).localeCompare(normalize(b.name))
    );
  }, [allResults, searchQuery]);

  // Toggle a single ID in the Set of selectedIds
  const toggleCheckbox = (itemId) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(itemId)) copy.delete(itemId);
      else copy.add(itemId);
      return copy;
    });
  };

  // ───────────────────────────────────────────────────────
  // Save all selected items in parallel
  const handleSave = async () => {
    if (selectedIds.size === 0) {
      return toast.error(t("addGearItemModal.toasts.selectAtLeastOne"));
    }

    // DUP CHECK
    const existingGlobalIds = new Set(
      existingItems.map((it) => it.globalItem || it._id)
    );
    const dup = Array.from(selectedIds).filter((id) =>
      existingGlobalIds.has(id)
    );
    if (dup.length > 0) {
      return toast.error(t("addGearItemModal.toasts.alreadyInList"));
    }

    setSaving(true);
    try {
      // Compute the starting position at the end of THIS category
      const itemsInThisCat = existingItems.filter(
        (it) => String(it.category) === String(categoryId)
      );
      const maxPos = itemsInThisCat.length
        ? Math.max(
            ...itemsInThisCat.map((it) =>
              Number.isFinite(it.position) ? it.position : -1
            )
          )
        : -1;
      const startPos = maxPos + 1;

      const selected = Array.from(selectedIds); // preserves insertion order

      await Promise.all(
        selected.map((itemId, idx) => {
          const sel = allResults.find((i) => i._id === itemId);
          if (!sel) return Promise.resolve();
          return api.post(
            `/dashboard/${listId}/categories/${categoryId}/items`,
            {
              globalItem: sel._id,
              brand: sel.brand,
              itemType: sel.itemType,
              name: sel.name,
              description: sel.description,
              weight: sel.weight,
              link: sel.link,
              worn: sel.worn,
              consumable: sel.consumable,
              quantity,
              position: startPos + idx, // <-- append to end
            }
          );
        })
      );

      toast.success(t("addGearItemModal.toasts.addSuccess"));
      onAdded();
      onClose();
    } catch (err) {
      console.error("Error adding items:", err);
      toast.error(t("addGearItemModal.toasts.addFailed"));
    } finally {
      setSaving(false);
    }
  };

  // Helper set for quick lookup in render
  const existingGlobalIds = new Set(
    existingItems.map((it) => it.globalItem || it._id)
  );

  const addButtonLabel = saving
    ? t("addGearItemModal.buttons.adding")
    : t("addGearItemModal.buttons.add", { count: selectedIds.size });

  return (
    <div className="fixed inset-0 bg-neutral bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-xl shadow-2xl max-w-lg w-full sm:h-[80vh] h-[70vh] p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            {t("addGearItemModal.title")}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-error hover:text-error/80"
            aria-label={t("addGearItemModal.a11y.close")}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center w-full pb-4">
          <input
            type="text"
            placeholder={t("addGearItemModal.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border border-primary rounded px-2 py-1 text-primary placeholder:text-primary/50 bg-white"
          />
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {filteredResults.length > 0 ? (
              filteredResults.map((item) => {
                const disabled = existingGlobalIds.has(item._id);
                return (
                  <li
                    key={item._id}
                    className={`flex items-center px-2 py-1 rounded bg-neutral/20 border border-primary/20 mb-1 ${
                      disabled
                        ? "opacity-50 cursor-default"
                        : "hover:bg-primary/10 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item._id)}
                      onChange={() => !disabled && toggleCheckbox(item._id)}
                      disabled={disabled}
                      className="mr-3 h-4 w-4 text-secondary border-primary rounded focus:ring-secondary"
                    />
                    <div
                      className="flex-1 select-none"
                      onClick={() => !disabled && toggleCheckbox(item._id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-primary">
                            {item.name}
                          </div>
                          <div className="text-sm text-primary">
                            {item.brand} — {item.itemType}
                          </div>
                        </div>
                        {disabled && (
                          <span className="text-red-500 text-xs ml-2">
                            {t("addGearItemModal.badges.added")}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="px-2 py-1 text-primary/80">
                {t("addGearItemModal.empty")}
              </li>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-2 py-1 bg-base-100 text-primary rounded"
          >
            {t("actions.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.size === 0}
            className={`px-2 py-1 bg-primary text-base-100 rounded flex items-center ${
              saving || selectedIds.size === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-primary/80"
            }`}
          >
            {addButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
