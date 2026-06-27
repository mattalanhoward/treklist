// src/components/GlobalItemModal.jsx
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import SmartItemSearch from "./SmartItemSearch";

export default function GlobalItemModal({ onClose, onCreated }) {
  const { t } = useTranslation("common");

  const handleConfirm = async (selection) => {
    try {
      if (selection.source === "catalog") {
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: selection.catalogIds,
          variantSelections: selection.variantSelections,
        });
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        onCreated?.(data.items);
        onClose?.();
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
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        onCreated?.(created);
        onClose?.();
      }
    } catch (err) {
      toast.error(t("globalItemModal.toast.saveFailed", "Failed to save item"));
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
        <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-primary/10 flex-shrink-0">
          <h2 className="text-lg font-semibold text-primary">
            {t("globalItemModal.title", "Add Gear")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label={t("actions.close")}
          >
            <FiX />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <SmartItemSearch
            multiSelect
            showMyGear={false}
            tabLayout
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
