// client/src/components/MyGearListItem.jsx
import React from "react";
import { FiTrash2, FiExternalLink, FiCheckSquare, FiSquare, FiStar } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import { tItemType } from "../config/catalogTaxonomy";

export default function MyGearListItem({
  item,
  formatWeight,
  unitLabel,
  t,
  actionLoading,
  onViewEdit,
  onDelete,
  onToggleWishlist,
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
                  <FiCheckSquare className="text-base" />
                ) : (
                  <FiSquare className="text-base text-primary/40" />
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
              {tItemType(t, item.itemType) || "—"}
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
              {onToggleWishlist && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
                  className="p-1 rounded"
                  title={item.status === "wishlisted" ? t("wishlist.actions.markOwned", "Mark as owned") : t("wishlist.actions.addToWishlist", "Add to wishlist")}
                >
                  {item.status === "wishlisted"
                    ? <FaStar className="text-sm text-amber-400" />
                    : <FiStar className="text-sm text-primary/40 hover:text-amber-400" />}
                </button>
              )}
              {merchantUrl && (
                <a
                  href={merchantUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 text-primary/60 hover:text-primary"
                  title={t("myGear.actions.openLink", "Open product link")}
                >
                  <FiExternalLink className="w-3 h-3" />
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
                <FiTrash2 className="text-sm" />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Weight + shared badge */}
        <div className="row-start-2 col-span-2 flex items-center gap-2 text-primary/70">
          {item.weight ? (
            <span className="tabular-nums">{formatWeight(item.weight)} {unitLabel}</span>
          ) : (
            <span className="text-primary/40">—</span>
          )}
          {item.importedFromShare && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700 flex-shrink-0">
              {t("myGear.badge.fromSharedList", "Shared list")}
            </span>
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
                  <FiCheckSquare className="text-base" />
                ) : (
                  <FiSquare className="text-base text-primary/40" />
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
              {tItemType(t, item.itemType) || "—"}
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
            {item.importedFromShare && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700">
                {t("myGear.badge.fromSharedList", "Shared list")}
              </span>
            )}
            {item.weight && (
              <div className="ml-auto tabular-nums text-primary/70 flex-shrink-0">
                {formatWeight(item.weight)} {unitLabel}
              </div>
            )}
          </div>
        </div>

        {/* Right: Star + Cart + Delete buttons */}
        {!selectionMode && (
          <div className="flex items-center gap-1 justify-self-end">
            {onToggleWishlist && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
                className="p-2 rounded"
                title={item.status === "wishlisted" ? t("wishlist.actions.markOwned", "Mark as owned") : t("wishlist.actions.addToWishlist", "Add to wishlist")}
              >
                {item.status === "wishlisted"
                  ? <FaStar className="text-sm text-amber-400" />
                  : <FiStar className="text-sm text-primary/40 hover:text-amber-400" />}
              </button>
            )}
            {merchantUrl && (
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-primary/60 hover:text-primary rounded"
                title={t("myGear.actions.openLink", "Open product link")}
              >
                <FiExternalLink className="w-3 h-3" />
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
              <FiTrash2 className="text-sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
