// src/components/PreviewCard.jsx
import React from "react";
import {
  FaGripVertical,
  FaUtensils,
  FaTshirt,
  FaShoppingCart,
  FaTrash,
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
  const isListMode = viewMode === "list";
  const twoRowVisibilityClasses = isListMode ? "xl:hidden" : "sm:hidden";

  return (
    <div style={ghostStyles} className="bg-base-100 px-3 sm:px-1 rounded shadow mb-2">
      {/* ========== MOBILE (both list/column collapse to this) ========== */}
      <div
        className={`${twoRowVisibilityClasses} grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm`}
      >
        {/* Row 1: grip · type · brand/name · trash */}
        <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
          <div className="flex items-center space-x-1 overflow-hidden min-w-0">
            <div className="font-semibold text-primary flex-shrink-0" style={{ fontSize: 14 }}>
              {item.itemType || "—"}
            </div>
            <div
              className="truncate text-primary flex-1 min-w-0 text-left"
              style={{ fontSize: 14 }}
            >
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="p-1 text-primary/60">
              <FaTrash className="text-sm" />
            </span>
          </div>
        </div>

        {/* Row 2: left (weight) · right (🍴 👕 qty 🛒) */}
        <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
          <div className="grid grid-cols-[70px_75px] text-primary">
            <span className="tabular-nums text-left">{weightText}</span>
          </div>
          <div className="flex items-center gap-3">
            <FaUtensils
              className={
                item.consumable ? "text-green-600" : "opacity-30"
              }
            />
            <FaTshirt
              className={
                item.worn ? "text-blue-600" : "opacity-30"
              }
            />
            <span className="select-none px-1">{qty}</span>
            <FaShoppingCart className="w-4 h-4 text-secondary" />
          </div>
        </div>
      </div>

      {/* ========== DESKTOP LIST MODE (single row) ========== */}
      {isListMode && (
        <div
          className="hidden xl:grid items-center text-sm
            grid-cols-[32px,160px,minmax(260px,1fr),96px,24px,24px,24px,48px,24px] gap-x-2"
        >
          {/* 1) Drag handle */}
          <div className="cursor-grab justify-self-center text-secondary">
            <FaGripVertical />
          </div>

          {/* 2) Item type */}
          <div
            className="font-semibold text-primary truncate text-left"
            style={{ fontSize: 14 }}
          >
            {item.itemType || "—"}
          </div>

          {/* 3) Brand / Name */}
          <div
            className="truncate text-primary text-left"
            style={{ fontSize: 14 }}
          >
            {item.brand && <span className="mr-1">{item.brand}</span>}
            {item.name}
          </div>

          {/* 4) Weight */}
          <div className="justify-self-end tabular-nums text-primary w-[96px] text-right">
            {weightText}
          </div>

          {/* 5) Consumable */}
          <div className="justify-self-center">
            <FaUtensils
              className={
                item.consumable ? "text-green-600" : "opacity-30"
              }
            />
          </div>

          {/* 6) Worn */}
          <div className="justify-self-center">
            <FaTshirt
              className={
                item.worn ? "text-blue-600" : "opacity-30"
              }
            />
          </div>

          {/* 7) Qty */}
          <div className="justify-self-center">
            <span className="select-none px-1">{qty}</span>
          </div>

          {/* 8) Cart */}
          <div className="justify-self-center">
            <FaShoppingCart className="w-4 h-4 text-secondary" />
          </div>

          {/* 9) Delete */}
          <div className="place-self-center mr-3.5">
            <span className="p-1 text-primary/60">
              <FaTrash className="text-sm" />
            </span>
          </div>
        </div>
      )}

      {/* ========== DESKTOP COLUMN MODE (3 rows) ========== */}
      {!isListMode && (
        <div className="hidden sm:grid bg-base-100 px-2 grid-rows-[auto_auto_auto]">
          {/* Row 1: Drag · Type · Delete */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center">
            <div className="cursor-grab text-secondary">
              <FaGripVertical />
            </div>
            <div
              className="font-semibold text-primary px-2 text-left"
              style={{ fontSize: 14 }}
            >
              {item.itemType || "—"}
            </div>
            <div className="-mr-0.5">
              <span className="text-primary/60">
                <FaTrash className="text-sm" />
              </span>
            </div>
          </div>

          {/* Row 2: Brand/Name */}
          <div className="grid grid-cols-[1fr] items-center">
            <div
              className="truncate text-primary text-left"
              style={{ fontSize: 14 }}
            >
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </div>
          </div>

          {/* Row 3: Left (weight) — Right (🍴 · 👕 · Qty · 🛒) */}
          <div className="grid grid-cols-[1fr_auto] items-center">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-primary tabular-nums">
                {weightText}
              </span>
            </div>
            <div className="grid grid-cols-[16px_16px_auto_16px] items-center justify-end gap-x-3">
              <FaUtensils
                className={
                  item.consumable ? "text-green-600" : "opacity-30"
                }
              />
              <FaTshirt
                className={
                  item.worn ? "text-blue-600" : "opacity-30"
                }
              />
              <span className="flex items-center justify-center border rounded px-2 py-0.5 bg-neutral text-sm text-primary">
                {qty}
              </span>
              <FaShoppingCart className="w-4 h-4 text-secondary" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
