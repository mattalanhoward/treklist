import React, { useState, useEffect } from "react";
import { FaTimes, FaRoute, FaBold, FaItalic, FaListUl, FaListOl } from "react-icons/fa";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import api from "../services/api";
import ConfirmDialog from "./ConfirmDialog";
import PackStats from "./PackStats";
import { useUserSettings } from "../contexts/UserSettings";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { dateFnsLocales } from "../utils/dateLocales";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

/**
 * Modal for viewing/editing a gear list's details
 */
export default function GearListDetailsModal({
  isOpen,
  onClose,
  list,
  breakdowns,
  itemsCount,
  totalCost,
  onRefresh,
  onRefreshSidebar,
}) {
  const { t } = useTranslation("common");

  const [title, setTitle] = useState("");
  const [tripStart, setTripStart] = useState(null);
  const [tripEnd, setTripEnd] = useState(null);
  const [location, setLocation] = useState("");
  const [links, setLinks] = useState([
    { label: "", url: "" },
    { label: "", url: "" },
    { label: "", url: "" },
  ]);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [isDirty, setDirty] = useState(false);

  const { locale } = useUserSettings();
  const dfnsLocale = dateFnsLocales[locale] || dateFnsLocales["en-US"];

  // Convert legacy plain-text/markdown notes to HTML for TipTap.
  // New notes saved by TipTap will already contain HTML tags.
  function notesToHtml(content) {
    if (!content) return "";
    if (/<[a-z][\s\S]*?>/i.test(content)) return content; // already HTML
    return marked.parse(content);
  }

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: () => setDirty(true),
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  useEffect(() => {
    if (!list) return;
    setTitle(list.title || "");
    setTripStart(list.tripStart ? new Date(list.tripStart) : null);
    setTripEnd(list.tripEnd ? new Date(list.tripEnd) : null);
    setLocation(list.location || "");
    const raw = list.links || [];
    setLinks([
      { label: raw[0]?.label || "", url: raw[0]?.url || "" },
      { label: raw[1]?.label || "", url: raw[1]?.url || "" },
      { label: raw[2]?.label || "", url: raw[2]?.url || "" },
    ]);
    editor?.commands.setContent(notesToHtml(list.notes), false);
    setDirty(false);
  }, [list, editor]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!list?._id) return;
    try {
      await api.patch(`/dashboard/${list._id}`, {
        title,
        notes: editor?.getHTML() ?? "",
        tripStart: tripStart ? tripStart.toISOString() : null,
        tripEnd: tripEnd ? tripEnd.toISOString() : null,
        location,
        links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      });
      onRefresh();
      onRefreshSidebar();
      setDirty(false);
      onClose();
    } catch (err) {
      console.error("Failed to save list details:", err);
      toast.error(
        err.response?.data?.message || t("gearListDetailsModal.toast.saveFailed"),
      );
    }
  };

  const handleClose = () => {
    if (isDirty) setShowConfirmClose(true);
    else onClose();
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm";
  const labelClass = "block font-medium text-primary mb-1 text-sm";

  const toolbarBtn = (active) =>
    [
      "p-1.5 rounded transition-colors text-xs",
      active
        ? "bg-secondary/20 text-secondary"
        : "text-primary/60 hover:text-primary hover:bg-primary/10",
    ].join(" ");

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSave}
        className="bg-neutralAlt rounded-lg shadow-2xl border border-neutral/60 max-w-2xl w-full flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 sm:px-6 flex-shrink-0 border-b border-neutral/40">
          <div>
            <h2 className="text-xl font-semibold text-primary">
              {t("gearListDetailsModal.title")}
            </h2>
            <p className="text-xs text-primary/50 mt-0.5">
              {t("gearListDetailsModal.stats.itemsCount")} {itemsCount}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-error hover:text-error/80"
            aria-label={t("auth.a11y.closeModal")}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4">
          {/* Weight Breakdown */}
          <div className="flex flex-col items-center mb-4 pb-4 border-b border-neutral/40">
            <label className="block font-medium text-primary mb-3 text-sm">
              {t("gearListDetailsModal.labels.weightBreakdown")}
            </label>
            <div className="scale-110">
              <PackStats
                base={breakdowns.base.reduce(
                  (s, i) => s + (i.weight || 0) * (i.quantity || 1),
                  0,
                )}
                worn={breakdowns.worn.reduce(
                  (s, i) => s + (i.weight || 0) * (i.quantity || 1),
                  0,
                )}
                consumable={breakdowns.consumable.reduce(
                  (s, i) => s + (i.weight || 0) * (i.quantity || 1),
                  0,
                )}
                total={breakdowns.total.reduce(
                  (s, i) => s + (i.weight || 0) * (i.quantity || 1),
                  0,
                )}
                breakdowns={breakdowns}
                showLabels={true}
              />
            </div>
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Name — full width */}
            <div className="md:col-span-3">
              <label className={labelClass}>
                {t("gearListDetailsModal.labels.name")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className={inputClass}
              />
            </div>

            {/* Trip Start | Trip End | Location — one row */}
            <div>
              <label className={labelClass}>
                {t("gearListDetailsModal.labels.tripStart")}
              </label>
              <DatePicker
                selected={tripStart}
                onChange={(date) => {
                  setTripStart(date);
                  setDirty(true);
                }}
                dateFormat="P"
                locale={dfnsLocale}
                className={inputClass}
                placeholderText={t("gearListDetailsModal.placeholders.date")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("gearListDetailsModal.labels.tripEnd")}
              </label>
              <DatePicker
                selected={tripEnd}
                onChange={(date) => {
                  setTripEnd(date);
                  setDirty(true);
                }}
                dateFormat="P"
                locale={dfnsLocale}
                className={inputClass}
                placeholderText={t("gearListDetailsModal.placeholders.date")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("gearListDetailsModal.labels.location")}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setDirty(true);
                }}
                className={inputClass}
              />
            </div>

            {/* Links */}
            <div className="md:col-span-3">
              <label className={labelClass}>
                {t("gearListDetailsModal.labels.links")}
              </label>
              <div className="space-y-2">
                {links.map((link, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2">
                    {idx === 0 ? (
                      <div className="col-span-1 flex items-center gap-1.5 px-2 py-1 border border-primary/30 rounded bg-primary/5 text-sm text-primary/70 select-none">
                        <FaRoute className="flex-shrink-0" aria-hidden />
                        <span>{t("gearListDetailsModal.labels.routeSlot")}</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const updated = links.map((l, i) =>
                            i === idx ? { ...l, label: e.target.value } : l,
                          );
                          setLinks(updated);
                          setDirty(true);
                        }}
                        className="col-span-1 border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
                        placeholder={t(
                          "gearListDetailsModal.placeholders.linkLabel",
                        )}
                      />
                    )}
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => {
                        const updated = links.map((l, i) =>
                          i === idx ? { ...l, url: e.target.value } : l,
                        );
                        setLinks(updated);
                        setDirty(true);
                      }}
                      className="col-span-2 border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm"
                      placeholder={t("gearListDetailsModal.placeholders.linkUrl")}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes — TipTap WYSIWYG */}
            <div className="md:col-span-3">
              <label className={labelClass}>
                {t("gearListDetailsModal.labels.notes")}
              </label>
              <div className="border border-primary rounded overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 px-1 py-1 bg-primary/5 border-b border-primary/20">
                  <button
                    type="button"
                    title="Bold"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor?.chain().focus().toggleBold().run();
                    }}
                    className={toolbarBtn(editor?.isActive("bold"))}
                  >
                    <FaBold />
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor?.chain().focus().toggleItalic().run();
                    }}
                    className={toolbarBtn(editor?.isActive("italic"))}
                  >
                    <FaItalic />
                  </button>
                  <div className="w-px h-4 bg-primary/20 mx-1" />
                  <button
                    type="button"
                    title="Bullet list"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor?.chain().focus().toggleBulletList().run();
                    }}
                    className={toolbarBtn(editor?.isActive("bulletList"))}
                  >
                    <FaListUl />
                  </button>
                  <button
                    type="button"
                    title="Numbered list"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      editor?.chain().focus().toggleOrderedList().run();
                    }}
                    className={toolbarBtn(editor?.isActive("orderedList"))}
                  >
                    <FaListOl />
                  </button>
                </div>
                {/* Editor */}
                <EditorContent
                  editor={editor}
                  className="bg-base-100 text-primary text-sm min-h-[8rem] max-h-64 overflow-y-auto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 sm:px-6 flex-shrink-0 border-t border-neutral/40">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary text-sm border border-primary/20"
          >
            {t("actions.cancel")}
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 bg-secondary text-white rounded hover:bg-secondary/80 text-sm"
          >
            {t("actions.save")}
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showConfirmClose}
        title={t("gearListDetailsModal.confirm.discardTitle")}
        message={t("gearListDetailsModal.confirm.discardMessage")}
        confirmText={t("gearListDetailsModal.confirm.discardConfirm")}
        cancelText={t("gearListDetailsModal.confirm.discardCancel")}
        onConfirm={() => {
          setShowConfirmClose(false);
          onClose();
        }}
        onCancel={() => setShowConfirmClose(false)}
      />
    </div>
  );
}
