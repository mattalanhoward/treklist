// src/components/AddGearDrawer.jsx
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import api from "../services/api";
import SmartItemSearch from "./SmartItemSearch";

export default function AddGearDrawer({ isOpen, onClose, onItemsChanged }) {
  const { t } = useTranslation("common");

  if (!isOpen) return null;

  const handleConfirm = async (selection) => {
    try {
      if (selection.source === "catalog") {
        await api.post("/global/items/from-catalog/bulk", {
          ids: selection.catalogIds,
          variantSelections: selection.variantSelections,
        });
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
        await api.post("/global/items", payload);
      }
      window.dispatchEvent(new CustomEvent("global-items:updated"));
      onItemsChanged?.();
      onClose?.();
    } catch (err) {
      toast.error(t("globalItemModal.toast.saveFailed", "Failed to save item"));
      throw err;
    }
  };

  return (
    <>
      {/* Mobile: full-screen overlay */}
      <div className="sm:hidden fixed top-[var(--topbar-h,48px)] inset-x-0 bottom-0 bg-base-100 z-[70] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10 flex-shrink-0">
          <h2 className="text-lg font-semibold text-primary">
            {t("globalItemModal.title", "Add Gear")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-error hover:text-error/80"
            aria-label={t("actions.close")}
          >
            <FiX className="text-lg" />
          </button>
        </div>
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

      {/* Desktop: slide-in drawer from right */}
      <div
        className={`hidden sm:fixed sm:top-12 sm:bottom-0 sm:right-0 sm:flex sm:flex-col w-[520px] bg-base-100 border-l border-primary/20 shadow-xl transition-transform duration-300 ease-out z-40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-primary/10 flex-shrink-0">
          <span className="text-lg font-semibold text-primary">
            {t("globalItemModal.title", "Add Gear")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-error hover:text-error/80"
            aria-label={t("actions.close")}
          >
            <FiX />
          </button>
        </div>
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
    </>
  );
}
