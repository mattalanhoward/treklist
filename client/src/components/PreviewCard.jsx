// src/components/PreviewCard.jsx
import React from "react";
import {
  FaGripVertical,
  FaUtensils,
  FaTshirt,
  FaEllipsisH,
  FaShoppingCart,
} from "react-icons/fa";

export default function PreviewCard({ item, viewMode, width }) {
  const ghostStyles = {
    width: width || undefined,
    opacity: 0.85,
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  };

  const weightText =
    item.weight != null && item.weight !== "" ? `${item.weight} g` : "";
  const qty = item.quantity ?? 1;

  // ─────────── LIST MODE PREVIEW ───────────
  if (viewMode === "list") {
    return (
      <>
        {/* Mobile / tablet: two-row layout (matches SortableItem mobile/list) */}
        <div
          style={ghostStyles}
          className="xl:hidden bg-base-100 px-3 py-2 rounded shadow mb-2 grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm"
        >
          {/* Row 1: grip · type · brand/name · ellipsis */}
          <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
            <div className="flex items-center space-x-2 overflow-hidden min-w-0">
              <FaGripVertical className="shrink-0 text-secondary" />
              <div className="font-semibold text-primary flex-shrink-0">
                {item.itemType || "—"}
              </div>
              <div className="truncate text-primary flex-1 min-w-0">
                {item.brand && <span className="mr-1">{item.brand}</span>}
                {item.name}
              </div>
            </div>
            <span className="inline-flex items-center justify-center h-6 w-6 text-secondary">
              <FaEllipsisH className="w-4 h-4" />
            </span>
          </div>

          {/* Row 2: left (weight) · right (🍴 👕 qty 🛒) */}
          <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
            <div className="grid grid-cols-[70px_75px] text-primary">
              <span className="tabular-nums text-left">{weightText}</span>
            </div>
            <div className="flex items-center gap-3">
              <FaUtensils
                className={
                  item.consumable
                    ? "text-green-600"
                    : "opacity-30 text-secondary"
                }
              />
              <FaTshirt
                className={
                  item.worn ? "text-blue-600" : "opacity-30 text-secondary"
                }
              />
              <span className="text-xs text-primary tabular-nums">× {qty}</span>
              <FaShoppingCart className="h-4 w-4 text-secondary" />
            </div>
          </div>
        </div>

        {/* Desktop: wide row (matches SortableItem list row) */}
        <div
          style={ghostStyles}
          className="hidden xl:grid items-center text-sm
            bg-base-100 px-3 py-2 rounded shadow mb-2
            grid-cols-[32px,120px,minmax(260px,1fr),96px,112px,24px,24px,48px,24px,24px]
            gap-x-2"
        >
          {/* 1) Drag handle */}
          <div className="cursor-grab justify-self-center text-secondary">
            <FaGripVertical />
          </div>

          {/* 2) Item type */}
          <div className="font-semibold text-primary truncate">
            {item.itemType || "—"}
          </div>

          {/* 3) Brand / Name */}
          <div className="truncate text-primary">
            {item.brand && <span className="mr-1">{item.brand}</span>}
            {item.name}
          </div>

          {/* 4) Weight */}
          <div className="justify-self-end tabular-nums text-primary w-[96px] text-right">
            {weightText}
          </div>

          {/* 6) Consumable */}
          <div className="justify-self-center">
            <FaUtensils
              className={
                item.consumable ? "text-green-600" : "opacity-30 text-secondary"
              }
            />
          </div>

          {/* 7) Worn */}
          <div className="justify-self-center">
            <FaTshirt
              className={
                item.worn ? "text-blue-600" : "opacity-30 text-secondary"
              }
            />
          </div>

          {/* 8) Qty */}
          <div className="justify-self-center tabular-nums text-primary">
            {qty}
          </div>

          {/* 9) Cart */}
          <div className="justify-self-center text-secondary">
            <FaShoppingCart className="w-4 h-4" />
          </div>

          {/* 10) Ellipsis */}
          <div className="justify-self-center text-secondary">
            <FaEllipsisH className="w-4 h-4" />
          </div>
        </div>
      </>
    );
  }

  // ─────────── COLUMN MODE PREVIEW (CARD) ───────────
  return (
    <>
      {/* Mobile: same 2-row layout as SortableItem mobile/column */}
      <div
        style={ghostStyles}
        className="sm:hidden bg-base-100 px-3 py-2 rounded shadow mb-2 grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm"
      >
        <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
          <div className="flex items-center space-x-2 overflow-hidden min-w-0">
            <FaGripVertical className="shrink-0 text-secondary" />
            <div className="font-semibold text-primary flex-shrink-0">
              {item.itemType || "—"}
            </div>
            <div className="truncate text-primary flex-1 min-w-0">
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </div>
          </div>
          <span className="inline-flex items-center justify-center h-6 w-6 text-secondary">
            <FaEllipsisH className="w-4 h-4" />
          </span>
        </div>

        <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
          <div className="grid grid-cols-[70px_75px] text-primary">
            <span className="tabular-nums text-left">{weightText}</span>
          </div>
          <div className="flex items-center gap-3">
            <FaUtensils
              className={
                item.consumable ? "text-green-600" : "opacity-30 text-secondary"
              }
            />
            <FaTshirt
              className={
                item.worn ? "text-blue-600" : "opacity-30 text-secondary"
              }
            />
            <span className="text-xs text-primary tabular-nums">× {qty}</span>
            <FaShoppingCart className="h-4 w-4 text-secondary" />
          </div>
        </div>
      </div>

      {/* Desktop column card (matches SortableItem column layout) */}
      <div
        style={ghostStyles}
        className="hidden sm:grid bg-base-100 px-2 rounded shadow mb-2 grid-rows-[auto_auto_auto]"
      >
        {/* Row 1: grip · type · ellipsis */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center">
          <div className="cursor-grab text-secondary">
            <FaGripVertical />
          </div>
          <div className="font-semibold text-primary px-2">
            {item.itemType || "—"}
          </div>
          <span className="inline-flex items-center justify-center h-6 w-6 text-secondary">
            <FaEllipsisH className="w-4 h-4" />
          </span>
        </div>

        {/* Row 2: brand · name */}
        <div className="grid grid-cols-[1fr] items-center">
          <div className="truncate text-sm text-primary">
            {item.brand && (
              <span className="font-medium mr-1">{item.brand}</span>
            )}
            {item.name}
          </div>
        </div>

        {/* Row 3: left (weight) — right (🍴 👕 qty 🛒) */}
        <div className="grid grid-cols-[1fr_auto] items-center">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-primary tabular-nums">
              {weightText}
            </span>
          </div>
          <div className="grid grid-cols-[16px_16px_auto_16px] items-center justify-end gap-x-3">
            <FaUtensils
              className={
                item.consumable ? "text-green-600" : "opacity-30 text-secondary"
              }
            />
            <FaTshirt
              className={
                item.worn ? "text-blue-600" : "opacity-30 text-secondary"
              }
            />
            <span className="flex items-center justify-center border rounded px-2 py-0.5 bg-neutral text-sm text-primary">
              {qty}
            </span>
            <FaShoppingCart className="w-4 h-4 text-secondary" />
          </div>
        </div>
      </div>
    </>
  );
}
