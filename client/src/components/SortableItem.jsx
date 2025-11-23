// src/components/SortableItem.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useUserSettings } from "../contexts/UserSettings";
import api from "../services/api";
import { toast } from "react-hot-toast";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FaGripVertical,
  FaUtensils,
  FaTshirt,
  FaEllipsisH,
  FaShoppingCart,
} from "react-icons/fa";
import AffiliateGateLink from "./AffiliateGateLink";
import { useWeight } from "../hooks/useWeight";
import { useResolvedPrice } from "../hooks/useResolvedPrice";
import { formatCurrency } from "../utils/formatCurrency";
import DropdownMenu from "./DropdownMenu";
import GlobalItemEditModal from "./GlobalItemEditModal";

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
  onMoveItem,
  onItemUpdated,
}) {
  const { currency, locale } = useUserSettings();
  const resolved = useResolvedPrice(item); // {amount,currency,merchant,deeplink,source} | null
  const [wornLocal, setWornLocal] = useState(item.worn);
  const [consumableLocal, setConsumableLocal] = useState(item.consumable);
  const weightText = useWeight(item.weight);
  const itemKey = `item-${catId}-${item._id}`;
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Decide price once:
  // Custom price: always in user's currency.
  const hasCustomPrice =
    item?.price !== null && item?.price !== undefined && item?.price !== "";

  const hasResolved = resolved && typeof resolved.amount === "number";
  const resolvedMatchesUser =
    hasResolved &&
    resolved.currency &&
    resolved.currency === (currency || "EUR");

  // Only show resolved amount when its currency matches user selection.
  const chosenAmount = hasCustomPrice
    ? Number(item.price)
    : resolvedMatchesUser
    ? Number(resolved.amount)
    : null;

  // We format everything we show with the user's currency symbol.
  const chosenCurrency = currency || "EUR";

  const priceText = useMemo(() => {
    if (chosenAmount == null || chosenAmount <= 0) return "—";
    return formatCurrency(chosenAmount, {
      currency: chosenCurrency,
      locale,
      symbolOnly: true,
    });
  }, [chosenAmount, chosenCurrency, locale]);

  // choose link per priority: user link > resolved deeplink > none
  const finalLink = item.link || resolved?.deeplink || null;

  const CartIconLink = ({ href, className = "" }) =>
    href ? (
      <AffiliateGateLink
        href={href}
        context="private"
        className={className}
        title="Open product page"
        ariaLabel="Open product page (paid link)"
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
    const newWorn = !wornLocal;
    setWornLocal(newWorn);

    api
      .patch(`/dashboard/${listId}/categories/${catId}/items/${item._id}`, {
        worn: newWorn,
      })
      .catch((err) => {
        setWornLocal(!newWorn);
        fetchItems?.(catId);
        toast.error(err.message || "Failed to toggle worn");
      });

    onToggleWorn?.(catId, item._id, newWorn);
  };

  // → handleConsumableClick
  const handleConsumableClick = () => {
    const newConsumable = !consumableLocal;
    setConsumableLocal(newConsumable);

    api
      .patch(`/dashboard/${listId}/categories/${catId}/items/${item._id}`, {
        consumable: newConsumable,
      })
      .catch((err) => {
        setConsumableLocal(!newConsumable);
        fetchItems(catId);
        toast.error(err.message || "Failed to toggle consumable");
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
          .catch((err) => {
            // rollback on error
            setLocalQty(qty);
            fetchItems(catId);
            toast.error(err.message || "Failed to update quantity");
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
        onClick={() => setEditing(true)}
        className="cursor-pointer select-none px-1"
        title="Click to edit quantity"
      >
        {localQty}
      </span>
    );
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const desktopMenuItems = useMemo(
    () => [
      {
        key: "details",
        label: "View / Edit Details",
        onClick: () => setDetailsOpen(true),
      },
      {
        key: "remove",
        label: "Remove Item",
        onClick: () => onDelete?.(catId, item._id),
      },
    ],
    [catId, item._id, onDelete]
  );

  const mobileMenuItems = useMemo(() => {
    const base = [
      {
        key: "details",
        label: "View / Edit Details",
        onClick: () => setDetailsOpen(true),
      },
    ];

    if (onMoveItem) {
      base.push({
        key: "move",
        label: "Move Item",
        onClick: () => onMoveItem(catId, item),
      });
    }

    base.push({
      key: "remove",
      label: "Remove Item",
      onClick: () => onDelete?.(catId, item._id),
    });

    return base;
  }, [catId, item, onDelete, onMoveItem]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-base-100 px-3 sm:px-1 py-2 rounded shadow mb-2"
    >
      {/* ========== MOBILE (both list/column collapse to this) ========== */}
      <div className="sm:hidden grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm">
        {/* Row 1: type + name/brand + ellipsis */}
        <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
          {" "}
          {/* Text block gets the overflow handling, not the whole row */}
          <div className="flex items-center space-x-1 overflow-hidden min-w-0">
            <div className="font-semibold text-primary flex-shrink-0">
              {item.itemType || "—"}
            </div>
            <div className="truncate text-primary flex-1 min-w-0">
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </div>
          </div>
          <DropdownMenu
            trigger={
              <button
                type="button"
                title="Item options"
                aria-label="Item options"
                className="text-secondary hover:text-secondary/80 focus:outline-none"
              >
                <FaEllipsisH />
              </button>
            }
            items={mobileMenuItems}
          />
        </div>

        {/* Row 2: left (weight + price) · right (Buy · icons · qty) */}
        <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
          {/* Left group (fixed column sizes) */}
          <div className="grid grid-cols-[70px_75px] text-primary">
            <span className="tabular-nums text-left">{weightText}</span>
            <span className="tabular-nums text-left">{priceText}</span>
          </div>

          {/* Right group (mobile): 🍴 | 👕 | qty | 🛒 */}
          <div className="flex items-center gap-3">
            <FaUtensils
              title="Toggle consumable"
              onClick={handleConsumableClick}
              className={`cursor-pointer ${
                consumableLocal ? "text-green-600" : "opacity-30"
              }`}
            />
            <FaTshirt
              title="Toggle worn"
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
            />
            <CartIconLink href={finalLink} />
          </div>
        </div>
      </div>

      {/* ========== DESKTOP LIST MODE (single row) ========== */}
      {isListMode && (
        <div
          className="hidden sm:grid items-center text-sm
      grid-cols-[32px,120px,minmax(260px,1fr),96px,112px,24px,24px,48px,24px,24px] gap-x-2"
        >
          {/* 1) Drag */}
          <div
            className="cursor-grab hide-on-touch justify-self-center text-secondary"
            {...attributes}
            {...listeners}
          >
            <FaGripVertical />
          </div>

          {/* 2) Item type */}
          <div className="font-semibold text-primary truncate">
            {item.itemType || "—"}
          </div>

          {/* 3) Name/brand */}
          <div className="truncate text-primary">
            {item.brand && <span className="mr-1">{item.brand}</span>}
            {item.name}
          </div>

          {/* 4) Weight (fixed width, right-aligned, tabular nums) */}
          <div className="justify-self-end tabular-nums text-primary w-[96px] text-right">
            {weightText}
          </div>

          {/* 5) Price (fixed width, right-aligned, tabular nums) */}
          <div className="justify-self-end tabular-nums text-primary w-[112px] text-right">
            {priceText}
          </div>

          {/* 6) Consumable */}
          <div className="justify-self-center">
            <FaUtensils
              title="Toggle consumable"
              onClick={handleConsumableClick}
              className={`cursor-pointer ${
                consumableLocal ? "text-green-600" : "opacity-30"
              }`}
            />
          </div>

          {/* 7) Worn */}
          <div className="justify-self-center">
            <FaTshirt
              title="Toggle worn"
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
            />
          </div>

          {/* 9) Cart */}
          <div className="justify-self-center">
            <CartIconLink href={finalLink} />
          </div>

          {/* 10) Actions menu (desktop list) */}
          <div className="place-self-center">
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  title="Item options"
                  aria-label="Item options"
                  className="inline-flex items-center justify-center text-secondary hover:text-secondary/80 focus:outline-none leading-none"
                >
                  <FaEllipsisH className="w-4 h-4 align-middle" />
                </button>
              }
              items={desktopMenuItems}
            />
          </div>
        </div>
      )}

      {/* ========== DESKTOP COLUMN MODE (3 rows) ========== */}
      {!isListMode && (
        <div className="hidden sm:grid bg-base-100 px-2 grid-rows-[auto_auto_auto]">
          {/* Row 1: Drag · Type · Delete (X) */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center">
            <div
              className="cursor-grab hide-on-touch text-secondary"
              {...attributes}
              {...listeners}
            >
              <FaGripVertical />
            </div>
            <div className="font-semibold text-primary px-2">
              {item.itemType || "—"}
            </div>
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  title="Item options"
                  aria-label="Item options"
                  className="inline-flex items-center justify-center text-secondary hover:text-secondary/80 focus:outline-none leading-none"
                >
                  <FaEllipsisH />
                </button>
              }
              items={desktopMenuItems}
            />
          </div>
          {/* Row 2: Brand/Name (left) */}
          <div className="grid grid-cols-[1fr] items-center">
            <div className="truncate text-sm text-primary">
              {item.brand && (
                <span className="font-medium mr-1">{item.brand}</span>
              )}
              {item.name}
            </div>
          </div>
          {/* Row 3: Left (weight+price) — Right (🍴 · 👕 · Qty · …) */}
          <div className="grid grid-cols-[1fr_auto] items-center">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-primary tabular-nums">
                {weightText}
              </span>
              <span className="text-sm text-primary tabular-nums">
                {priceText}
              </span>
            </div>
            <div className="grid grid-cols-[16px_16px_auto_16px] items-center justify-end gap-x-3">
              <FaUtensils
                title="Toggle consumable"
                aria-label="Toggle consumable"
                data-testid="utensils"
                onClick={handleConsumableClick}
                className={`cursor-pointer ${
                  consumableLocal ? "text-green-600" : "opacity-30"
                }`}
              />
              <FaTshirt
                title="Toggle worn"
                aria-label="Toggle worn"
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
              />
              <CartIconLink href={finalLink} />
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
