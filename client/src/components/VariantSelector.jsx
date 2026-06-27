// src/components/VariantSelector.jsx
// Pill-based selector for catalog variant axes (e.g. Temperature × Size).
// Used in both the add/swap preview and the edit modal so the look stays in sync.
//
// Size values carry a verbose fit hint, e.g. `Standard-Short (Fits up to 55" / 5' 6")`.
// We show the short label on the pill and surface the fit hint as a caption for
// the SELECTED value, while the full value stays the stored option value.
import React from "react";

// Only strip a "fits / up to …" parenthetical (the long size hint). Leave short
// parentheticals like a temperature's "(-7C)" on the pill.
const FIT_PARENS = /\s*\((?:[^)]*(?:fits|up to)[^)]*)\)/i;

function shortLabel(value) {
  const s = String(value ?? "");
  return s.replace(FIT_PARENS, "").trim() || s;
}

function fitNote(value) {
  const m = String(value ?? "").match(/\(([^)]*(?:fits|up to)[^)]*)\)/i);
  return m ? m[1].trim() : "";
}

export default function VariantSelector({
  axes,
  selectedOptions = {},
  onChange,
  disabled = false,
}) {
  if (!Array.isArray(axes) || axes.length === 0) return null;

  return (
    <div className="space-y-2 px-3 py-1">
      {axes.map((axis) => {
        const selected = selectedOptions?.[axis.name] ?? "";
        const note = fitNote(selected);
        return (
          <div
            key={axis.name}
            className="grid grid-cols-[140px_1fr] gap-3 items-start"
          >
            <div className="text-primary font-semibold pt-1">{axis.name}:</div>
            <div>
              <div className="flex flex-wrap gap-1">
                {(axis.values || []).map((val) => {
                  const isSel = val === selected;
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange?.(axis.name, val)}
                      title={val}
                      aria-pressed={isSel}
                      className={`px-2 py-0.5 rounded-full text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSel
                          ? "bg-secondary text-white border-secondary"
                          : "border-primary/25 text-primary/70 hover:border-secondary/50 hover:text-primary"
                      }`}
                    >
                      {shortLabel(val)}
                    </button>
                  );
                })}
              </div>
              {note && (
                <div className="text-xs text-primary/50 mt-1">{note}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
