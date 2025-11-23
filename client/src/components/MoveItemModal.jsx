// src/components/MoveItemModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function MoveItemModal({
  isOpen,
  onClose,
  item,
  fromCatId,
  categories,
  itemsMap,
  onMove, // ({ toCatId, positionIndex }) => void|Promise
}) {
  const [selectedCatId, setSelectedCatId] = useState(fromCatId || "");
  const [selectedPos, setSelectedPos] = useState(1);

  // Reset state when opening
  useEffect(() => {
    if (!isOpen || !item || !fromCatId) return;

    setSelectedCatId(fromCatId);

    const sourceArr = itemsMap?.[fromCatId] || [];
    const currentIndex = sourceArr.findIndex((i) => i._id === item._id);
    const fallbackPos =
      currentIndex >= 0 ? currentIndex + 1 : sourceArr.length + 1;

    setSelectedPos(fallbackPos);
  }, [isOpen, item, fromCatId, itemsMap]);

  const positionOptions = useMemo(() => {
    if (!selectedCatId) return [];

    const arr = itemsMap?.[selectedCatId] || [];
    const isSameCat = selectedCatId === fromCatId;
    const len = arr.length + (isSameCat ? 0 : 1); // extra slot when moving into a new cat

    return Array.from({ length: len }, (_, i) => i + 1);
  }, [itemsMap, selectedCatId, fromCatId]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCatId) return;
    const index = Math.max(0, (Number(selectedPos) || 1) - 1);
    onMove?.({ toCatId: selectedCatId, positionIndex: index });
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-neutral rounded-lg shadow-lg w-full max-w-sm mx-4 p-4 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-primary font-semibold text-base sm:text-lg">
            Move “{item.name}”
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-primaryAlt hover:text-primaryAlt/80 focus:outline-none"
            aria-label="Close move item modal"
          >
            <FaTimes />
          </button>
        </div>

        {/* Category select */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-primary/80 uppercase tracking-wide">
            Category
          </label>
          <select
            className="w-full border border-base-200 rounded px-2 py-1 bg-base-100 text-primary text-sm"
            value={selectedCatId}
            onChange={(e) => setSelectedCatId(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.title}
              </option>
            ))}
          </select>
        </div>

        {/* Position select */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-primary/80 uppercase tracking-wide">
            Position in category
          </label>
          <select
            className="w-full border border-base-200 rounded px-2 py-1 bg-base-100 text-primary text-sm"
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
          >
            {positionOptions.map((pos) => (
              <option key={pos} value={pos}>
                {pos === 1 ? "1 (top)" : pos}
              </option>
            ))}
          </select>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1 rounded bg-neutralAlt hover:bg-neutralAlt/90 text-primary text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1 rounded bg-secondary hover:bg-secondary/90 text-neutral text-sm"
          >
            Move item
          </button>
        </div>
      </form>
    </div>
  );
}
