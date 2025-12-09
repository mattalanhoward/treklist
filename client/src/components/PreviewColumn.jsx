// src/components/PreviewColumn.jsx
import React, { useMemo } from "react";
import { FaGripVertical, FaTimes, FaPlus } from "react-icons/fa";
import { useWeight } from "../hooks/useWeight";
import { useTranslation } from "react-i18next";

export default function PreviewColumn({ category, items }) {
  const { t } = useTranslation("common");

  // mirror SortableColumn’s total weight logic (in grams)
  const totalWeight = useMemo(() => {
    return (items || []).reduce((sum, i) => {
      const qty = i.quantity || 1;
      const countable = i.worn ? Math.max(0, qty - 1) : qty;
      return sum + (i.weight || 0) * countable;
    }, 0);
  }, [items]);

  const totalWeightText = useWeight(totalWeight);

  return (
    <div
      className="
        snap-center flex-shrink-0 my-0 mx-2 w-90 sm:w-64
        bg-neutral rounded-lg p-3 flex flex-col self-start max-h-full
        opacity-75
      "
      style={{ pointerEvents: "none" }}
    >
      {/* Header row: grip + title + totalWeight + placeholder X */}
      <div className="flex items-center mb-2">
        <FaGripVertical className="hide-on-touch mr-2 text-primaryAlt" />
        <h3 className="flex-1 min-w-0 truncate pr-2 text-primaryAlt font-semibold">
          {category.title}
        </h3>
        <span className="pr-3 flex-shrink-0 text-primaryAlt">
          {totalWeightText}
        </span>
        {/* invisible X to match spacing with real column header */}
        <FaTimes className="flex-shrink-0 text-primaryAlt opacity-0" />
      </div>

      {/* Ghost items list – just skeleton cards */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-2">
        {(items || []).map((_, idx) => (
          <div
            key={idx}
            className="bg-base-100 px-3 py-2 rounded shadow flex flex-col opacity-60"
          >
            <div className="h-4 bg-base-200 rounded mb-1 w-1/2" />
            <div className="h-3 bg-base-200 rounded w-3/4" />
          </div>
        ))}
      </div>

      {/* Add Item button placeholder */}
      <button
        type="button"
        disabled
        className="p-2 w-full border border-base-100 rounded flex items-center justify-center space-x-2 bg-base-100 text-primary opacity-60 cursor-not-allowed"
        aria-hidden="true"
      >
        <FaPlus />
        <span className="text-sm">
          {t("gearList.items.addButton", "Add Item")}
        </span>
      </button>
    </div>
  );
}
