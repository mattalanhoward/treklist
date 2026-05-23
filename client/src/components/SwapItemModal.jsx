// src/components/SwapItemModal.jsx
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import SmartItemSearch from "./SmartItemSearch";

export default function SwapItemModal({ item, listId, catId, onClose, onSwapped }) {
  const { t } = useTranslation("common");

  const excludeGlobalItemId = String(item?.globalItem || item?._id || "");

  const doSwap = async (newGlobalItemId) => {
    const { data } = await api.patch(
      `/dashboard/${listId}/categories/${catId}/items/${item._id}/swap`,
      { newGlobalItemId },
    );
    toast.success(t("swapModal.toast.swapped", "Item swapped"));
    onSwapped?.(data);
    onClose?.();
  };

  const handleConfirm = async (selection) => {
    try {
      if (selection.source === "myGear") {
        await doSwap(String(selection.globalItems[0]._id));
      } else if (selection.source === "catalog") {
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: selection.catalogIds,
        });
        const gi = data.items?.[0];
        if (!gi) throw new Error("Import failed");
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        await doSwap(String(gi._id));
      } else if (selection.source === "newItem") {
        const f = selection.fields;
        const payload = { name: f.name };
        if (f.brand) payload.brand = f.brand;
        if (f.itemType) payload.itemType = f.itemType;
        if (f.catalogCategory) payload.catalogCategory = f.catalogCategory;
        if (typeof f.weight === "number") payload.weight = f.weight;
        if (f.description) payload.description = f.description;
        if (f.link) payload.link = f.link;
        const { data: gi } = await api.post("/global/items", payload);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        await doSwap(String(gi._id));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t("swapModal.toast.swapFailed", "Swap failed"));
      throw err;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 sm:rounded-xl shadow-2xl w-full sm:w-[90vw] sm:max-w-[720px] sm:mx-4 flex flex-col modal-mobile-h sm:h-[85vh] sm:max-h-[800px]"
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

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <SmartItemSearch
            multiSelect={false}
            showMyGear
            tabLayout
            excludeGlobalItemId={excludeGlobalItemId}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
