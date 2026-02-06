// client/src/components/MyGearListItem.jsx
import React from "react";
import { FaTrash, FaEdit } from "react-icons/fa";

export default function MyGearListItem({
  item,
  formatWeight,
  unitLabel,
  t,
  actionLoading,
  onViewEdit,
  onDelete,
}) {
  const merchantUrl = item.link || item.affiliate?.deepLink;

  return (
    <div className="bg-base-100 px-3 sm:px-2 py-2 rounded shadow mb-2">
      {/* Mobile layout (2 rows) */}
      <div className="sm:hidden grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm">
        {/* Row 1: Type + Brand/Name + actions */}
        <div className="row-start-1 col-span-2 flex items-center justify-between space-x-2 overflow-x-hidden">
          <div className="flex items-center space-x-1 overflow-hidden min-w-0">
            <div className="font-semibold text-primary flex-shrink-0">
              {item.itemType || "—"}
            </div>
            {merchantUrl ? (
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary flex-1 min-w-0 hover:underline"
              >
                {item.brand && <span className="mr-1">{item.brand}</span>}
                {item.name}
              </a>
            ) : (
              <div className="truncate text-primary flex-1 min-w-0">
                {item.brand && <span className="mr-1">{item.brand}</span>}
                {item.name}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onViewEdit}
              className="p-1 text-secondary hover:text-secondary/80 focus:outline-none"
              title={t("myGear.actions.viewEdit", "View / Edit")}
            >
              <FaEdit className="text-sm" />
            </button>
            <button
              type="button"
              disabled={actionLoading === item._id}
              onClick={onDelete}
              className="p-1 text-error/70 hover:text-error focus:outline-none"
              title={t("myGear.actions.delete", "Delete")}
            >
              <FaTrash className="text-sm" />
            </button>
          </div>
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
            <div className="font-semibold text-primary flex-shrink-0 truncate max-w-[180px]">
              {item.itemType || "—"}
            </div>
            {merchantUrl ? (
              <a
                href={merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                {item.brand && <span className="mr-1">{item.brand}</span>}
                {item.name}
              </a>
            ) : (
              <div className="truncate text-primary">
                {item.brand && <span className="mr-1">{item.brand}</span>}
                {item.name}
              </div>
            )}
            {item.weight && (
              <div className="ml-auto tabular-nums text-primary/70 flex-shrink-0">
                {formatWeight(item.weight)} {unitLabel}
              </div>
            )}
          </div>
        </div>

        {/* Right: Edit + Delete buttons */}
        <div className="flex items-center gap-1 justify-self-end">
          <button
            type="button"
            onClick={onViewEdit}
            className="p-2 text-secondary hover:text-secondary/80 focus:outline-none rounded"
            title={t("myGear.actions.viewEdit", "View / Edit")}
          >
            <FaEdit className="text-sm" />
          </button>
          <button
            type="button"
            disabled={actionLoading === item._id}
            onClick={onDelete}
            className="p-2 text-error/70 hover:text-error focus:outline-none rounded"
            title={t("myGear.actions.delete", "Delete")}
          >
            <FaTrash className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}
