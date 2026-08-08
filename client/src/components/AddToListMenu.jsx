// client/src/components/AddToListMenu.jsx
// Selection-bar action: pick a gear list to add the selected items to. The panel
// is portalled to <body> with fixed positioning because the selection bar clips
// its overflow (height-animation), so an in-flow dropdown would be cut off.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiFolderPlus } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import api from "../services/api";

export default function AddToListMenu({ onSelect, disabled = false }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState(null); // null = not yet loaded
  const [loading, setLoading] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  const loadLists = async () => {
    if (lists || loading) return;
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard");
      setLists(Array.isArray(data) ? data : []);
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  const openPanel = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const width = 240;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 6, left, width });
    }
    setOpen(true);
    loadLists();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const pick = (list) => {
    setOpen(false);
    onSelect?.(list);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex items-center gap-1 px-2 py-1 text-sm text-secondary hover:bg-secondary/10 rounded disabled:opacity-50"
      >
        <FiFolderPlus className="text-sm" />
        {t("myGear.actions.addToList", "Add to list")}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[90] rounded-lg border border-primary/15 bg-base-100 shadow-xl overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary/40 border-b border-primary/10">
            {t("myGear.actions.addToListTitle", "Add to list")}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-2 text-xs text-primary/40">{t("myGear.loadingLists", "Loading…")}</div>
            )}
            {!loading && lists && lists.length === 0 && (
              <div className="px-3 py-2 text-xs text-primary/40">{t("myGear.noLists", "No lists yet")}</div>
            )}
            {!loading && lists && lists.map((list) => (
              <button
                key={list._id}
                type="button"
                onClick={() => pick(list)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left text-primary hover:bg-primary/5 transition-colors"
              >
                <span className="truncate">{list.title}</span>
                {typeof list.itemCount === "number" && (
                  <span className="flex-none text-xs text-primary/40 tabular-nums">{list.itemCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
