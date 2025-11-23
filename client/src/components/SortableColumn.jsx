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
import { useScrollPreserver } from "../hooks/useScrollPreserver";
import { useUserSettings } from "../contexts/UserSettings";
import { useWeight } from "../hooks/useWeight";

export default function SortableColumn({
  category,
  items,
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
  const scrollRef = useScrollPreserver(items);
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

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: `cat-${catId}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const { theme, altTheme } = useUserSettings();
  const isAlt = theme === altTheme;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="snap-center flex-shrink-0 my-0 mx-2 w-90 sm:w-64 bg-neutral rounded-lg p-3 flex flex-col self-start max-h-full"
    >
      <div className="flex items-center mb-2">
        <FaGripVertical
          {...attributes}
          {...listeners}
          className="hide-on-touch mr-2 cursor-grab text-primaryAlt"
        />
        {editingCatId === catId ? (
          <input
            autoFocus
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => {
              setEditingCatId(null);
              onEditCat(localTitle);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="flex-1 border border-base-100 rounded p-1 bg-base-100"
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
              {category.title}
            </h3>
            <span
              className="
                pr-3 flex-shrink-0 text-primaryAlt"
            >
              {totalWeightText}
            </span>
            <FaTimes
              onClick={() => onDeleteCategory(catId)}
              className="cursor-pointer flex-shrink-0 text-primaryAlt hover:text-primaryAlt/80"
            />
          </>
        )}
      </div>

      <SortableContext
        items={items.map((i) => `item-${catId}-${i._id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={scrollRef} className="overflow-y-auto mb-2 space-y-2">
          {items.map((item) => (
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
        className="p-2 w-full border border-base-100 rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
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
    </div>
  );
}
