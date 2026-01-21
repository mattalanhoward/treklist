// src/components/StatWithDetails.jsx
import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useUnit } from "../hooks/useUnit";
import { formatWeight } from "../utils/weight";

/**
 * Renders a stat with an icon and weight, showing details in a popover
 */
export default function StatWithDetails({
  icon: Icon,
  raw,
  label,
  items = [],
  colorClass,
  disablePopover = false,
}) {
  // 1️⃣ pull the current unit (e.g. "g", "kg", "lb", "oz", or "auto")
  const unit = useUnit();

  // 2️⃣ format the total/raw value
  const displayValue = formatWeight(raw, unit); // :contentReference[oaicite:0]{index=0}

  if (disablePopover) {
    // just render the static stat – no popover, no hover / click
    return (
      <div className="flex items-center space-x-1">
        <Icon className={`text-base ${colorClass || ""}`} />
        <span className="text-sm text-primary">{displayValue}</span>{" "}
      </div>
    );
  }

  // otherwise fall back to your normal interactive version:
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <div
          title={label}
          className={`flex items-center space-x-1 cursor-help`}
        >
          <Icon className={`w-4 h-4 ${colorClass || ""}`} />
          <span className="text-primary">{displayValue}</span>
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          className="
    w-72 p-2 rounded-lg shadow-lg
    max-h-64 overflow-y-auto text-xs z-[9999]
    bg-base-100 text-primary
    border border-primary/20
  "
        >
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-primary">{label}</span>
            <span className="font-medium text-primary">{displayValue}</span>
          </div>

          <ul className="divide-y divide-primary/15">
            {items.map((it) => (
              <li
                key={it._id}
                className="py-1 flex justify-between hover:bg-primary/10 rounded px-1"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium truncate text-primary">
                    {it.name}
                  </span>
                  <span className="text-xs text-secondary truncate">
                    {it.brand} • {it.itemType}
                  </span>
                </div>
                <span className="ml-2 whitespace-nowrap text-primary">
                  {formatWeight(it.weight * (it.quantity || 1), unit)}
                </span>
              </li>
            ))}
          </ul>

          <Popover.Arrow className="fill-[rgb(var(--color-base-100-rgb))]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
