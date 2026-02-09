// src/components/SortableItem.jsx
import React, { useState, useEffect } from "react";
import { useUserSettings } from "../contexts/UserSettings";
import api from "../services/api";
import { toast } from "react-hot-toast";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FaGripVertical,
  FaUtensils,
  FaTshirt,
  FaShoppingCart,
  FaTrash,
} from "react-icons/fa";
import AffiliateGateLink from "./AffiliateGateLink";
import { useWeight } from "../hooks/useWeight";
import GlobalItemEditModal from "./GlobalItemEditModal";
import { useTranslation } from "react-i18next";

export default function SortableItem({
  item,
  listId,
  catId,
  onToggleConsumable,
  onToggleWorn,
  onDelete,
  isListMode,
  fetchItems,
  onQuantityChange,
  onItemUpdated,
  isLocked,

}) {
  const { t } = useTranslation("common");
  const [wornLocal, setWornLocal] = useState(item.worn);
  const [consumableLocal, setConsumableLocal] = useState(item.consumable);
  const weightText = useWeight(item.weight);
  const itemKey = `item-${catId}-${item._id}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { region: userRegion } = useUserSettings();

  // If the item has a direct link (custom item), we should NOT call resolver.
  const hasDirectLink = Boolean(item?.link);

  // For getHref: we can resolve if there's a globalItem reference
  // (The backend already confirmed hasOffer=true, so we know a link exists)
  const canResolve = Boolean(item?.globalItem || item?.productId);

  // Show cart icon only if backend confirmed an offer exists
  const showCart = Boolean(item?.hasOffer);

  const CartIconLink = ({ className = "" }) =>
    showCart ? (
      <AffiliateGateLink
        // ✅ Custom items: direct link only
        href={hasDirectLink ? item.link : null}
        // ✅ Imported/merchant-backed: only resolve when there is NO direct link
        getHref={
          !hasDirectLink && canResolve
            ? async () => {
                const globalItemId = item?.globalItem || item?._id; // gearItem.globalItem in list context
                const region = (userRegion || "us").toUpperCase();

                try {
                  const res = await api.get(
                    `/affiliates/offers/resolve-link?globalItemId=${globalItemId}&region=${region}`,
                  );
                  return res?.data?.link || null;
                } catch (e) {
                  if (e?.response?.status === 404) return null;
                  return null;
                }
              }
            : undefined
        }
        context="private"
        className={className}
        title={t("gearList.items.openProductPageTitle")}
        ariaLabel={t("gearList.items.openProductPageAria")}
      >
        <FaShoppingCart className="w-4 h-4" />
      </AffiliateGateLink>
    ) : (
      <span
        className={`inline-flex h-5 w-5 align-middle opacity-0 ${className}`}
        aria-hidden
      />
    );

  // make sure useSortable() never comes back undefined
  const sortable =
    useSortable({
      id: itemKey,
      data: { catId, itemId: item._id },
    }) || {};

  const {
    attributes = {},
    listeners = {},
    setNodeRef = () => {},
    transform = null,
    transition = null,
  } = sortable;

  // → handleWornClick
  const handleWornClick = () => {
    if (isLocked) return;
    const newWorn = !wornLocal;
    setWornLocal(newWorn);

    api
      .patch(`/dashboard/${listId}/categories/${catId}/items/${item._id}`, {
        worn: newWorn,
      })
      .catch(() => {
        setWornLocal(!newWorn);
        fetchItems?.(catId);
        toast.error(t("gearList.toasts.toggleWornFailed"));
      });

    onToggleWorn?.(catId, item._id, newWorn);
  };

  // → handleConsumableClick
  const handleConsumableClick = () => {
    if (isLocked) return;
    const newConsumable = !consumableLocal;
    setConsumableLocal(newConsumable);

    api
      .patch(`/dashboard/${listId}/categories/${catId}/items/${item._id}`, {
        consumable: newConsumable,
      })
      .catch(() => {
        setConsumableLocal(!newConsumable);
        fetchItems?.(catId);
        toast.error(t("gearList.toasts.toggleConsumableFailed"));
      });

    onToggleConsumable?.(catId, item._id, newConsumable);
  };

  function QuantityInline({
    qty,
    onChange,
    catId,
    listId,
    itemId,
    fetchItems,
    isLocked,
  }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(qty);
    const [localQty, setLocalQty] = useState(qty);

    // keep local in sync if item prop changes
    useEffect(() => {
      setValue(qty);
      setLocalQty(qty);
    }, [qty]);

    // → commit inside QuantityInline
    const commit = () => {
      const n = parseInt(value, 10);

      // only proceed if the value is a valid positive integer
      if (!isNaN(n) && n > 0) {
        const newQty = n;

        // optimistically update local state & parent only if it really changed
        if (newQty !== localQty) {
          setLocalQty(newQty);
          onQuantityChange?.(catId, itemId, newQty);
        }

        // always try to persist, so that we can catch & roll back on error
        api
          .patch(`/dashboard/${listId}/categories/${catId}/items/${itemId}`, {
            quantity: newQty,
          })
          .catch(() => {
            // rollback on error
            setLocalQty(qty);
            fetchItems?.(catId);
            toast.error(t("gearList.toasts.quantityUpdateFailed"));
          });
      }

      setEditing(false);
    };

    if (editing) {
      return (
        <input
          type="number"
          min="1"
          className="w-12 text-center border rounded p-1 bg-neutral"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      );
    }

    return (
      <span
        onClick={() => !isLocked && setEditing(true)}
        className={`select-none px-1 ${isLocked ? "cursor-default" : "cursor-pointer"}`}
        title={isLocked ? undefined : t("gearList.items.editQuantityTitle")}
      >
        {localQty}
      </span>
    );
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };


  const twoRowVisibilityClasses = isListMode ? "xl:hidden" : "sm:hidden";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-base-100 px-3 sm:px-1 py-2 rounded shadow mb-2"
    >
      {/* ========== MOBILE (both list/column collapse to this) ========== */}
      <div
        className={`${twoRowVisibilityClasses} grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm`}
      >
        {/* Row 1: type + name/brand + actions */}
        <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
          {/* Text block gets the overflow handling, not the whole row */}
          <div className="flex items-center space-x-1 overflow-hidden min-w-0">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{ fontSize: 14 }}
              className="font-semibold text-primary flex-shrink-0 hover:text-primary/80"
            >
              {item.itemType || "—"}
            </button>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{ fontSize: 14 }}
              className="truncate text-primary flex-1 min-w-0 text-left hover:text-primary/80"
            >
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </button>
          </div>
          {!isLocked && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => onDelete?.(catId, item._id)}
                className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                title={t("gearList.confirm.removeItemConfirm")}
              >
                <FaTrash className="text-sm" />
              </button>
            </div>
          )}
        </div>
        {/* Row 2: left (weight) · right (Buy · icons · qty) */}
        <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
          {/* Left group (fixed column sizes) */}
          <div className="grid grid-cols-[70px_75px] text-primary">
            <span className="tabular-nums text-left">{weightText}</span>
          </div>

          {/* Right group (mobile): 🍴 | 👕 | qty | 🛒 */}
          <div className="flex items-center gap-3">
            <FaUtensils
              title={t("gearList.items.toggleConsumable")}
              aria-label={t("gearList.items.toggleConsumable")}
              onClick={handleConsumableClick}
              className={`cursor-pointer ${
                consumableLocal ? "text-green-600" : "opacity-30"
              }`}
            />
            <FaTshirt
              title={t("gearList.items.toggleWorn")}
              aria-label={t("gearList.items.toggleWorn")}
              onClick={handleWornClick}
              className={`cursor-pointer ${
                wornLocal ? "text-blue-600" : "opacity-30"
              }`}
            />
            <QuantityInline
              qty={item.quantity}
              onChange={(n) => onQuantityChange(catId, item._id, n)}
              catId={catId}
              listId={listId}
              itemId={item._id}
              fetchItems={fetchItems}
              isLocked={isLocked}
            />
            <CartIconLink />
          </div>
        </div>
      </div>
      {/* ========== DESKTOP LIST MODE (single row) ========== */}
      {isListMode && (
        <div
          className="hidden xl:grid items-center text-sm
      grid-cols-[32px,160px,minmax(260px,1fr),96px,24px,24px,24px,48px,24px] gap-x-2"
        >
          {/* 1) Drag */}
          <div
            className={`hide-on-touch justify-self-center text-secondary ${isLocked ? "invisible" : "cursor-grab"}`}
            {...(isLocked ? {} : { ...attributes, ...listeners })}
          >
            <FaGripVertical />
          </div>

          {/* 2) Item type */}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            style={{ fontSize: 14 }}
            className="font-semibold text-primary truncate text-left hover:text-primary/80"
          >
            {item.itemType || "—"}
          </button>

          {/* 3) Name/brand */}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            style={{ fontSize: 14 }}
            className="truncate text-primary text-left hover:text-primary/80"
          >
            {item.brand && <span className="mr-1">{item.brand}</span>}
            {item.name}
          </button>

          {/* 4) Weight (fixed width, right-aligned, tabular nums) */}
          <div className="justify-self-end tabular-nums text-primary w-[96px] text-right">
            {weightText}
          </div>

          {/* 6) Consumable */}
          <div className="justify-self-center">
            <FaUtensils
              title={t("gearList.items.toggleConsumable")}
              aria-label={t("gearList.items.toggleConsumable")}
              onClick={handleConsumableClick}
              className={`cursor-pointer ${
                consumableLocal ? "text-green-600" : "opacity-30"
              }`}
            />
          </div>

          {/* 7) Worn */}
          <div className="justify-self-center">
            <FaTshirt
              title={t("gearList.items.toggleWorn")}
              aria-label={t("gearList.items.toggleWorn")}
              onClick={handleWornClick}
              className={`cursor-pointer ${
                wornLocal ? "text-blue-600" : "opacity-30"
              }`}
            />
          </div>

          {/* 8) Qty */}
          <div className="justify-self-center">
            <QuantityInline
              qty={item.quantity}
              onChange={(n) => onQuantityChange(catId, item._id, n)}
              catId={catId}
              listId={listId}
              itemId={item._id}
              fetchItems={fetchItems}
              isLocked={isLocked}
            />
          </div>

          {/* 9) Cart */}
          <div className="justify-self-center">
            <CartIconLink />
          </div>

          {/* 10) Delete action (desktop list) */}
          {!isLocked && (
            <div className="place-self-center mr-3.5">
              <button
                type="button"
                onClick={() => onDelete?.(catId, item._id)}
                className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                title={t("gearList.confirm.removeItemConfirm")}
              >
                <FaTrash className="text-sm" />
              </button>
            </div>
          )}
        </div>
      )}
      {/* ========== DESKTOP COLUMN MODE (3 rows) ========== */}
      {!isListMode && (
        <div className="hidden sm:grid bg-base-100 px-2 grid-rows-[auto_auto_auto]">
          {/* Row 1: Drag · Type · Delete */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center">
            <div
              className={`hide-on-touch text-secondary ${isLocked ? "invisible" : "cursor-grab"}`}
              {...(isLocked ? {} : { ...attributes, ...listeners })}
            >
              <FaGripVertical />
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{ fontSize: 14 }}
              className="font-semibold text-primary px-2 text-left hover:text-primary/80"
            >
              {item.itemType || "—"}
            </button>
            {!isLocked && (
              <div className="-mr-0.5">
                <button
                  type="button"
                  onClick={() => onDelete?.(catId, item._id)}
                  className="text-primary/60 hover:text-primary focus:outline-none"
                  title={t("gearList.confirm.removeItemConfirm")}
                >
                  <FaTrash className="text-sm" />
                </button>
              </div>
            )}
          </div>
          {/* Row 2: Brand/Name (left) */}
          <div className="grid grid-cols-[1fr] items-center">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{ fontSize: 14 }}
              className="truncate text-primary text-left hover:text-primary/80"
            >
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </button>
          </div>
          {/* Row 3: Left (weight) — Right (🍴 · 👕 · Qty · …) */}
          <div className="grid grid-cols-[1fr_auto] items-center">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-primary tabular-nums">
                {weightText}
              </span>
            </div>
            <div className="grid grid-cols-[16px_16px_auto_16px] items-center justify-end gap-x-3">
              <FaUtensils
                title={t("gearList.items.toggleConsumable")}
                aria-label={t("gearList.items.toggleConsumable")}
                data-testid="utensils"
                onClick={handleConsumableClick}
                className={`cursor-pointer ${
                  consumableLocal ? "text-green-600" : "opacity-30"
                }`}
              />
              <FaTshirt
                title={t("gearList.items.toggleWorn")}
                aria-label={t("gearList.items.toggleWorn")}
                data-testid="tshirt"
                onClick={handleWornClick}
                className={`cursor-pointer ${
                  wornLocal ? "text-blue-600" : "opacity-30"
                }`}
              />
              <QuantityInline
                qty={item.quantity}
                onChange={(n) => onQuantityChange(catId, item._id, n)}
                catId={catId}
                listId={listId}
                itemId={item._id}
                fetchItems={fetchItems}
                isLocked={isLocked}
              />
              <CartIconLink />
            </div>
          </div>
        </div>
      )}
      {detailsOpen && (
        <GlobalItemEditModal
          item={item}
          onClose={() => setDetailsOpen(false)}
          onSaved={() => {
            setDetailsOpen(false);
            // Refresh current category (if you have a per-cat fetch)
            fetchItems?.(catId);
            // And ask the page to refresh the whole list if needed
            onItemUpdated?.(); // 🔑 new line
          }}
          allowDelete={false}
          listId={listId}
          catId={catId}
        />
      )}
    </div>
  );
}
