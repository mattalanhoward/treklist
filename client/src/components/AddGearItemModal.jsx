// src/components/AddGearItemModal.jsx
import { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import SmartItemSearch from "./SmartItemSearch";

export default function AddGearItemModal({ listId, categoryId, onClose, onAdded }) {
  const { t } = useTranslation("common");
  const [existingItems, setExistingItems] = useState([]);

  // Fetch all items already in this list for dup-check display
  useEffect(() => {
    (async () => {
      try {
        const { data: cats } = await api.get(`/dashboard/${listId}/categories`);
        const arrays = await Promise.all(
          cats.map((cat) =>
            api
              .get(`/dashboard/${listId}/categories/${cat._id}/items`)
              .then((r) => r.data || []),
          ),
        );
        setExistingItems(arrays.flat());
      } catch {
        // non-fatal — dup indicators just won't show
      }
    })();
  }, [listId]);

  const existingGlobalIds = useMemo(
    () => new Set(existingItems.map((it) => String(it.globalItem || it._id))),
    [existingItems],
  );

  const computeStartPos = () => {
    const inCat = existingItems.filter(
      (it) => String(it.category) === String(categoryId),
    );
    const max = inCat.length
      ? Math.max(...inCat.map((it) => (Number.isFinite(it.position) ? it.position : -1)))
      : -1;
    return max + 1;
  };

  const addGlobalItemsToList = async (globalItems) => {
    const startPos = computeStartPos();
    await Promise.all(
      globalItems.map((gi, idx) =>
        api.post(`/dashboard/${listId}/categories/${categoryId}/items`, {
          globalItem: gi._id,
          productId: gi.productId || null,
          brand: gi.brand,
          itemType: gi.itemType,
          name: gi.name,
          description: gi.description,
          weight: gi.weight,
          link: gi.link,
          imageUrls: gi.imageUrls || [],
          worn: gi.worn,
          consumable: gi.consumable,
          quantity: 1,
          position: startPos + idx,
        }),
      ),
    );
  };

  const handleConfirm = async (selection) => {
    try {
      if (selection.source === "myGear") {
        await addGlobalItemsToList(selection.globalItems);
      } else if (selection.source === "catalog") {
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: selection.catalogIds,
        });
        await addGlobalItemsToList(data.items || []);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
      } else if (selection.source === "newItem") {
        const f = selection.fields;
        const payload = { name: f.name };
        if (f.brand) payload.brand = f.brand;
        if (f.catalogCategory) payload.catalogCategory = f.catalogCategory;
        if (f.itemType) payload.itemType = f.itemType;
        if (typeof f.weight === "number") payload.weight = f.weight;
        if (f.description) payload.description = f.description;
        if (f.link) payload.link = f.link;
        if (f.imageUrl) payload.imageUrls = [f.imageUrl];
        const { data: gi } = await api.post("/global/items", payload);
        await addGlobalItemsToList([gi]);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
      }
      onAdded?.();
      onClose?.();
    } catch (err) {
      console.error("Error adding items:", err);
      toast.error(t("addGearItemModal.toasts.addFailed", "Failed to add item"));
      throw err; // re-throw so SmartItemSearch resets confirming state
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 sm:rounded-xl shadow-2xl sm:max-w-2xl w-full sm:mx-4 flex flex-col modal-mobile-h sm:h-auto sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-primary/10 flex-shrink-0">
          <h2 className="text-lg font-semibold text-primary">
            {t("addGearItemModal.title", "Add Gear")}
          </h2>
          <button
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 sm:h-[480px] sm:flex-none overflow-hidden flex flex-col">
          <SmartItemSearch
            multiSelect
            showMyGear
            existingGlobalIds={existingGlobalIds}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
