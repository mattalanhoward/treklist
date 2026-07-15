// src/components/SwapItemModal.jsx
// Swap an item on a gear list for another catalog / My Gear / custom item.
// Uses the shared two-pane add-gear surface in single-select swap mode: no
// checkboxes, no batch bar — the pane/sheet "Swap for this" button commits and
// replaces the source gear item (the server keeps category, quantity, and
// worn/consumable flags).
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import SmartItemSearch from "./SmartItemSearch";
import useHistoryDismiss from "../hooks/useHistoryDismiss";

export default function SwapItemModal({ item, listId, catId, onClose, onSwapped }) {
  const { t } = useTranslation("common");

  // Back gesture / Android back closes the takeover instead of leaving the app.
  useHistoryDismiss(true, onClose);

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
          variantSelections: selection.variantSelections,
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
        if (f.imageUrl) payload.imageUrls = [f.imageUrl];
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
      className="fixed inset-0 z-[70] flex justify-center sm:items-center sm:bg-black/40 sm:backdrop-blur-[1px]"
      onClick={onClose}
    >
      {/* Mobile: full-screen takeover (100dvh). Desktop: centered card. */}
      <div
        className="bg-base-100 shadow-2xl w-full h-d-screen flex flex-col sm:rounded-xl sm:w-[92vw] sm:max-w-[960px] sm:mx-4 sm:h-[85vh] sm:max-h-[800px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-primary/10 flex-shrink-0"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="min-w-0">
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
            className="text-error hover:text-error/80 -mr-1 p-1 ml-2"
            aria-label={t("actions.close", "Close")}
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <SmartItemSearch
            multiSelect={false}
            swapMode
            showMyGear
            tabLayout
            twoPane
            excludeGlobalItemId={excludeGlobalItemId}
            confirmLabels={{
              create: t("swapModal.actions.createAndSwap", "Create & Swap"),
            }}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
