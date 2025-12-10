// src/components/GlobalItemEditModal.jsx
import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import CurrencyInput from "../components/CurrencyInput";
import LinkInput from "../components/LinkInput";
import ConfirmDialog from "./ConfirmDialog";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import { useUserSettings } from "../contexts/UserSettings";
import { FaTimes } from "react-icons/fa";

export default function GlobalItemEditModal({
  item,
  onClose,
  onSaved,
  allowDelete = true,
  listId,
  catId,
  context = "global", // "global" | "list"
}) {
  const { t } = useTranslation("common");
  const [form, setForm] = useState({
    category: "",
    itemType: "",
    name: "",
    brand: "",
    description: "",
    weight: "",
    price: "",
    link: "",
  });

  const unit = useUnit();
  const { unitLabel, formatInput, parseInput } = useWeightInput(unit);
  const [displayWeight, setDisplayWeight] = useState("");
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const itemId = item ? item._id : null;
  const isListContext = context === "list" || (!!listId && !!catId);

  const { currency, locale } = useUserSettings();
  const CURRENCY_SYMBOL = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    SEK: "kr",
  };
  const currencySymbol = CURRENCY_SYMBOL[currency] || currency;

  // affiliate-backed items (Awin)
  const isAffiliate = Boolean(item?.affiliate && item.affiliate.network);

  // Hydrate when item changes
  useEffect(() => {
    if (!item) return;
    const initialGrams = item.weight ?? "";
    setForm({
      category: item.category || "",
      itemType: item.itemType || "",
      name: item.name || "",
      brand: item.brand || "",
      description: item.description || "",
      weight: initialGrams,
      price: item.price ?? "", // keep empty string if none
      link: item.link || "",
    });
    setWorn(!!item.worn);
    setConsumable(!!item.consumable);
    setQuantity(item.quantity || 1);
  }, [itemId]);

  // Recalc display weight when unit or item changes
  useEffect(() => {
    if (!item) return;
    const initialGrams = item.weight ?? "";
    setDisplayWeight(initialGrams !== "" ? formatInput(initialGrams) : "");
  }, [itemId, unit, formatInput]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return t("validation.nameRequired");
    const trimmed = String(displayWeight ?? "").trim();
    const parsed = trimmed === "" ? null : parseInput(trimmed);
    if (trimmed !== "" && parsed == null) return t("validation.weightInvalid");
    if (parsed != null && parsed < 0) return t("validation.weightNegative");
    if (!isAffiliate && form.price !== "" && Number(form.price) < 0)
      return t("validation.priceNegative");
    if (!isAffiliate && form.link && !/^https?:\/\//.test(form.link))
      return t("validation.urlInvalid");
    return "";
  };

  // Step 1: validate -> open confirm
  const handleSave = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    setConfirmOpen(true);
  };

  // Step 2: user confirmed
  const handleConfirm = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setError("");

    // Which id should we use for the GLOBAL template?
    //  - from sidebar: item._id is the global id
    //  - from gear list: use item.globalItem if present
    const globalId = isListContext ? item?.globalItem : item?._id;

    try {
      const payload = {
        category: form.category,
        itemType: form.itemType,
        name: form.name.trim(),
        brand: form.brand.trim(),
        description: form.description.trim(),
        weight:
          String(displayWeight ?? "").trim() === ""
            ? null
            : parseInput(displayWeight), // integer grams
        worn,
        consumable,
        quantity,
      };

      // Price/Link handling:
      if (isAffiliate) {
        // For imported affiliate items, lock price + link
        delete payload.price;
        delete payload.link;
      } else {
        // Price: allow clearing to null
        if (form.price === "" || form.price == null) {
          payload.price = null;
        } else {
          const p = Number(form.price);
          if (!Number.isNaN(p)) payload.price = p; // keep 0 if they typed 0
        }

        // Link: allow clearing
        const trimmedLink = (form.link || "").trim();
        payload.link = trimmedLink === "" ? null : trimmedLink;
      }

      let updatedSomething = false;
      let touchedGlobal = false;

      // 1) Update the GLOBAL template if we know its id
      if (globalId) {
        try {
          await api.patch(`/global/items/${globalId}`, payload);
          updatedSomething = true;
          touchedGlobal = true;

          // Notify other parts of the app (Sidebar) that globals changed
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("global-items:updated"));
          }
        } catch (err) {
          // In list context, a 404 here just means the global template is gone.
          // We still continue with the list-item update below.
          if (!(isListContext && err.response?.status === 404)) {
            throw err;
          }
        }
      }

      // 2) Update the LIST item when editing from a gear-list card
      if (isListContext) {
        await api.patch(
          `/dashboard/${listId}/categories/${catId}/items/${item._id}`,
          payload
        );
        updatedSomething = true;
      }

      if (updatedSomething) {
        toast.success(
          isListContext && touchedGlobal
            ? t("globalItemEditModal.toast.updatedEverywhere")
            : t("globalItemEditModal.toast.updated")
        );
        onSaved?.();
        onClose?.();
      }
    } catch (e) {
      console.error("Error saving item:", e);
      const msg =
        e.response?.data?.message || t("globalItemEditModal.toast.saveFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelConfirm = () => setConfirmOpen(false);

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSave}
        className="bg-neutralAlt rounded-lg shadow-2xl max-w-xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            {isListContext
              ? t("globalItemEditModal.titleList")
              : t("globalItemEditModal.titleGlobal")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-error hover:text-error/80"
          >
            <FaTimes />
          </button>
        </div>

        {error && <div className="text-error mb-2">{error}</div>}

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          {/* Item Type */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              {t("globalItemModal.labels.itemType")}
            </label>
            <input
              name="itemType"
              value={form.itemType}
              onChange={handleChange}
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              {t("globalItemModal.labels.name")}
              <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
            />
          </div>

          {/* Brand */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              {t("globalItemModal.labels.brand")}
            </label>
            <input
              name="brand"
              value={form.brand}
              onChange={handleChange}
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
            />
          </div>

          {/* Link (locked for affiliate-backed) */}
          <div className="relative">
            <LinkInput
              value={form.link}
              onChange={(newLink) => setForm((f) => ({ ...f, link: newLink }))}
              label="Link"
              placeholder="tarptent.com"
              required={false}
              readOnly={isAffiliate}
            />
            {isAffiliate && (
              <button
                type="button"
                aria-label={t(
                  "globalItemModal.messages.affiliateLinkLockedTitle"
                )}
                title={t("globalItemModal.messages.affiliateLinkLockedBody")}
                className="absolute inset-0 cursor-not-allowed bg-transparent"
                onClick={(e) => e.preventDefault()}
              />
            )}
          </div>

          {/* Weight + Price */}
          <div className="flex space-x-1 sm:space-x-2 col-span-1 sm:col-span-2">
            <div className="flex-1">
              <label className="block font-medium text-primary mb-0.5">
                {t("globalItemModal.labels.weight", { unit: unitLabel })}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={displayWeight}
                onChange={(e) => setDisplayWeight(e.target.value)}
                className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              />
            </div>

            <div className="flex-1 relative">
              <label className="block font-medium text-primary mb-0.5">
                {t("globalItemModal.labels.price", {
                  currency: currencySymbol,
                })}
              </label>
              <div className="relative">
                <CurrencyInput
                  value={form.price}
                  currency={currency}
                  locale={locale}
                  onChange={(val) => setForm((f) => ({ ...f, price: val }))}
                  readOnly={isAffiliate}
                />
                {isAffiliate && (
                  <button
                    type="button"
                    aria-label={t(
                      "globalItemModal.messages.affiliateLinkLockedTitle"
                    )}
                    title={t(
                      "globalItemModal.messages.affiliateLinkLockedBody"
                    )}
                    className="absolute inset-0 cursor-not-allowed bg-transparent"
                    onClick={(e) => e.preventDefault()}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block font-medium text-primary mb-0.5">
              {t("globalItemModal.labels.description")}
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              rows={2}
            />
          </div>
        </div>

        {isAffiliate && (
          <p className="mt-2 text-sm text-primary">
            {t("globalItemModal.messages.affiliateNote")}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end">
          {allowDelete && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving}
              className="mr-auto px-2 py-1 bg-error text-neutral font-semibold rounded-md shadow hover:bg-error/80 focus:outline-none focus:ring-2 focus:ring-error transition"
            >
              {t("globalItemEditModal.buttons.delete")}
            </button>
          )}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary sm:text-base"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80"
            >
              {saving
                ? t("globalItemEditModal.buttons.saving")
                : t("actions.save")}
            </button>
          </div>
        </div>

        {/* Apply changes confirm dialog */}
        <ConfirmDialog
          isOpen={confirmOpen}
          title={
            isListContext
              ? t("globalItemEditModal.confirm.saveListTitle")
              : t("globalItemEditModal.confirm.saveGlobalTitle")
          }
          confirmText={
            isListContext
              ? t("globalItemEditModal.confirm.saveListConfirm")
              : t("globalItemEditModal.confirm.saveGlobalConfirm")
          }
          cancelText={t("actions.cancel")}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />

        {/* Delete confirm dialog */}
        {allowDelete && (
          <ConfirmDialog
            isOpen={deleteConfirmOpen}
            title={t("globalItemEditModal.confirm.deleteTitle")}
            message={t("globalItemEditModal.confirm.deleteMessage")}
            confirmText={t("globalItemEditModal.confirm.deleteConfirm")}
            cancelText={t("actions.cancel")}
            onConfirm={async () => {
              setDeleteConfirmOpen(false);
              try {
                await api.delete(`/global/items/${item._id}`);
                toast.success(t("globalItemEditModal.toast.deleted"));
                onSaved?.();
                onClose?.();
              } catch (err) {
                toast.error(
                  err.response?.data?.message ||
                    t("globalItemEditModal.toast.deleteFailed")
                );
              }
            }}
            onCancel={() => setDeleteConfirmOpen(false)}
          />
        )}
      </form>
    </div>
  );
}
