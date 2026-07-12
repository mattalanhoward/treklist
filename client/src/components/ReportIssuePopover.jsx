// src/components/ReportIssuePopover.jsx
// Anchored "report an issue" popover for the add-gear preview pane / sheet and
// the Item Details modal (add-gear decision 12, wireframe Frame 6). NEVER a
// stacked modal — it anchors to the ⚑ flag and floats above it. Pre-selects
// nothing; "Weight is incorrect" reveals the precision disclosure first to
// deflect false reports. Auto-attaches itemId, variant, shown values, date.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FiCheck } from "react-icons/fi";
import api from "../services/api";

const POP_WIDTH = 320;

export default function ReportIssuePopover({
  anchorRef,
  item,
  variantKey = null,
  shownWeight = "",
  shownCategory = "",
  shownItemType = "",
  disclosure = "",
  onClose,
}) {
  const { t } = useTranslation("common");
  const popRef = useRef(null);
  const [selected, setSelected] = useState(() => new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [pos, setPos] = useState(null);

  const FIELD_OPTIONS = [
    { id: "weight", label: t("reportIssue.fields.weight", "Weight is incorrect") },
    { id: "category", label: t("reportIssue.fields.category", "Wrong category or item type") },
    { id: "name", label: t("reportIssue.fields.name", "Name or brand is wrong") },
    { id: "image", label: t("reportIssue.fields.image", "Image or buy link is broken") },
    { id: "other", label: t("reportIssue.fields.other", "Something else") },
  ];

  // Position the popover relative to the flag: open upward when there's room,
  // else downward. Clamp horizontally into the viewport (mobile-safe).
  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const width = Math.min(POP_WIDTH, window.innerWidth - 16);
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
      if (left < 8) left = 8;
      const popH = popRef.current?.offsetHeight || 320;
      const openUp = r.top > popH + 16;
      const top = openUp
        ? Math.max(8, r.top - popH - 8)
        : Math.min(window.innerHeight - popH - 8, r.bottom + 8);
      setPos({ top, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, selected]);

  // Dismiss on outside click / Escape (popover, not modal — no scrim).
  useEffect(() => {
    const onDown = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!selected.size || sending) return;
    setSending(true);
    try {
      await api.post("/catalog/report", {
        catalogItemId: String(item._id),
        fields: [...selected],
        note: note.trim() || undefined,
        variantKey: variantKey || undefined,
        shownValues: {
          weight: shownWeight || null,
          category: shownCategory || null,
          itemType: shownItemType || null,
          name: item?.name || null,
        },
      });
      toast.success(t("reportIssue.toasts.sent", "Thanks — report sent"));
      onClose?.();
    } catch {
      toast.error(t("reportIssue.toasts.failed", "Couldn't send report"));
    } finally {
      setSending(false);
    }
  };

  const ctxParts = [
    `itemId ${String(item?._id || "").slice(-6)}`,
    `variant ${variantKey || "—"}`,
    `shown: ${[shownWeight, shownCategory, shownItemType].filter(Boolean).join(" / ") || "—"}`,
    new Date().toISOString().slice(0, 10),
  ];

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label={t("reportIssue.title", "Report an issue")}
      className="fixed z-[90] rounded-lg border border-primary/20 bg-base-100 shadow-2xl p-4 flex flex-col gap-2.5 text-sm"
      style={
        pos
          ? { top: pos.top, left: pos.left, width: pos.width }
          : { top: -9999, left: -9999, width: POP_WIDTH }
      }
    >
      <h3 className="text-[13px] font-semibold text-primary leading-snug">
        {t("reportIssue.titleFor", "Report an issue — {{name}}", { name: item?.name || "" })}
      </h3>

      {FIELD_OPTIONS.map((opt) => {
        const on = selected.has(opt.id);
        return (
          <React.Fragment key={opt.id}>
            <button
              type="button"
              onClick={() => toggle(opt.id)}
              aria-pressed={on}
              className={`flex items-center gap-2 text-left text-[12.5px] ${
                on ? "text-primary" : "text-primary/70"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0 ${
                  on ? "bg-secondary border-secondary text-white" : "border-primary/40"
                }`}
              >
                {on && <FiCheck size={10} />}
              </span>
              {opt.label}
            </button>
            {opt.id === "weight" && on && disclosure && (
              <p className="text-[11px] italic text-primary/45 pl-[22px] -mt-1">{disclosure}</p>
            )}
          </React.Fragment>
        );
      })}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={t("reportIssue.notePlaceholder", "Tell us more (optional) — e.g. “my scale says 162 g”")}
        className="mt-0.5 w-full resize-none rounded border border-primary/20 bg-base-100 px-2.5 py-1.5 text-[12px] text-primary placeholder:text-primary/40"
      />

      <p className="border-t border-primary/10 pt-2 font-mono text-[10px] leading-relaxed text-primary/40 break-words">
        {t("reportIssue.autoAttached", "auto-attached")}: {ctxParts.join(" · ")}
      </p>

      <div className="mt-0.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-primary/25 px-3 py-1 text-[12.5px] font-medium text-primary hover:bg-primary/5"
        >
          {t("actions.cancel", "Cancel")}
        </button>
        <button
          type="button"
          onClick={send}
          disabled={!selected.size || sending}
          className="rounded-md bg-secondary px-3 py-1 text-[12.5px] font-medium text-white hover:bg-secondary/90 disabled:opacity-50"
        >
          {sending
            ? t("reportIssue.buttons.sending", "Sending…")
            : t("reportIssue.buttons.send", "Send report")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
