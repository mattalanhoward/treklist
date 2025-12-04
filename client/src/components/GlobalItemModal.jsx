// src/components/GlobalItemModal.jsx
import React, { useState } from "react";
import api from "../services/api";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import CurrencyInput from "../components/CurrencyInput";
import LinkInput from "../components/LinkInput";
import { useUnit } from "../hooks/useUnit";
import { useWeightInput } from "../hooks/useWeightInput";
import AffiliateProductPicker from "./AffiliateProductPicker";
import { useUserSettings } from "../contexts/UserSettings";
import { detectRegion, normalizeRegion } from "../utils/region";
import { extractWeightGrams } from "../utils/weight";

export default function GlobalItemModal({
  categories = [],
  onClose,
  onCreated,
}) {
  const { t } = useTranslation("common");
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const unit = useUnit();
  const { unitLabel, parseInput } = useWeightInput(unit);
  const [displayWeight, setDisplayWeight] = useState("");
  const [weightSource, setWeightSource] = useState("user"); // "user" | "heuristic" | "scraped" | "catalog" | "verified"

  const [tab, setTab] = useState("import"); // "import" | "custom"
  const [affProduct, setAffProduct] = useState(null); // selected affiliate product (or null)

  // Derive item type from a category path string (e.g., "A > B > C" -> "C")
  const deriveItemTypeFromCategoryPath = (path) => {
    if (!path) return "";
    if (Array.isArray(path)) {
      const last = path[path.length - 1];
      return typeof last === "string" ? last.trim() : "";
    }
    if (typeof path === "string") {
      const parts = path
        .replace(/›|»|\||\//g, ">")
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);
      return parts[parts.length - 1] || "";
    }
    return "";
  };

  // When a product is picked, prefill the visible fields and lock price/link
  function handlePickAffiliate(p) {
    setAffProduct(p);
    setTab("custom");
    setName(p?.name || "");
    setBrand(p?.brand || p?.merchantName || "");
    setDescription(p?.description || "");
    // keep price as a number for CurrencyInput; empty string otherwise
    setPrice(typeof p?.price === "number" ? p.price : "");
    setLink(p?.awDeepLink || "");
    const derived =
      deriveItemTypeFromCategoryPath(p?.categoryPath) ||
      deriveItemTypeFromCategoryPath(p?.category) ||
      deriveItemTypeFromCategoryPath(p?.categories);
    if (derived) setItemType(derived);

    // Prefill weight from name/description if present
    const grams = extractWeightGrams(
      [p?.name, p?.description].filter(Boolean).join(" ")
    );
    if (grams != null) {
      if (unitLabel === "g") {
        setDisplayWeight(String(grams));
      } else {
        const oz = Math.round((grams / 28.349523125) * 10) / 10; // 1 decimal
        setDisplayWeight(String(oz));
      }
      setWeightSource("heuristic");
    }
  }

  // Region: prefer user setting, then browser, always normalized to ISO-2
  // Region/Currency/Locale from settings
  const { region: settingsRegion, currency, locale } = useUserSettings();
  const CURRENCY_SYMBOL = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    SEK: "kr",
  };
  const currencySymbol = CURRENCY_SYMBOL[currency] || "";
  const regionForSearch = normalizeRegion(settingsRegion || detectRegion());

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Accept either variable name; keep one source of truth.
    const selectedAffiliate = affProduct || null;

    // Basic validation (still require a name)
    if (!name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }

    // Parse/validate weight (grams) from displayWeight if provided
    let grams;
    if (displayWeight !== "") {
      grams = parseInput(displayWeight);
      if (grams == null) {
        toast.error(t("validation.weightInvalid"));
        return;
      }
      if (grams < 0) {
        toast.error(t("validation.weightNegative"));
        return;
      }
    }

    setLoading(true);
    try {
      let created;

      if (selectedAffiliate?._id) {
        // Affiliate-backed: server controls price/link; we send only overrides
        const payload = {
          affiliateProductId: selectedAffiliate._id,
          name: name.trim(),
          ...(itemType.trim() && { itemType: itemType.trim() }),
          ...(brand.trim() && { brand: brand.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(typeof grams === "number" && { weight: grams }),
          ...(typeof grams === "number" && weightSource && { weightSource }),
          worn,
          consumable,
          quantity: Number(quantity) || 1,
          // Keep whatever category your API expects; omit if not used server-side
          ...(category && { category }),
        };

        created = await api
          .post("/global/items/from-affiliate", payload)
          .then((r) => r.data);
      } else {
        // Custom item: same as your original flow (price/link allowed)
        const payload = { category, name: name.trim() };
        if (itemType.trim()) payload.itemType = itemType.trim();
        if (brand.trim()) payload.brand = brand.trim();
        if (description.trim()) payload.description = description.trim();
        if (typeof grams === "number") {
          payload.weight = grams;
          if (weightSource === "heuristic") payload.weightSource = "heuristic";
        }

        if (price === "" || price == null) {
          payload.price = null; // clearing the field sends null
        } else {
          const p = Number(price);
          if (Number.isNaN(p) || p < 0) {
            toast.error(t("validation.priceInvalid"));
            setLoading(false);
            return;
          }
          payload.price = p; // keep 0 if entered
        }

        if (link.trim()) payload.link = link.trim();

        payload.worn = worn;
        payload.consumable = consumable;
        payload.quantity = Number(quantity) || 1;

        created = await api.post("/global/items", payload).then((r) => r.data);
      }

      toast.success(t("globalItemModal.toast.created"));
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      console.error("Error creating global item:", err);
      const msg =
        err.response?.data?.message || t("globalItemModal.toast.createFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-neutralAlt rounded-lg shadow-2xl max-w-xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4"
      >
        {/* Header (smaller on phones) */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            {t("globalItemModal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-error hover:text-error/80"
          >
            <FaTimes />
          </button>
        </div>

        {/* Import / Custom tabs */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-2 py-1 rounded border ${
                tab === "import"
                  ? "bg-primary/10 border-primary"
                  : "bg-neutralAlt border-primary/30"
              }`}
              onClick={() => setTab("import")}
              disabled={loading}
            >
              {t("globalItemModal.tabs.import")}
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded border ${
                tab === "custom"
                  ? "bg-primary/10 border-primary"
                  : "bg-neutralAlt border-primary/30"
              }`}
              onClick={() => setTab("custom")}
              disabled={loading}
            >
              {t("globalItemModal.tabs.custom")}
            </button>
          </div>

          {affProduct ? (
            <div className="flex items-center gap-2">
              {/* <span className=" text-primary">
                Selected: <strong>{affProduct.name}</strong>
              </span> */}
              <button
                type="button"
                className="text-xs underline text-primary"
                onClick={() => {
                  // Remove affiliate selection
                  setAffProduct(null);

                  // Reset every user-editable field
                  setCategory?.(""); // if you keep category in this modal
                  setItemType("");
                  setName("");
                  setBrand("");
                  setDescription("");
                  setDisplayWeight(""); // clears the visible weight input
                  setPrice("");
                  setLink("");
                  setWorn(false);
                  setConsumable(false);
                  setQuantity(1);
                  setWeightSource("user");
                  console.debug("[GlobalItemModal] weightSource reset -> user");

                  // If you want to take the user back to Import, uncomment:
                  // setTab("import");
                }}
                disabled={loading}
              >
                {t("globalItemModal.buttons.clearSelection")}
              </button>
            </div>
          ) : null}
        </div>

        {/* Import tab content */}
        {tab === "import" && (
          <div className="">
            <AffiliateProductPicker
              region={regionForSearch}
              onPick={handlePickAffiliate}
              pageSize={10}
            />
          </div>
        )}

        {/* Grid: only visible on the Custom tab */}
        {tab === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            {/* Item Type */}
            <div>
              <label className="block font-medium text-primary mb-0.5">
                {t("globalItemModal.labels.itemType")}
              </label>
              <input
                type="text"
                placeholder={t("globalItemModal.placeholders.itemType")}
                required
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
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
                type="text"
                placeholder={t("globalItemModal.placeholders.name")}
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block font-medium text-primary mb-0.5">
                {t("globalItemModal.labels.brand")}
              </label>
              <input
                type="text"
                placeholder={t("globalItemModal.placeholders.brand")}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              />
            </div>

            {/* Link (locked if affiliate selected) */}
            <div className="relative">
              <LinkInput
                value={link}
                onChange={setLink}
                label={t("globalItemModal.labels.link")}
                placeholder={t("globalItemModal.placeholders.link")}
                required={false}
                readOnly={!!affProduct}
              />
              {affProduct && (
                <button
                  type="button"
                  aria-label={t(
                    "globalItemModal.messages.affiliateLinkLockedTitle"
                  )}
                  title={t("globalItemModal.messages.affiliateLinkLockedBody")}
                  className="absolute inset-0 cursor-not-allowed bg-transparent"
                />
              )}
            </div>

            {/* Weight + Price: force flex on all breakpoints */}
            <div className="flex space-x-1 sm:space-x-2 col-span-1 sm:col-span-2">
              <div className="flex-1">
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.weight", { unit: unitLabel })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayWeight}
                  placeholder={
                    unitLabel === "g"
                      ? t("globalItemModal.placeholders.weightGrams")
                      : t("globalItemModal.placeholders.weightOunces")
                  }
                  onChange={(e) => setDisplayWeight(e.target.value)}
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block font-medium text-primary mb-0.5">
                  {t("globalItemModal.labels.price", {
                    currency: currencySymbol,
                  })}
                </label>
                <div className="relative">
                  <CurrencyInput
                    value={price}
                    currency={currency}
                    locale={locale}
                    onChange={(val) => setPrice(val)}
                    readOnly={!!affProduct}
                  />
                  {affProduct && (
                    <button
                      type="button"
                      aria-label={t(
                        "globalItemModal.messages.affiliateLinkLockedTitle"
                      )}
                      title={t(
                        "globalItemModal.messages.affiliateLinkLockedBody"
                      )}
                      className="absolute inset-0 cursor-not-allowed bg-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Description spans full width */}
            <div className="sm:col-span-2">
              <label className="block font-medium text-primary mb-0.5">
                {t("globalItemModal.labels.description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Worn / Consumable (only on Custom tab) */}
        {/* {tab === "custom" && (
          <div className="flex items-center space-x-4 mt-2">
            <label className="inline-flex items-center text-primary">
              <input
                type="checkbox"
                checked={worn}
                onChange={(e) => setWorn(e.target.checked)}
                className="mr-1 sm:mr-2"
              />
              Worn
            </label>
            <label className="inline-flex items-center text-primary">
              <input
                type="checkbox"
                checked={consumable}
                onChange={(e) => setConsumable(e.target.checked)}
                className="mr-1 sm:mr-2"
              />
              Consumable
            </label>
          </div>
        )} */}

        {/* Actions + merchant note */}
        <div className="mt-3 flex items-center gap-2">
          {affProduct && (
            <p className="flex-1 text-sm text-primary">
              {t("globalItemModal.messages.affiliateNote")}
            </p>
          )}

          <div className="flex space-x-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              title={
                tab === "import"
                  ? t("globalItemModal.messages.cancelHintImport")
                  : undefined
              }
              className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-2 py-1 bg-secondary text-white rounded hover:bg-secondary-700"
            >
              {t("actions.save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
