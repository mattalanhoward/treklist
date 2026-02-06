// src/components/DndContextWrapper.jsx
import React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { SortableContext } from "@dnd-kit/sortable";

export function DndContextWrapper({
  // required: the array of ids for the top‐level SortableContext
  items,
  strategy,
  onDragStart,
  onDragOver,
  onDragEnd,
  collisionDetection = closestCenter,
  modifiers = [],
  // how to render the DragOverlay
  renderDragOverlay,
  // all your draggable content
  children,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={modifiers}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={strategy}>
        {children}
      </SortableContext>
      {renderDragOverlay && renderDragOverlay()}
    </DndContext>
  );
}
