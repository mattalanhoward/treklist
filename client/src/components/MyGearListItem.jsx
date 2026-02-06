// client/src/components/MyGearListItem.jsx
import React from "react";
import { FaTrash, FaShoppingCart, FaCheckSquare, FaRegSquare } from "react-icons/fa";

export default function MyGearListItem({
  item,
  formatWeight,
  unitLabel,
  t,
  actionLoading,
  onViewEdit,
  onDelete,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) {
  const merchantUrl = item.link || item.affiliate?.deepLink;

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect();
    }
  };

  return (
    <div
      className={`bg-base-100 px-3 sm:px-2 py-2 rounded shadow mb-2 ${
        selectionMode ? "cursor-pointer" : ""
      } ${isSelected ? "ring-2 ring-secondary" : ""}`}
      onClick={handleClick}
    >
      {/* Mobile layout (2 rows) */}
      <div className="sm:hidden grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm">
        {/* Row 1: Type + Brand/Name + actions */}
        <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
          <div className="flex items-center space-x-1 overflow-hidden min-w-0">
            {selectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.();
                }}
                className="p-1 text-secondary flex-shrink-0"
              >
                {isSelected ? (
                  <FaCheckSquare className="text-base" />
                ) : (
                  <FaRegSquare className="text-base text-primary/40" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewEdit();
              }}
              style={{ fontSize: 14 }}
              className="font-semibold text-primary flex-shrink-0 hover:text-primary/80"
            >
              {item.itemType || "—"}
            </button>
            <span
              style={{ fontSize: 14 }}
              className="truncate text-primary flex-1 min-w-0 text-left"
            >
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </span>
          </div>

          {!selectionMode && (
            <div className="flex items-center gap-1">
              {merchantUrl && (
                <a
                  href={merchantUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 text-primary/60 hover:text-primary"
                  title={t("myGear.actions.openLink", "Open product link")}
                >
                  <FaShoppingCart className="text-sm" />
                </a>
              )}
              <button
                type="button"
                disabled={actionLoading === item._id}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 text-primary/60 hover:text-primary focus:outline-none"
                title={t("myGear.actions.delete", "Delete")}
              >
                <FaTrash className="text-sm" />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Weight */}
        <div className="row-start-2 col-span-2 text-primary/70">
          {item.weight ? (
            <span className="tabular-nums">{formatWeight(item.weight)} {unitLabel}</span>
          ) : (
            <span className="text-primary/40">—</span>
          )}
        </div>
      </div>

      {/* Desktop layout (single row) */}
      <div className="hidden sm:grid items-center text-sm grid-cols-[minmax(260px,1fr)_auto] gap-x-3">
        {/* Left: Type + Brand/Name + Weight */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {selectionMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.();
                }}
                className="p-1 text-secondary flex-shrink-0"
              >
                {isSelected ? (
                  <FaCheckSquare className="text-base" />
                ) : (
                  <FaRegSquare className="text-base text-primary/40" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewEdit();
              }}
              style={{ fontSize: 14 }}
              className="font-semibold text-primary flex-shrink-0 truncate max-w-[180px] hover:text-primary/80"
            >
              {item.itemType || "—"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewEdit();
              }}
              style={{ fontSize: 14 }}
              className="truncate text-primary text-left hover:text-primary/80"
            >
              {item.brand && <span className="mr-1">{item.brand}</span>}
              {item.name}
            </button>
            {item.weight && (
              <div className="ml-auto tabular-nums text-primary/70 flex-shrink-0">
                {formatWeight(item.weight)} {unitLabel}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart + Delete buttons */}
        {!selectionMode && (
          <div className="flex items-center gap-1 justify-self-end">
            {merchantUrl && (
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-primary/60 hover:text-primary rounded"
                title={t("myGear.actions.openLink", "Open product link")}
              >
                <FaShoppingCart className="text-sm" />
              </a>
            )}
            <button
              type="button"
              disabled={actionLoading === item._id}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 text-primary/60 hover:text-primary focus:outline-none rounded"
              title={t("myGear.actions.delete", "Delete")}
            >
              <FaTrash className="text-sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
