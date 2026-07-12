import React, { useState, useMemo } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaGripVertical } from "react-icons/fa";
import { FiX, FiPlus } from "react-icons/fi";
import SortableItem from "../components/SortableItem";
import AddGearItemModal from "../components/AddGearItemModal";
import { useScrollPreserver } from "../hooks/useScrollPreserver";
import { useUserSettings } from "../contexts/UserSettings";
import { useWeight } from "../hooks/useWeight";
import { useTranslation } from "react-i18next";

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
  isLocked,

  sidebarDragOver = false,
  newItemId,
}) {
  const { t } = useTranslation("common");
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
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      data-tour="gearlist-category"
      ref={setNodeRef}
      style={style}
      className={`snap-center flex-shrink-0 my-0 mx-2 w-90 sm:w-72 bg-neutral rounded-lg p-3 flex flex-col self-start max-h-full transition-shadow ${sidebarDragOver ? "ring-2 ring-secondary" : ""}`}
    >
      <div className="flex items-center mb-2">
        <FaGripVertical
          {...(isLocked ? {} : { ...attributes, ...listeners })}
          className={`hide-on-touch mr-2 text-primaryAlt ${isLocked ? "invisible" : "cursor-grab"}`}
        />
        {editingCatId === catId && !isLocked ? (
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
                if (!isLocked) {
                  setEditingCatId(catId);
                  setLocalTitle(category.title);
                }
              }}
              className={`flex-1 min-w-0 truncate pr-2 text-primaryAlt ${isLocked ? "cursor-default" : "cursor-text"}`}
            >
              {category.title}
            </h3>
            <span
              className="
                pr-3 flex-shrink-0 text-primaryAlt"
            >
              {totalWeightText}
            </span>
            {!isLocked && (
              <FiX
                aria-label={t("gearList.confirm.deleteCategoryConfirm")}
                title={t("gearList.confirm.deleteCategoryConfirm")}
                onClick={() => onDeleteCategory(catId)}
                className="cursor-pointer flex-shrink-0 text-primaryAlt hover:text-primaryAlt/80"
              />
            )}
          </>
        )}
      </div>

      <SortableContext
        items={items.map((i) => `item-${catId}-${i._id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={scrollRef} className="overflow-y-auto mb-2 space-y-2">
          {items.map((item) => (
            <div
              key={`cat-${catId}-item-${item._id}`}
              className={item._id === newItemId ? "item-enter" : ""}
            >
              <SortableItem
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
                isLocked={isLocked}

              />
            </div>
          ))}
        </div>
      </SortableContext>

      {!isLocked && (
        <button
          data-tour="category-add-item"
          onClick={() => setShowAddModalCat(catId)}
          className="p-2 w-full border border-base-100 rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
          aria-label={t("gearList.items.addButton")}
          title={t("gearList.items.addButton")}
        >
          <FiPlus />
          <span className="text-sm">{t("gearList.items.addButton")} </span>
        </button>
      )}

      {showAddModalCat === catId && (
        <AddGearItemModal
          listId={listId}
          categoryId={catId}
          categoryName={category.title}
          onClose={() => setShowAddModalCat(null)}
          onAdded={() => fetchItems(catId)}
        />
      )}
    </div>
  );
}
