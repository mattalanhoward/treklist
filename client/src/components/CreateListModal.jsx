import React, { useState, useRef, useEffect } from "react";
import { FiX } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { dateFnsLocales } from "../utils/dateLocales";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";

export default function CreateListModal({ isOpen, onClose, onCreated }) {
  const { t } = useTranslation("common");
  const { region, locale } = useUserSettings();
  const dfnsLocale = dateFnsLocales[locale] || dateFnsLocales["en-US"];

  const [name, setName] = useState("");
  const [tripStart, setTripStart] = useState(null);
  const [tripEnd, setTripEnd] = useState(null);
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setTripStart(null);
      setTripEnd(null);
      setLocation("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const inputClass =
    "w-full border border-primary rounded px-2 py-1 text-primary bg-base-100 placeholder:text-primary/50 text-sm";
  const labelClass = "block font-medium text-primary mb-1 text-sm";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = name.trim();
    if (!title) return toast.error(t("createListModal.toast.nameRequired"));

    setIsSubmitting(true);
    try {
      const { data } = await api.post("/dashboard", {
        title,
        region,
        tripStart: tripStart ? tripStart.toISOString() : null,
        tripEnd: tripEnd ? tripEnd.toISOString() : null,
        location: location.trim() || null,
      });
      localStorage.setItem("newListCallout", data.list._id);
      onCreated(data.list._id);
    } catch (err) {
      console.error("Error creating list:", err);
      toast.error(err.response?.data?.message || t("createListModal.toast.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center z-50 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-neutralAlt sm:rounded-lg shadow-2xl border border-neutral/60 max-w-lg w-full flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 sm:px-6 flex-shrink-0 border-b border-neutral/40">
          <h2 className="text-xl font-semibold text-primary">
            {t("createListModal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-error hover:text-error/80"
            aria-label={t("auth.a11y.closeModal")}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 space-y-3">
          {/* Name */}
          <div>
            <label className={labelClass}>
              {t("createListModal.labels.name")}
              <span className="text-error ml-1">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder={t("createListModal.placeholders.name")}
            />
          </div>

          {/* Trip dates + location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>
                {t("createListModal.labels.tripStart")}
                <span className="text-primary/40 font-normal ml-1 text-xs">{t("createListModal.labels.optional")}</span>
              </label>
              <DatePicker
                selected={tripStart}
                onChange={setTripStart}
                dateFormat="P"
                locale={dfnsLocale}
                className={inputClass}
                placeholderText={t("createListModal.placeholders.date")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("createListModal.labels.tripEnd")}
                <span className="text-primary/40 font-normal ml-1 text-xs">{t("createListModal.labels.optional")}</span>
              </label>
              <DatePicker
                selected={tripEnd}
                onChange={setTripEnd}
                dateFormat="P"
                locale={dfnsLocale}
                className={inputClass}
                placeholderText={t("createListModal.placeholders.date")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("createListModal.labels.location")}
                <span className="text-primary/40 font-normal ml-1 text-xs">{t("createListModal.labels.optional")}</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
                placeholder={t("createListModal.placeholders.location")}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 border-t border-neutral/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm text-primary hover:bg-primary/10"
          >
            {t("createListModal.actions.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded text-sm bg-primary text-base-100 hover:bg-primary/80 disabled:opacity-50"
          >
            {t("createListModal.actions.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
