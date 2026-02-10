// client/src/components/MyGearTileCard.jsx
import React from "react";
import { FaTrash, FaShoppingCart, FaCheckSquare, FaRegSquare } from "react-icons/fa";
import { tItemType } from "../config/catalogTaxonomy";

function pickFirstImageUrl(item) {
  if (!item) return null;

  // 1) arrays
  const arrays = [item.imageUrls, item.images, item.photos, item.gallery].filter(
    Array.isArray,
  );

  for (const arr of arrays) {
    const first = arr.find((x) => typeof x === "string" && x.trim());
    if (first) return first;
    const firstObj = arr.find(
      (x) => x && typeof x === "object" && typeof x.url === "string",
    );
    if (firstObj?.url) return firstObj.url;
  }

  // 2) single string fields
  const direct =
    item.imageUrl ||
    item.image ||
    item.photoUrl ||
    item.thumbnailUrl ||
    item.thumbnail ||
    item.primaryImageUrl;

  if (typeof direct === "string" && direct.trim()) return direct;

  // 3) nested common shapes
  const nested =
    item.catalogItem?.imageUrl ||
    (Array.isArray(item.catalogItem?.imageUrls)
      ? item.catalogItem.imageUrls[0]
      : null) ||
    item.globalItem?.imageUrl ||
    (Array.isArray(item.globalItem?.imageUrls)
      ? item.globalItem.imageUrls[0]
      : null);

  if (typeof nested === "string" && nested.trim()) return nested;

  return null;
}

export default function MyGearTileCard({
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
  const imageUrl = pickFirstImageUrl(item);
  const merchantUrl = item.link || item.affiliate?.deepLink;

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect();
    }
  };

  return (
    <div
      className={`bg-base-100 rounded shadow border transition-colors overflow-hidden ${
        selectionMode ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "border-secondary ring-2 ring-secondary"
          : "border-primary/10 hover:border-primary/20"
      }`}
      onClick={handleCardClick}
    >
      {/* Top bar: ItemType left, checkbox/cart+delete button right */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewEdit();
          }}
          style={{ fontSize: 14 }}
          className="font-semibold text-primary truncate hover:text-primary/80"
        >
          {tItemType(t, item.itemType) || "—"}
        </button>

        {selectionMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className="p-1 text-secondary"
          >
            {isSelected ? (
              <FaCheckSquare className="text-base" />
            ) : (
              <FaRegSquare className="text-base text-primary/40" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            {merchantUrl && (
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 text-primary/60 hover:text-primary rounded"
                title={t("myGear.actions.openLink", "Open product link")}
              >
                <FaShoppingCart className="text-sm" />
              </a>
            )}
            <button
              type="button"
              disabled={actionLoading === item._id}
              onClick={handleDelete}
              className="p-1 text-primary/60 hover:text-primary rounded"
              title={t("myGear.actions.delete", "Delete")}
            >
              <FaTrash className="text-sm" />
            </button>
          </div>
        )}
      </div>

      {/* Image area - clickable to edit (disabled in selection mode) */}
      {/* Uses <div> instead of <button> because iOS Safari ignores aspect-ratio on buttons */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if (selectionMode) {
            e.stopPropagation();
            onToggleSelect?.();
          } else {
            onViewEdit();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selectionMode) {
              onToggleSelect?.();
            } else {
              onViewEdit();
            }
          }
        }}
        className="relative bg-neutral/10 aspect-[4/3] flex items-center justify-center w-full cursor-pointer hover:bg-neutral/20 transition-colors"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name || "Gear item"}
            className="max-h-full max-w-full object-contain p-3"
            loading="lazy"
          />
        ) : (
          <div className="text-primary/40 text-sm px-4 text-center">
            {t("myGear.tiles.noImage", "No image")}
          </div>
        )}

        {item.weight ? (
          <div className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-base-100/90 border border-primary/10 text-primary tabular-nums">
            {formatWeight(item.weight)} {unitLabel}
          </div>
        ) : null}
      </div>

      {/* Details - clickable to open edit */}
      <button
        type="button"
        onClick={(e) => {
          if (selectionMode) {
            e.stopPropagation();
            onToggleSelect?.();
          } else {
            onViewEdit();
          }
        }}
        className="px-3 py-3 space-y-1 w-full text-left hover:bg-neutral/5 transition-colors"
      >
        {item.brand ? (
          <div className="text-sm text-primary/70 truncate">{item.brand}</div>
        ) : null}

        <div style={{ fontSize: 14 }} className="font-semibold text-primary leading-snug line-clamp-2">
          {item.name}
        </div>

        {item.description ? (
          <div className="text-sm text-primary/70 line-clamp-3">
            {item.description}
          </div>
        ) : null}
      </button>
    </div>
  );
}
