"use client";

import type { ReactNode } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/** Generic drag-and-drop grid (mouse, touch and keyboard). */
export function SortableGrid<T extends { id: string }>({
  items, onChange, render, className, disabled,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number, dragHandle: { attributes: object; listeners: object | undefined; isDragging: boolean }) => ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onChange(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy} disabled={disabled}>
        <div className={className}>
          {items.map((item, i) => (
            <SortableItem key={item.id} id={item.id}>
              {(handle) => render(item, i, handle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }: { id: string; children: (h: { attributes: object; listeners: object | undefined; isDragging: boolean }) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative touch-manipulation", isDragging && "z-20 opacity-80")}
    >
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
