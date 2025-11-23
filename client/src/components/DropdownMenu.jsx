// src/components/DropdownMenu.jsx
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function mergeRefs(refA, refB) {
  return (node) => {
    if (typeof refA === "function") refA(node);
    else if (refA && typeof refA === "object") refA.current = node;

    if (typeof refB === "function") refB(node);
    else if (refB && typeof refB === "object") refB.current = node;
  };
}

export default function DropdownMenu({ trigger, items, menuWidth = "w-44" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const toggleOpen = (event) => {
    event?.stopPropagation?.();

    setOpen((prev) => {
      const next = !prev;

      if (!prev && triggerRef.current && typeof window !== "undefined") {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportWidth =
          window.innerWidth || document.documentElement.clientWidth;

        const maxMenuWidth = 260;
        const left = Math.min(
          rect.left + window.scrollX,
          viewportWidth - maxMenuWidth
        );
        const top = rect.bottom + window.scrollY + 4;

        setPosition({ top, left });
      }

      return next;
    });
  };

  // 🔑 Close only when clicking *outside* trigger + menu
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      const t = e.target;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) {
        return; // click is inside; do nothing
      }
      setOpen(false);
    };

    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Clone trigger to inject ref + click handler
  const clonedTrigger = React.cloneElement(trigger, {
    ref: mergeRefs(trigger.ref, triggerRef),
    onClick: (e) => {
      if (typeof trigger.props.onClick === "function") {
        trigger.props.onClick(e);
      }
      if (!e.defaultPrevented) {
        toggleOpen(e);
      }
    },
  });

  const menu =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: position.top,
              left: position.left,
              zIndex: 50,
            }}
            className={`mt-1 rounded shadow-lg border border-base-300 bg-base-100 ${menuWidth}`}
          >
            <ul className="py-1 text-sm text-primary">
              {items.map((item) =>
                item.render ? (
                  <li key={item.key} className="px-3 py-1">
                    {item.render()}
                  </li>
                ) : (
                  <li key={item.key}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        item.onClick?.();
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm cursor-pointer rounded-none transition-colors ${
                        item.disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-primary/10 focus:bg-primary/10"
                      } ${item.className || ""}`}
                    >
                      {item.label}
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {clonedTrigger}
      {menu}
    </>
  );
}
