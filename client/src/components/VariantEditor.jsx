// client/src/components/VariantEditor.jsx
// =============================================================================
// ADMIN VARIANT MATRIX EDITOR
// =============================================================================
// Edits a CatalogItem's variant structure: variantAxes (1-3 axes), the variant
// rows (per-variant weight / sku / attribute overrides) and defaultVariantKey.
//
// Conventions this editor enforces (see catalogItem.js):
// - variant key = axis values joined by " / " in axis order (auto-generated;
//   renaming an axis value migrates keys/options automatically)
// - color is NOT an axis (collapse it) — only weight/spec-varying axes
// - ragged matrices are supported by deleting invalid combos (or by using a
//   single combined axis with explicit rows)
//
// Weights are kept as STRINGS in this editor ("" = not set) so inputs behave;
// the parent converts to numbers on submit.
// =============================================================================

import React, { useState } from "react";
import { FiX, FiPlus, FiChevronDown, FiChevronUp } from "react-icons/fi";
import AttributeFields from "./AttributeFields";

const MAX_AXES = 3;

function keyOf(axes, options) {
  return axes
    .map((a) => String(options?.[a.name] ?? "").trim())
    .join(" / ");
}

function cartesian(axes) {
  return axes.reduce(
    (combos, axis) =>
      combos.flatMap((combo) =>
        axis.values.map((val) => ({ ...combo, [axis.name]: val })),
      ),
    [{}],
  );
}

export default function VariantEditor({
  itemType,
  variantAxes,
  variants,
  defaultVariantKey,
  onChange,
}) {
  const axes = Array.isArray(variantAxes) ? variantAxes : [];
  const rows = Array.isArray(variants) ? variants : [];
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [newValueByAxis, setNewValueByAxis] = useState({});
  const [newRowSel, setNewRowSel] = useState({});

  // Mark the current default row so mutations (rename/delete) can follow it.
  const markedRows = () =>
    rows.map((r) => ({ ...r, __def: r.key === defaultVariantKey }));

  const emit = (nextAxes, nextMarkedRows) => {
    const keyed = nextMarkedRows.map((r) => ({
      ...r,
      key: keyOf(nextAxes, r.options),
    }));
    const defRow = keyed.find((r) => r.__def);
    const nextDefault = defRow ? defRow.key : keyed[0]?.key || "";
    onChange({
      variantAxes: nextAxes,
      variants: keyed.map((r) => {
        const rest = { ...r };
        delete rest.__def;
        return rest;
      }),
      defaultVariantKey: nextDefault,
    });
  };

  // ---------------------------------------------------------------------------
  // Axis mutations
  // ---------------------------------------------------------------------------

  const addAxis = () => {
    if (axes.length >= MAX_AXES) return;
    emit([...axes, { name: "", values: [] }], markedRows());
  };

  const removeAxis = (i) => {
    const axis = axes[i];
    const nextAxes = axes.filter((_, idx) => idx !== i);
    // Strip that option from rows; collapsed duplicates keep the first row.
    const seen = new Set();
    const nextRows = [];
    for (const r of markedRows()) {
      const options = { ...r.options };
      delete options[axis.name];
      const k = keyOf(nextAxes, options);
      if (seen.has(k)) continue;
      seen.add(k);
      nextRows.push({ ...r, options });
    }
    emit(nextAxes, nextRows);
  };

  const renameAxis = (i, newName) => {
    const oldName = axes[i].name;
    const nextAxes = axes.map((a, idx) =>
      idx === i ? { ...a, name: newName } : a,
    );
    const nextRows = markedRows().map((r) => {
      if (!(oldName in (r.options || {}))) return r;
      const options = { ...r.options };
      options[newName] = options[oldName];
      if (newName !== oldName) delete options[oldName];
      return { ...r, options };
    });
    emit(nextAxes, nextRows);
  };

  const addAxisValue = (i) => {
    const axis = axes[i];
    const val = String(newValueByAxis[i] || "").trim();
    if (!val || axis.values.includes(val)) return;
    const wasEmpty = axis.values.length === 0;
    const nextAxes = axes.map((a, idx) =>
      idx === i ? { ...a, values: [...a.values, val] } : a,
    );
    // First value of a NEW axis: assign it to all existing rows so they stay
    // valid combos.
    const nextRows = wasEmpty
      ? markedRows().map((r) => ({
          ...r,
          options: { ...r.options, [axis.name]: val },
        }))
      : markedRows();
    setNewValueByAxis((prev) => ({ ...prev, [i]: "" }));
    emit(nextAxes, nextRows);
  };

  const renameAxisValue = (i, vi, newVal) => {
    const axis = axes[i];
    const oldVal = axis.values[vi];
    const nextAxes = axes.map((a, idx) =>
      idx === i
        ? { ...a, values: a.values.map((v, vIdx) => (vIdx === vi ? newVal : v)) }
        : a,
    );
    const nextRows = markedRows().map((r) =>
      r.options?.[axis.name] === oldVal
        ? { ...r, options: { ...r.options, [axis.name]: newVal } }
        : r,
    );
    emit(nextAxes, nextRows);
  };

  const removeAxisValue = (i, vi) => {
    const axis = axes[i];
    const val = axis.values[vi];
    const nextAxes = axes.map((a, idx) =>
      idx === i ? { ...a, values: a.values.filter((_, vIdx) => vIdx !== vi) } : a,
    );
    const nextRows = markedRows().filter(
      (r) => r.options?.[axis.name] !== val,
    );
    emit(nextAxes, nextRows);
  };

  // ---------------------------------------------------------------------------
  // Row mutations
  // ---------------------------------------------------------------------------

  const validAxes = axes.filter((a) => String(a.name).trim() && a.values.length);
  const existingKeys = new Set(rows.map((r) => r.key));
  const missingCombos = validAxes.length
    ? cartesian(validAxes).filter(
        (options) => !existingKeys.has(keyOf(axes, options)),
      )
    : [];

  const generateMissing = () => {
    if (!missingCombos.length) return;
    const added = missingCombos.map((options) => ({
      key: keyOf(axes, options),
      options,
      weightGrams: "",
      sku: "",
      attributes: {},
    }));
    emit(axes, [...markedRows(), ...added]);
  };

  const newRowOptions = () => {
    const options = {};
    for (const a of validAxes) {
      const val = newRowSel[a.name];
      if (!val) return null;
      options[a.name] = val;
    }
    return options;
  };
  const newRowReady = (() => {
    const options = newRowOptions();
    return options && !existingKeys.has(keyOf(axes, options));
  })();

  const addRow = () => {
    const options = newRowOptions();
    if (!options || existingKeys.has(keyOf(axes, options))) return;
    emit(axes, [
      ...markedRows(),
      { key: "", options, weightGrams: "", sku: "", attributes: {} },
    ]);
  };

  const removeRow = (idx) => {
    if (expandedIdx === idx) setExpandedIdx(null);
    emit(
      axes,
      markedRows().filter((_, i) => i !== idx),
    );
  };

  const updateRow = (idx, patch) => {
    emit(
      axes,
      markedRows().map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const setDefault = (key) => {
    onChange({ variantAxes: axes, variants: rows, defaultVariantKey: key });
  };

  const missingWeightCount = rows.filter(
    (r) => !String(r.weightGrams ?? "").trim(),
  ).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 text-xs sm:text-sm">
      <div className="text-[11px] text-primary/70 bg-base-200/50 rounded p-2">
        Only weight/spec-varying axes (Volume, Torso Size, Temperature, Fill,
        Size…) — collapse color. For ragged matrices (only some combos exist),
        generate all combinations and delete the invalid rows, or use one
        combined axis. Offers do <span className="font-semibold">not</span>{" "}
        route per variant (one buy-link per item).
      </div>

      {/* AXES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-primary">Variant axes</div>
          <button
            type="button"
            onClick={addAxis}
            disabled={axes.length >= MAX_AXES}
            className="btn btn-ghost btn-xs text-primary disabled:opacity-40"
            title={
              axes.length >= MAX_AXES
                ? `Max ${MAX_AXES} axes`
                : "Add a variant axis"
            }
          >
            <FiPlus /> Add axis
          </button>
        </div>

        {axes.length === 0 && (
          <div className="text-primary/60 italic">
            No variants — this item uses its base weight. Add an axis (e.g.
            "Size", "Temperature") to start a variant matrix.
          </div>
        )}

        {axes.map((axis, i) => (
          <div
            key={i}
            className="border border-primary/30 rounded p-2 space-y-2 bg-neutralAlt/40"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={axis.name}
                onChange={(e) => renameAxis(i, e.target.value)}
                placeholder="Axis name (e.g. Volume)"
                className="border border-primary rounded px-2 py-1 text-primary w-48"
              />
              <span className="text-primary/50">
                {axis.values.length} value{axis.values.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => removeAxis(i)}
                className="btn btn-ghost btn-xs text-error ml-auto"
                title="Remove axis (drops its option from all variants)"
              >
                <FiX />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {axis.values.map((val, vi) => (
                <span
                  key={vi}
                  className="inline-flex items-center gap-0.5 border border-primary/40 rounded px-1 py-0.5"
                >
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => renameAxisValue(i, vi, e.target.value)}
                    className="bg-transparent text-primary px-1 py-0"
                    style={{ width: `${Math.max(4, val.length + 1)}ch` }}
                    title="Rename value (migrates variant rows)"
                  />
                  <button
                    type="button"
                    onClick={() => removeAxisValue(i, vi)}
                    className="text-error/70 hover:text-error"
                    title="Remove value (deletes variants using it)"
                  >
                    <FiX size={12} />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={newValueByAxis[i] || ""}
                onChange={(e) =>
                  setNewValueByAxis((prev) => ({
                    ...prev,
                    [i]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAxisValue(i);
                  }
                }}
                placeholder="Add value…"
                disabled={!String(axis.name).trim()}
                className="border border-dashed border-primary/50 rounded px-2 py-0.5 text-primary w-28 disabled:opacity-40"
                title={
                  String(axis.name).trim()
                    ? "Type a value and press Enter"
                    : "Name the axis first"
                }
              />
              <button
                type="button"
                onClick={() => addAxisValue(i)}
                disabled={!String(newValueByAxis[i] || "").trim()}
                className="btn btn-ghost btn-xs text-primary disabled:opacity-40"
              >
                <FiPlus />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* VARIANT ROWS */}
      {validAxes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold text-primary">
              Variants ({rows.length})
              {missingWeightCount > 0 && (
                <span className="ml-2 text-warning font-normal">
                  ⚠ {missingWeightCount} missing weight
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={generateMissing}
              disabled={!missingCombos.length}
              className="btn btn-outline btn-xs disabled:opacity-40"
            >
              Generate missing combinations
              {missingCombos.length ? ` (${missingCombos.length})` : ""}
            </button>
          </div>

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-base-200/80">
                  <tr>
                    {axes.map((a, i) => (
                      <th key={i} className="text-left px-2 py-1 font-semibold">
                        {a.name || "—"}
                      </th>
                    ))}
                    <th className="text-left px-2 py-1 font-semibold">
                      Weight (g)
                    </th>
                    <th className="text-left px-2 py-1 font-semibold">SKU</th>
                    <th className="text-center px-2 py-1 font-semibold">
                      Default
                    </th>
                    <th className="text-center px-2 py-1 font-semibold">
                      Overrides
                    </th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const overrideCount = Object.keys(r.attributes || {}).length;
                    const noWeight = !String(r.weightGrams ?? "").trim();
                    return (
                      <React.Fragment key={r.key || idx}>
                        <tr
                          className={
                            "border-t border-base-200 " +
                            (noWeight ? "bg-warning/10" : "")
                          }
                        >
                          {axes.map((a, i) => (
                            <td key={i} className="px-2 py-1 text-primary">
                              {r.options?.[a.name] || "—"}
                            </td>
                          ))}
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={r.weightGrams ?? ""}
                              onChange={(e) =>
                                updateRow(idx, { weightGrams: e.target.value })
                              }
                              placeholder="g"
                              className="border border-primary rounded px-2 py-0.5 text-primary w-20"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={r.sku ?? ""}
                              onChange={(e) =>
                                updateRow(idx, { sku: e.target.value })
                              }
                              className="border border-primary/50 rounded px-2 py-0.5 text-primary w-24"
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <input
                              type="radio"
                              name="variant-default"
                              className="radio radio-xs"
                              checked={r.key === defaultVariantKey}
                              onChange={() => setDefault(r.key)}
                              title="Default variant (its weight/attrs represent the item)"
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIdx(
                                  expandedIdx === idx ? null : idx,
                                )
                              }
                              className={
                                "btn btn-ghost btn-xs " +
                                (overrideCount
                                  ? "text-secondary"
                                  : "text-primary/60")
                              }
                              title="Per-variant attribute overrides"
                            >
                              {overrideCount || ""}
                              {expandedIdx === idx ? (
                                <FiChevronUp />
                              ) : (
                                <FiChevronDown />
                              )}
                            </button>
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="btn btn-ghost btn-xs text-error"
                              title="Delete this variant"
                            >
                              <FiX />
                            </button>
                          </td>
                        </tr>

                        {expandedIdx === idx && (
                          <tr className="border-t border-base-200 bg-base-200/30">
                            <td colSpan={axes.length + 5} className="px-3 py-2">
                              <div className="text-[11px] text-primary/70 mb-2">
                                Attribute overrides for{" "}
                                <span className="font-semibold">{r.key}</span> —
                                only set fields that differ from the base
                                attributes (e.g. volumeLiters, tempRatingC,
                                torsoFitRange). They merge over the base when
                                this variant is selected.
                              </div>
                              {itemType ? (
                                <AttributeFields
                                  itemType={itemType}
                                  attributes={r.attributes || {}}
                                  onChange={(attrs) =>
                                    updateRow(idx, { attributes: attrs })
                                  }
                                />
                              ) : (
                                <div className="text-primary/60 italic">
                                  Set an item type first to edit per-variant
                                  attributes.
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add a single (ragged) combo */}
          <div className="flex flex-wrap items-end gap-2 border-t border-base-200 pt-2">
            {validAxes.map((a) => (
              <div key={a.name}>
                <label className="block text-[11px] text-primary/70 mb-0.5">
                  {a.name}
                </label>
                <select
                  value={newRowSel[a.name] || ""}
                  onChange={(e) =>
                    setNewRowSel((prev) => ({
                      ...prev,
                      [a.name]: e.target.value,
                    }))
                  }
                  className="border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                >
                  <option value="">Select…</option>
                  {a.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              disabled={!newRowReady}
              className="btn btn-outline btn-xs disabled:opacity-40"
            >
              <FiPlus /> Add variant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
