// client/src/components/MyGearTileCard.jsx
import { FiTrash2, FiExternalLink, FiCheckSquare, FiSquare, FiStar } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
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
  onToggleWishlist,
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

  const handleContentClick = (e) => {
    if (selectionMode) {
      e.stopPropagation();
      onToggleSelect?.();
    } else {
      onViewEdit();
    }
  };

  const handleContentKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (selectionMode) {
        onToggleSelect?.();
      } else {
        onViewEdit();
      }
    }
  };

  return (
    <div
      className={`bg-base-100 rounded shadow border transition-colors overflow-hidden flex flex-row sm:flex-col ${
        selectionMode ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "border-secondary ring-2 ring-secondary"
          : "border-primary/10 hover:border-primary/20"
      }`}
      onClick={handleCardClick}
    >
      {/* Image area */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleContentClick}
        onKeyDown={handleContentKeyDown}
        className="relative bg-neutral/10 w-24 flex-shrink-0 sm:w-full sm:flex-none sm:aspect-[4/3] sm:overflow-hidden flex items-center justify-center cursor-pointer hover:bg-neutral/20 transition-colors"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name || "Gear item"}
            className="w-full h-full object-cover sm:object-contain sm:p-3 sm:max-h-full sm:max-w-full"
            loading="lazy"
          />
        ) : (
          <div className="text-primary/40 text-xs px-2 text-center">
            {t("myGear.tiles.noImage", "No image")}
          </div>
        )}

        {/* Shared list badge: desktop only (on mobile it's in the content area) */}
        {item.importedFromShare && (
          <div className="hidden sm:block absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded bg-amber-100/90 border border-amber-200 text-amber-700 pointer-events-none leading-tight">
            {t("myGear.badge.fromSharedList", "Shared list")}
          </div>
        )}

        {/* Weight badge: desktop only (on mobile it's in the content area) */}
        {item.weight ? (
          <div className="hidden sm:block absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-base-100/90 border border-primary/10 text-primary tabular-nums">
            {formatWeight(item.weight)} {unitLabel}
          </div>
        ) : null}
      </div>

      {/* Content area (right on mobile, bottom on sm+) */}
      <div className="flex-1 flex flex-col min-w-0 relative">
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
                <FiCheckSquare className="text-base" />
              ) : (
                <FiSquare className="text-base text-primary/40" />
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
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
                  className="p-1 text-primary/60 hover:text-primary rounded"
                  title={t("myGear.actions.openLink", "Open product link")}
                >
                  <FiExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                type="button"
                disabled={actionLoading === item._id}
                onClick={handleDelete}
                className="p-1 text-primary/60 hover:text-primary rounded"
                title={t("myGear.actions.delete", "Delete")}
              >
                <FiTrash2 className="text-sm" />
              </button>
            </div>
          )}
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
          className="px-3 py-2 flex-1 sm:flex-none sm:h-20 flex flex-col justify-center space-y-0.5 w-full text-left hover:bg-neutral/5 transition-colors"
        >
          {item.brand ? (
            <div className="text-sm text-primary/70 truncate">{item.brand}</div>
          ) : null}

          <div style={{ fontSize: 14 }} className="font-semibold text-primary leading-snug line-clamp-2">
            {item.name}
          </div>

          {/* Weight badge: mobile only */}
          {item.weight ? (
            <div className="sm:hidden text-xs text-primary/50 tabular-nums pt-0.5">
              {formatWeight(item.weight)} {unitLabel}
            </div>
          ) : null}
        </button>

        {/* Shared list badge: mobile only, bottom-right of content area */}
        {item.importedFromShare && (
          <div className="sm:hidden absolute bottom-2 right-2 text-[9px] px-1 py-0.5 rounded bg-amber-100/90 border border-amber-200 text-amber-700 pointer-events-none leading-tight">
            {t("myGear.badge.fromSharedList", "Shared list")}
          </div>
        )}
      </div>
    </div>
  );
}
