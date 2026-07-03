// src/components/SortableItem.jsx
import React, { useState, useEffect } from "react";
import { useUserSettings } from "../contexts/UserSettings";
import api from "../services/api";
import { toast } from "react-hot-toast";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaGripVertical, FaUtensils, FaTshirt } from "react-icons/fa";
import { FiExternalLink, FiTrash2, FiRefreshCw, FiStar } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import AffiliateGateLink from "./AffiliateGateLink";
import { useWeight } from "../hooks/useWeight";
import GlobalItemEditModal from "./GlobalItemEditModal";
import SwapItemModal from "./SwapItemModal";
import { useTranslation } from "react-i18next";
import { tItemType } from "../config/catalogTaxonomy";

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
  const [swapOpen, setSwapOpen] = useState(false);
  const [wishlisted, setWishlisted] = useState(item.globalItemStatus === "wishlisted");
  const { region: userRegion } = useUserSettings();

  const handleWishlistToggle = async () => {
    if (!item.globalItem) return;
    const newStatus = wishlisted ? "owned" : "wishlisted";
    setWishlisted(!wishlisted);
    try {
      await api.patch(`/global/items/${item.globalItem}`, { status: newStatus });
      window.dispatchEvent(new CustomEvent("global-items:updated"));
    } catch {
      setWishlisted(wishlisted); // revert on error
      toast.error(t("wishlist.toasts.toggleFailed", "Failed to update wishlist"));
    }
  };

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
        <FiExternalLink className="w-3 h-3" />
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
      className={`bg-base-100 px-3 ${
        isListMode ? "sm:px-3" : "sm:px-1"
      } py-2 rounded shadow mb-2`}
    >
      {/* ========== MOBILE (both list/column collapse to this) ========== */}
      <div
        className={`${twoRowVisibilityClasses} grid ${
          isListMode ? "grid-rows-[auto_auto]" : "grid-rows-[auto_auto_auto]"
        } gap-y-1 text-sm`}
      >
        {isListMode ? (
          /* LIST MOBILE — Row 1: type + name (inline) · variant + actions */
          <div className="flex items-center justify-between gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{ fontSize: 14 }}
              className="flex items-baseline gap-1.5 min-w-0 text-left hover:text-primary/80"
            >
              <span className="font-semibold text-primary flex-shrink-0">
                {tItemType(t, item.itemType) || "—"}
              </span>
              <span className="truncate text-primary">
                {item.brand && (
                  <span className="text-primary/50 mr-1">{item.brand}</span>
                )}
                {item.name}
              </span>
            </button>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.variantKey && (
                <span className="whitespace-nowrap text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 font-medium">
                  {item.variantKey}
                </span>
              )}
              {!isLocked && (
                <>
                  <button
                    data-tour="item-swap"
                    type="button"
                    onClick={() => setSwapOpen(true)}
                    className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                    title={t("gearList.actions.swap", "Swap item")}
                  >
                    <FiRefreshCw className="text-sm" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(catId, item._id)}
                    className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                    title={t("gearList.confirm.removeItemConfirm")}
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* COLUMN MOBILE — Row 1: type + actions */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                style={{ fontSize: 14 }}
                className="font-semibold text-primary truncate text-left hover:text-primary/80 min-w-0"
              >
                {tItemType(t, item.itemType) || "—"}
              </button>
              {!isLocked && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    data-tour="item-swap"
                    type="button"
                    onClick={() => setSwapOpen(true)}
                    className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                    title={t("gearList.actions.swap", "Swap item")}
                  >
                    <FiRefreshCw className="text-sm" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(catId, item._id)}
                    className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                    title={t("gearList.confirm.removeItemConfirm")}
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                </div>
              )}
            </div>

            {/* COLUMN MOBILE — Row 2: brand · name (truncate) … variant (far right) */}
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{ fontSize: 14 }}
              className="flex items-center justify-between gap-2 min-w-0 text-primary text-left hover:text-primary/80"
            >
              <span className="truncate min-w-0">
                {item.brand && (
                  <span className="text-primary/50 mr-1">{item.brand}</span>
                )}
                {item.name}
              </span>
              {item.variantKey && (
                <span className="flex-shrink-0 whitespace-nowrap text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 font-medium">
                  {item.variantKey}
                </span>
              )}
            </button>
          </>
        )}

        {/* Row (shared): weight · consumable · worn · qty · cart · wishlist */}
        <div className="flex items-center justify-between gap-2">
          <span className="tabular-nums text-primary">{weightText}</span>

          {/* Right group (mobile): 🍴 | 👕 | qty | 🛒 | ⭐ */}
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
            {item.globalItem && (
              <button
                data-tour="item-wishlist"
                type="button"
                onClick={handleWishlistToggle}
                title={wishlisted ? t("wishlist.actions.markOwned", "Mark as owned") : t("wishlist.actions.addToWishlist", "Add to wishlist")}
                className="focus:outline-none"
              >
                {wishlisted
                  ? <FaStar className="text-amber-400 text-sm" />
                  : <FiStar className="text-sm opacity-30 hover:opacity-70" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* ========== DESKTOP LIST MODE (single row) ========== */}
      {/* cols: drag | type | name | weight | knife | shirt | qty | cart | star | swap | trash */}
      {isListMode && (
        <div
          className="hidden xl:grid items-center text-sm
          grid-cols-[20px,168px,120px,minmax(140px,1fr),auto,96px,24px,24px,48px,24px,24px,24px,24px] gap-x-3"
        >
          {/* 1) Drag */}
          <div
            className={`hide-on-touch justify-self-start text-secondary ${isLocked ? "invisible" : "cursor-grab"}`}
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
            {tItemType(t, item.itemType) || "—"}
          </button>

          {/* 3) Brand */}
          <div
            style={{ fontSize: 14 }}
            className="text-primary/50 truncate text-left"
            title={item.brand || ""}
          >
            {item.brand || ""}
          </div>

          {/* 4) Name (own column → names line up across rows) */}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            style={{ fontSize: 14 }}
            className="min-w-0 truncate text-primary text-left hover:text-primary/80"
          >
            {item.name}
          </button>

          {/* 5) Variant (sits to the right, next to the weight) */}
          <div className="justify-self-end">
            {item.variantKey && (
              <span className="whitespace-nowrap text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 font-medium">
                {item.variantKey}
              </span>
            )}
          </div>

          {/* 6) Weight */}
          <div className="justify-self-end tabular-nums text-primary w-[96px] text-right">
            {weightText}
          </div>

          {/* 5) Consumable */}
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

          {/* 6) Worn */}
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

          {/* 7) Qty */}
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

          {/* 8) Cart */}
          <div className="justify-self-center">
            <CartIconLink />
          </div>

          {/* 9) Wishlist star */}
          <div className="justify-self-center">
            {item.globalItem && (
              <button
                data-tour="item-wishlist"
                type="button"
                onClick={handleWishlistToggle}
                title={wishlisted ? t("wishlist.actions.markOwned", "Mark as owned") : t("wishlist.actions.addToWishlist", "Add to wishlist")}
                className="focus:outline-none"
              >
                {wishlisted
                  ? <FaStar className="text-amber-400 text-sm" />
                  : <FiStar className="text-sm opacity-30 hover:opacity-70" />}
              </button>
            )}
          </div>

          {/* 10) Swap */}
          <div className="justify-self-center">
            {!isLocked && (
              <button
                data-tour="item-swap"
                type="button"
                onClick={() => setSwapOpen(true)}
                className="text-primary/60 hover:text-primary focus:outline-none"
                title={t("gearList.actions.swap", "Swap item")}
              >
                <FiRefreshCw className="text-sm" />
              </button>
            )}
          </div>

          {/* 11) Delete */}
          <div className="justify-self-center">
            {!isLocked && (
              <button
                type="button"
                onClick={() => onDelete?.(catId, item._id)}
                className="text-primary/60 hover:text-primary focus:outline-none"
                title={t("gearList.confirm.removeItemConfirm")}
              >
                <FiTrash2 className="text-sm" />
              </button>
            )}
          </div>
        </div>
      )}
      {/* ========== DESKTOP COLUMN MODE (unified 6-col grid across 3 rows) ========== */}
      {/* cols: [grabber | type(1fr) | knife | shirt | qty | link] */}
      {!isListMode && (
        <div className="hidden sm:grid bg-base-100 px-2
          grid-cols-[auto_1fr_16px_16px_auto_16px]
          grid-rows-[auto_auto_auto]
          gap-x-2 gap-y-0.5 items-center">

          {/* R1 C1: Grabber */}
          <div
            className={`row-start-1 col-start-1 self-center hide-on-touch text-secondary ${isLocked ? "invisible" : "cursor-grab"}`}
            {...(isLocked ? {} : { ...attributes, ...listeners })}
          >
            <FaGripVertical />
          </div>

          {/* R1 C2: Item type */}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            style={{ fontSize: 14 }}
            className="row-start-1 col-start-2 font-semibold text-primary text-left min-w-0 truncate hover:text-primary/80"
          >
            {tItemType(t, item.itemType) || "—"}
          </button>

          {/* R1 C3: empty — holds the knife column width */}
          <div className="row-start-1 col-start-3" />

          {/* R1 C4: Star — aligns over shirt */}
          {item.globalItem && (
            <button
              data-tour="item-wishlist"
              type="button"
              onClick={handleWishlistToggle}
              title={wishlisted ? t("wishlist.actions.markOwned", "Mark as owned") : t("wishlist.actions.addToWishlist", "Add to wishlist")}
              className="row-start-1 col-start-4 justify-self-center focus:outline-none"
            >
              {wishlisted
                ? <FaStar className="text-amber-400 text-sm" />
                : <FiStar className="text-sm opacity-30 hover:opacity-70" />}
            </button>
          )}

          {/* R1 C5: Swap — aligns over qty */}
          {!isLocked && (
            <button
              data-tour="item-swap"
              type="button"
              onClick={() => setSwapOpen(true)}
              className="row-start-1 col-start-5 justify-self-center text-primary/60 hover:text-primary focus:outline-none"
              title={t("gearList.actions.swap", "Swap item")}
            >
              <FiRefreshCw className="text-sm" />
            </button>
          )}

          {/* R1 C6: Trash — aligns over link */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => onDelete?.(catId, item._id)}
              className="row-start-1 col-start-6 justify-self-center text-primary/60 hover:text-primary focus:outline-none"
              title={t("gearList.confirm.removeItemConfirm")}
            >
              <FiTrash2 className="text-sm" />
            </button>
          )}

          {/* R2 C1-6: Brand / Name (variant now lives on row 3, next to weight) */}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            style={{ fontSize: 14 }}
            className="row-start-2 col-start-1 col-span-6 min-w-0 truncate text-primary text-left hover:text-primary/80"
          >
            {item.brand && (
              <span className="text-primary/50 mr-1">{item.brand}</span>
            )}
            {item.name}
          </button>

          {/* R3 C1-2: Weight + variant (fills the space between weight and the icons) */}
          <div className="row-start-3 col-start-1 col-span-2 flex items-center gap-2 min-w-0">
            <span className="text-sm text-primary tabular-nums">{weightText}</span>
            {item.variantKey && (
              <span className="flex-shrink-0 whitespace-nowrap text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 font-medium">
                {item.variantKey}
              </span>
            )}
          </div>

          {/* R3 C3: Knife (consumable) */}
          <FaUtensils
            title={t("gearList.items.toggleConsumable")}
            aria-label={t("gearList.items.toggleConsumable")}
            data-testid="utensils"
            onClick={handleConsumableClick}
            className={`row-start-3 col-start-3 justify-self-center cursor-pointer ${
              consumableLocal ? "text-green-600" : "opacity-30"
            }`}
          />

          {/* R3 C4: Shirt (worn) */}
          <FaTshirt
            title={t("gearList.items.toggleWorn")}
            aria-label={t("gearList.items.toggleWorn")}
            data-testid="tshirt"
            onClick={handleWornClick}
            className={`row-start-3 col-start-4 justify-self-center cursor-pointer ${
              wornLocal ? "text-blue-600" : "opacity-30"
            }`}
          />

          {/* R3 C5: Quantity */}
          <div className="row-start-3 col-start-5 justify-self-center">
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

          {/* R3 C6: Cart link */}
          <div className="row-start-3 col-start-6 justify-self-center">
            <CartIconLink />
          </div>
        </div>
      )}
      {detailsOpen && (
        <GlobalItemEditModal
          item={item}
          onClose={() => setDetailsOpen(false)}
          onSaved={() => {
            setDetailsOpen(false);
            fetchItems?.(catId);
            onItemUpdated?.();
          }}
          allowDelete={false}
          listId={listId}
          catId={catId}
        />
      )}
      {swapOpen && (
        <SwapItemModal
          item={item}
          listId={listId}
          catId={catId}
          onClose={() => setSwapOpen(false)}
          onSwapped={() => {
            setSwapOpen(false);
            fetchItems?.(catId);
            onItemUpdated?.();
          }}
        />
      )}
    </div>
  );
}
