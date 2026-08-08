// client/src/components/MyGearInventoryTable.jsx
// Dense, sortable inventory table — the "powerful" desktop surface for the
// My Gear page's list view. Header cells drive the same sort state as the
// toolbar's sort pill (single source of truth in MyGearView).
import React from "react";
import {
  FiTrash2,
  FiExternalLink,
  FiCheckSquare,
  FiSquare,
  FiStar,
  FiChevronUp,
  FiChevronDown,
} from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import { resizedImageUrl } from "../utils/imageCdn";

// Sort caret for a sortable header. `dir` is "asc" | "desc" | null.
function SortCaret({ dir }) {
  if (!dir) return null;
  return dir === "asc" ? (
    <FiChevronUp className="inline text-xs" />
  ) : (
    <FiChevronDown className="inline text-xs" />
  );
}

export default function MyGearInventoryTable({
  items,
  sortKey,
  onSortChange,
  formatWeight,
  unitLabel,
  t,
  actionLoading,
  onViewEdit,
  onDelete,
  onToggleWishlist,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}) {
  // Map a column to its active sort direction (null = not the active sort).
  const dirFor = (col) => {
    if (col === "weight") {
      if (sortKey === "weightAsc") return "asc";
      if (sortKey === "weightDesc") return "desc";
      return null;
    }
    return sortKey === col ? "asc" : null;
  };

  const headerBtn = (col, onClick) =>
    `flex items-center gap-1 hover:text-primary transition-colors ${
      dirFor(col) ? "text-primary font-semibold" : ""
    } ${onClick ? "cursor-pointer" : ""}`;

  const sortByWeight = () =>
    onSortChange(sortKey === "weightDesc" ? "weightAsc" : "weightDesc");

  return (
    <div className="overflow-x-auto rounded-lg border border-primary/10">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-primary/50 border-b border-primary/10 bg-base-200/40">
            {selectionMode && <th className="w-9 px-2 py-2" />}
            <th className="w-10 px-2 py-2" />
            <th className="px-2 py-2">
              <button type="button" className={headerBtn("name", true)} onClick={() => onSortChange("name")}>
                {t("myGear.table.name", "Name")} <SortCaret dir={dirFor("name")} />
              </button>
            </th>
            <th className="px-2 py-2 hidden lg:table-cell">
              <button type="button" className={headerBtn("brand", true)} onClick={() => onSortChange("brand")}>
                {t("myGear.table.brand", "Brand")} <SortCaret dir={dirFor("brand")} />
              </button>
            </th>
            <th className="px-2 py-2 hidden xl:table-cell">
              <button type="button" className={headerBtn("category", true)} onClick={() => onSortChange("category")}>
                {t("myGear.table.category", "Category")} <SortCaret dir={dirFor("category")} />
              </button>
            </th>
            <th className="px-2 py-2 hidden lg:table-cell">{t("myGear.table.size", "Size")}</th>
            <th className="px-2 py-2 text-right">
              <button type="button" className={`${headerBtn("weight", true)} ml-auto`} onClick={sortByWeight}>
                {t("myGear.table.weight", "Weight")} <SortCaret dir={dirFor("weight")} />
              </button>
            </th>
            <th className="px-2 py-2 text-right w-12">{t("myGear.table.qty", "Qty")}</th>
            <th className="px-2 py-2 w-24 text-right" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = selectedIds?.has(item._id);
            const img = Array.isArray(item.imageUrls) ? item.imageUrls[0] : null;
            const merchantUrl = item.link || item.affiliate?.deepLink;
            const rowClick = () => {
              if (selectionMode) onToggleSelect?.(item._id);
              else onViewEdit?.(item);
            };
            return (
              <tr
                key={item._id}
                onClick={rowClick}
                className={`border-b border-primary/5 cursor-pointer transition-colors ${
                  isSelected ? "bg-secondary/10" : "hover:bg-primary/5"
                }`}
              >
                {selectionMode && (
                  <td className="px-2 py-1.5" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item._id); }}>
                    {isSelected ? (
                      <FiCheckSquare className="text-secondary" />
                    ) : (
                      <FiSquare className="text-primary/40" />
                    )}
                  </td>
                )}
                <td className="px-2 py-1.5">
                  <div className="h-8 w-8 rounded border border-primary/10 bg-white overflow-hidden flex items-center justify-center">
                    {img ? (
                      <img src={resizedImageUrl(img, 80)} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-[9px] text-primary/30">—</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1.5 min-w-0">
                  <div className="font-medium text-primary truncate max-w-[280px]">{item.name}</div>
                  {/* Brand shows here on narrow widths where the Brand column is hidden */}
                  {item.brand && (
                    <div className="lg:hidden text-xs text-primary/50 truncate">{item.brand}</div>
                  )}
                </td>
                <td className="px-2 py-1.5 hidden lg:table-cell text-primary/70 truncate max-w-[140px]">
                  {item.brand || "—"}
                </td>
                <td className="px-2 py-1.5 hidden xl:table-cell text-primary/70 truncate max-w-[160px]">
                  {item.catalogCategory || "—"}
                </td>
                <td className="px-2 py-1.5 hidden lg:table-cell text-primary/70">
                  {item.variantKey || "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-primary whitespace-nowrap">
                  {item.weight ? (
                    <>
                      {formatWeight(item.weight)} <span className="text-primary/50">{unitLabel}</span>
                    </>
                  ) : (
                    <span className="text-primary/40">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-primary/70">
                  {item.quantity || 1}
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 text-primary/50">
                    {onToggleWishlist && (
                      <button
                        type="button"
                        onClick={() => onToggleWishlist(item)}
                        title={item.status === "wishlisted"
                          ? t("wishlist.actions.markOwned", "Mark as owned")
                          : t("wishlist.actions.addToWishlist", "Add to wishlist")}
                        className="p-1 rounded hover:text-amber-400"
                      >
                        {item.status === "wishlisted"
                          ? <FaStar className="text-sm text-amber-400" />
                          : <FiStar className="text-sm" />}
                      </button>
                    )}
                    {merchantUrl && (
                      <a
                        href={merchantUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={t("myGear.actions.openLink", "Open product link")}
                        className="p-1 rounded hover:text-primary"
                      >
                        <FiExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={actionLoading === item._id}
                      title={t("myGear.actions.delete", "Delete")}
                      className="p-1 rounded hover:text-error"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
