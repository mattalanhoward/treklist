import React, { useState, useEffect } from "react";
import { FaTimes, FaRoute } from "react-icons/fa";
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
  const [notes, setNotes] = useState("");
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

  // Pull locale from user settings
  const { locale } = useUserSettings();
  const dfnsLocale = dateFnsLocales[locale] || dateFnsLocales["en-US"];

  // initialize form when list changes
  useEffect(() => {
    if (!list) return;
    setTitle(list.title || "");
    setNotes(list.notes || "");
    setTripStart(list.tripStart ? new Date(list.tripStart) : null);
    setTripEnd(list.tripEnd ? new Date(list.tripEnd) : null);
    setLocation(list.location || "");
    const raw = list.links || [];
    setLinks([
      { label: raw[0]?.label || "", url: raw[0]?.url || "" },
      { label: raw[1]?.label || "", url: raw[1]?.url || "" },
      { label: raw[2]?.label || "", url: raw[2]?.url || "" },
    ]);
    setDirty(false);
  }, [list]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!list?._id) return;

    try {
      await api.patch(`/dashboard/${list._id}`, {
        title,
        notes,
        tripStart: tripStart ? tripStart.toISOString() : null,
        tripEnd: tripEnd ? tripEnd.toISOString() : null,
        location,
        links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      });
      onRefresh();
      onRefreshSidebar();
      // toast.success(t("gearListDetailsModal.toast.saveSuccess"));
      setDirty(false);
      onClose();
    } catch (err) {
      console.error("Failed to save list details:", err);
      const msg =
        err.response?.data?.message ||
        t("gearListDetailsModal.toast.saveFailed");
      toast.error(msg);
    }
  };

  const handleClose = () => {
    if (isDirty) setShowConfirmClose(true);
    else onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50">
      <form
        onSubmit={handleSave}
        className="bg-neutralAlt rounded-lg shadow-2xl border border-neutral/60 max-w-xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4 overflow-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            {t("gearListDetailsModal.title")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-error hover:text-error/80"
            aria-label={t("auth.a11y.closeModal")}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Grid: 3 cols on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Weight Breakdown full row */}
          <div className="md:col-span-3 flex flex-col items-center px-2 py-1">
            <label className="block font-medium text-primary mb-3">
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

          {/* Name */}
          <div className="md:col-span-2">
            <label className="block font-medium text-primary mb-1">
              {t("gearListDetailsModal.labels.name")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
            />
          </div>

          {/* Trip Dates */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            {/* Trip Start */}
            <div>
              <label className="block font-medium text-primary mb-1">
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
                className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
                placeholderText={t("gearListDetailsModal.placeholders.date")}
              />
            </div>
            {/* Trip End */}
            <div>
              <label className="block font-medium text-primary mb-1">
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
                className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
                placeholderText={t("gearListDetailsModal.placeholders.date")}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block font-medium text-primary mb-1">
              {t("gearListDetailsModal.labels.location")}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setDirty(true);
              }}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
            />
          </div>

          {/* Links */}
          <div className="md:col-span-3">
            <label className="block font-medium text-primary mb-1">
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
                      placeholder={t("gearListDetailsModal.placeholders.linkLabel")}
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

          {/* Notes */}
          <div className="md:col-span-3">
            <label className="block font-medium text-primary mb-1">
              {t("gearListDetailsModal.labels.notes")}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              className="w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50"
            />
          </div>

          {/* Stats */}
          <div className="md:col-span-2 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-primary">
            <p className="flex items-baseline gap-1">
              <span className="font-medium">
                {t("gearListDetailsModal.stats.itemsCount")}{" "}
              </span>
              <span>{itemsCount}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary"
          >
            {t("actions.cancel")}
          </button>
          <button
            type="submit"
            className="px-2 py-1 bg-secondary text-white rounded hover:bg-secondary/80"
          >
            {t("actions.save")}
          </button>
        </div>
      </form>
      {/* Confirm discard */}
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
