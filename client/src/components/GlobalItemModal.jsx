// src/components/GlobalItemModal.jsx
// Add gear to the My Gear library (catalog import or custom item). Uses the
// shared two-pane add-gear surface: desktop master–detail, mobile full-screen
// takeover + bottom-sheet preview.
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import SmartItemSearch from "./SmartItemSearch";
import useHistoryDismiss from "../hooks/useHistoryDismiss";

export default function GlobalItemModal({ onClose, onCreated }) {
  const { t } = useTranslation("common");

  // Back gesture / Android back closes the takeover instead of leaving the app.
  useHistoryDismiss(true, onClose);

  // keepOpen (mobile sheet single-add): create the item but stay in the
  // takeover for more adds (mobile build contract). Otherwise it's a batch
  // commit that closes the modal.
  const handleConfirm = async (selection, { keepOpen = false } = {}) => {
    try {
      let createdItems = null;
      if (selection.source === "catalog") {
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: selection.catalogIds,
          variantSelections: selection.variantSelections,
        });
        createdItems = data.items;
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
        const { data: created } = await api.post("/global/items", payload);
        createdItems = created;
      }
      window.dispatchEvent(new CustomEvent("global-items:updated"));
      if (keepOpen) return;
      onCreated?.(createdItems);
      onClose?.();
    } catch (err) {
      toast.error(t("globalItemModal.toast.saveFailed", "Failed to save item"));
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
          className="flex justify-between items-center px-5 pt-4 pb-2 flex-shrink-0"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <h2 className="text-lg font-semibold text-primary">
            {t("globalItemModal.title", "Add Gear")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80 -mr-1 p-1"
            aria-label={t("actions.close", "Close")}
          >
            <FiX size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <SmartItemSearch
            multiSelect
            showMyGear={false}
            tabLayout
            twoPane
            destinationLabel={t("smartItemSearch.myGear", "My Gear")}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
