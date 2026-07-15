// src/components/AddGearItemModal.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";
import { FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import SmartItemSearch from "./SmartItemSearch";
import useHistoryDismiss from "../hooks/useHistoryDismiss";

export default function AddGearItemModal({ listId, categoryId, categoryName, onClose, onAdded }) {
  const { t } = useTranslation("common");
  const [existingItems, setExistingItems] = useState([]);

  // Back gesture / Android back closes the takeover instead of leaving the app.
  useHistoryDismiss(true, onClose);

  // Fetch all items already in this list for dup-check display
  const refreshExisting = useCallback(async () => {
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
  }, [listId]);

  useEffect(() => {
    refreshExisting();
  }, [refreshExisting]);

  const existingGlobalIds = useMemo(
    () => new Set(existingItems.map((it) => String(it.globalItem || it._id))),
    [existingItems],
  );

  // Catalog rows match on productId (catalog item id), not globalItem id.
  // productId may be null on older items, so detection is best-effort.
  const existingProductIds = useMemo(
    () => new Set(existingItems.map((it) => it.productId).filter(Boolean).map(String)),
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

  // sizeUnsetProductIds: catalog ids batch-added without a chosen fit — the
  // resulting gear rows are flagged "size not set" (add-gear decision 14).
  const addGlobalItemsToList = async (globalItems, sizeUnsetProductIds = null) => {
    const startPos = computeStartPos();
    const created = await Promise.all(
      globalItems.map((gi, idx) =>
        api
          .post(`/dashboard/${listId}/categories/${categoryId}/items`, {
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
            sizeUnset: Boolean(sizeUnsetProductIds?.has(String(gi.productId))),
          })
          .then((r) => r.data),
      ),
    );
    return created;
  };

  // Batch commit closes the takeover with a toast + Undo (never a confirm
  // dialog). Undo deletes the just-created gear items (mobile build contract).
  const showUndoToast = (createdItems) => {
    const ids = createdItems.map((it) => it?._id).filter(Boolean);
    const count = createdItems.length;
    const dest = categoryName || t("addGearItemModal.destFallback", "list");
    toast(
      (tst) => (
        <span className="flex items-center gap-3">
          <span>
            {t("addGearItemModal.toasts.addedN", "Added {{count}} to {{dest}}", { count, dest })}
          </span>
          <button
            type="button"
            className="font-semibold text-secondary underline underline-offset-2"
            onClick={async () => {
              toast.dismiss(tst.id);
              try {
                await Promise.all(
                  ids.map((id) =>
                    api.delete(`/dashboard/${listId}/categories/${categoryId}/items/${id}`),
                  ),
                );
                onAdded?.();
                window.dispatchEvent(new CustomEvent("global-items:updated"));
                toast.success(t("addGearItemModal.toasts.undone", "Removed"));
              } catch {
                toast.error(t("addGearItemModal.toasts.undoFailed", "Couldn't undo"));
              }
            }}
          >
            {t("actions.undo", "Undo")}
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };

  // keepOpen (mobile sheet single-add): add the item but stay in the takeover
  // and refresh dup indicators, no toast/undo. Otherwise it's a batch commit.
  const handleConfirm = async (selection, { keepOpen = false } = {}) => {
    try {
      let created = [];
      if (selection.source === "myGear") {
        created = await addGlobalItemsToList(selection.globalItems);
      } else if (selection.source === "catalog") {
        const { data } = await api.post("/global/items/from-catalog/bulk", {
          ids: selection.catalogIds,
          variantSelections: selection.variantSelections,
        });
        const sizeUnsetProductIds = new Set(
          (selection.sizeUnset || []).map(String),
        );
        created = await addGlobalItemsToList(data.items || [], sizeUnsetProductIds);
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
        created = await addGlobalItemsToList([gi]);
        window.dispatchEvent(new CustomEvent("global-items:updated"));
      }
      onAdded?.();
      if (keepOpen) {
        // Stay open; keep dup indicators + item positions in sync for more adds.
        refreshExisting();
      } else {
        onClose?.();
        if (created.length) showUndoToast(created);
      }
    } catch (err) {
      console.error("Error adding items:", err);
      toast.error(t("addGearItemModal.toasts.addFailed", "Failed to add item"));
      throw err; // re-throw so SmartItemSearch resets confirming state
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
        {/* Header (mobile only — on desktop the title moves into the tab row) */}
        <div
          className="flex sm:hidden justify-between items-center px-5 pt-4 pb-2 flex-shrink-0"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <h2 className="text-lg font-semibold text-primary">
            {t("addGearItemModal.title", "New gear item")}
          </h2>
          <button
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
            showMyGear
            tabLayout
            twoPane
            title={t("addGearItemModal.title", "New gear item")}
            destinationLabel={categoryName}
            existingGlobalIds={existingGlobalIds}
            existingProductIds={existingProductIds}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
