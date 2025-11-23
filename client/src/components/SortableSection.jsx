import React, { useState, useMemo } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaGripVertical, FaTimes, FaPlus } from "react-icons/fa";
import SortableItem from "../components/SortableItem";
import AddGearItemModal from "../components/AddGearItemModal";
import { useUserSettings } from "../contexts/UserSettings";
import { useWeight } from "../hooks/useWeight";

// ───────────── SORTABLESECTION (LIST MODE) ─────────────
export default function SortableSection({
  category,
  items,
  activeId,
  editingCatId,
  setEditingCatId,
  onEditCat,
  onDeleteCategory,
  showAddModalCat,
  setShowAddModalCat,
  fetchItems,
  listId,
  viewMode,
  onDeleteItem,
  onToggleWorn,
  onToggleConsumable,
  onQuantityChange,
  onMoveItem,
  onItemUpdated,
}) {
  const filtered = useMemo(
    () => items.filter((i) => `item-${category._id}-${i._id}` !== activeId),
    [items, activeId, category._id]
  );

  const catId = category._id;

  const [localTitle, setLocalTitle] = useState(category.title);

  // 1️⃣ Compute total in grams (memoized so it only re-runs when `items` changes)
  const totalWeight = useMemo(() => {
    return items.reduce((sum, i) => {
      const qty = i.quantity || 1;
      const countable = i.worn ? Math.max(0, qty - 1) : qty;
      return sum + (i.weight || 0) * countable;
    }, 0);
  }, [items]);

  // 2️⃣ Convert & format according to the user's unit preference
  const totalWeightText = useWeight(totalWeight);

  // useSortable for the category header itself:
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: `cat-${catId}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const { theme, altTheme } = useUserSettings();
  const isAlt = theme === altTheme;

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="bg-neutral rounded-lg p-4 mb-6"
    >
      <div className="flex items-center mb-3 min-w-0">
        <FaGripVertical
          {...attributes}
          {...listeners}
          className="hide-on-touch mr-2 cursor-grab text-primaryAlt"
        />

        {editingCatId === catId ? (
          // Inline <input> that saves on blur or Enter
          <input
            autoFocus
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => {
              setEditingCatId(null);
              onEditCat(localTitle);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="flex-1 border border-primary rounded p-1 bg-base-100"
          />
        ) : (
          <>
            <h3
              onClick={() => {
                setEditingCatId(catId);
                setLocalTitle(category.title);
              }}
              className="flex-1 min-w-0 truncate pr-2 cursor-text text-primaryAlt"
            >
              <span>{category.title}</span>
            </h3>
            <span className="pr-3 flex-shrink-0 text-primaryAlt">
              {totalWeightText}
            </span>
            <FaTimes
              aria-label="Delete category"
              title="Delete category"
              onClick={() => onDeleteCategory(catId)}
              className="flex-shrink-0 cursor-pointer text-primaryAlt hover:text-primaryAlt/80"
            />
          </>
        )}
      </div>
      <SortableContext
        items={filtered.map((i) => `item-${catId}-${i._id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {filtered.map((item) => (
            <SortableItem
              key={`cat-${catId}-item-${item._id}`}
              item={item}
              fetchItems={fetchItems}
              listId={listId}
              catId={catId}
              isListMode={viewMode === "list"}
              onDelete={onDeleteItem}
              onToggleWorn={onToggleWorn}
              onToggleConsumable={onToggleConsumable}
              onQuantityChange={onQuantityChange}
              onMoveItem={onMoveItem}
              onItemUpdated={onItemUpdated}
            />
          ))}
        </div>
      </SortableContext>
      <button
        onClick={() => setShowAddModalCat(catId)}
        className="p-2 w-full border border-secondary rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
      >
        <FaPlus />
        <span className="text-xs">Add Item</span>
      </button>
      {showAddModalCat === catId && (
        <AddGearItemModal
          listId={listId}
          categoryId={catId}
          onClose={() => setShowAddModalCat(null)}
          onAdded={() => fetchItems(catId)}
        />
      )}
    </section>
  );
}
