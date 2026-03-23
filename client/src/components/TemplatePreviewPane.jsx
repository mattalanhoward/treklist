// src/components/TemplatePreviewPane.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiEdit2, FiExternalLink, FiMapPin, FiCalendar } from "react-icons/fi";
import { FaUtensils, FaTshirt } from "react-icons/fa";
import api, { refreshAccessToken } from "../services/api";
import PackStats from "./PackStats";
import Spinner from "./ui/Spinner";
import PublicItemModal from "./PublicItemModal";
import { useUserSettings } from "../contexts/UserSettings";

function gToOz(g) {
  return typeof g === "number" ? g / 28.349523125 : null;
}

function fmtWeight(g, unit) {
  if (g == null || Number.isNaN(g)) return "";
  if (unit === "oz") return `${(gToOz(Number(g)) ?? 0).toFixed(2)} oz`;
  return `${Math.round(Number(g))} g`;
}

function fmtDateRange(start, end) {
  const full = { month: "short", day: "numeric", year: "numeric" };
  const noYear = { month: "short", day: "numeric" };
  if (!start && !end) return null;
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (s && e) {
    if (s.getFullYear() === e.getFullYear())
      return `${s.toLocaleDateString(undefined, noYear)} – ${e.toLocaleDateString(undefined, full)}`;
    return `${s.toLocaleDateString(undefined, full)} – ${e.toLocaleDateString(undefined, full)}`;
  }
  return (s || e).toLocaleDateString(undefined, full);
}

function catTotalG(items) {
  let base = 0, worn = 0, cons = 0;
  for (const it of items) {
    const w = Number(it.weight_g) || 0;
    const q = Number(it.qty ?? 1) || 1;
    if (it.consumable) cons += w * q;
    else if (it.worn) { worn += w; if (q > 1) base += w * (q - 1); }
    else base += w * q;
  }
  return base + worn + cons;
}

function computeStats(items = []) {
  let base = 0, worn = 0, consumable = 0;
  for (const it of items) {
    const w = Number(it.weight_g) || 0;
    const qty = Number(it.qty ?? 1) || 1;
    if (it.consumable) consumable += w * qty;
    else if (it.worn) { worn += w; if (qty > 1) base += w * (qty - 1); }
    else base += w * qty;
  }
  return { base, worn, consumable, total: base + worn + consumable };
}

export default function TemplatePreviewPane({ token, onBack, fetchLists }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { weightUnit, setWeightUnit } = useUserSettings();
  const unit = weightUnit === "oz" ? "oz" : "g";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [copying, setCopying] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const copyRanRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    copyRanRef.current = false;
    setData(null);
    setError("");
    setLoading(true);
    api
      .get(`/public/share/${token}/full`)
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.error || t("publicList.errors.loadFailed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, t]);

  async function handleUseTemplate() {
    setCopying(true);
    try {
      const { data: resp } = await api.post(`/public/share/${token}/copy`, null, { __noGlobal401: true });
      const newId = resp.listId || resp.list?._id;
      if (newId) {
        await fetchLists?.();
        navigate(`/dashboard/${newId}`, { replace: true });
      }
    } catch (e) {
      if (e.response?.status === 401) {
        try {
          await refreshAccessToken();
          const { data: retry } = await api.post(`/public/share/${token}/copy`, null, { __noGlobal401: true });
          const newId2 = retry.listId || retry.list?._id;
          if (newId2) { await fetchLists?.(); navigate(`/dashboard/${newId2}`, { replace: true }); return; }
        } catch { /* fall through */ }
      }
      console.error(e);
      alert(e.response?.data?.error || t("publicList.errors.copyFailedAlert"));
    } finally {
      setCopying(false);
    }
  }

  if (copying) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner centered label={t("publicList.status.copying")} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-secondary text-sm">
        {t("publicList.status.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-error text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const stats = computeStats(data.items);
  const catById = new Map(data.categories.map((c) => [c.id, c.title]));
  const grouped = data.items.reduce((acc, it) => {
    const key = it.categoryId || "__uncategorized__";
    (acc[key] ||= []).push(it);
    return acc;
  }, {});
  const catOrder = [
    ...data.categories.map((c) => c.id),
    ...(grouped["__uncategorized__"] ? ["__uncategorized__"] : []),
  ];

  const uncategorizedLabel = t("publicList.categories.uncategorized");
  const fallbackCategoryLabel = t("publicList.categories.untitled");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar — breadcrumb */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-primaryAlt hover:text-primary transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          {t("templates.title")}
        </button>
        <span className="text-primary/20 select-none">/</span>
        <span className="text-sm font-semibold text-primary truncate">{data.list.title}</span>
      </div>

      {/* Sub-header: stats + metadata + CTA + unit toggle — desktop only sticky */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-primary/10 bg-base-100 hidden md:block">

        {/* Desktop layout */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0 flex-wrap">
            <PackStats
              base={stats.base}
              worn={stats.worn}
              consumable={stats.consumable}
              total={stats.total}
              disablePopover
            />
            {data.list.location && (
              <span className="flex items-center gap-1.5 text-sm text-secondary">
                <FiMapPin className="text-xs flex-shrink-0" aria-hidden />
                {data.list.location}
              </span>
            )}
            {(data.list.tripStart || data.list.tripEnd) && (
              <span className="flex items-center gap-1.5 text-sm text-secondary">
                <FiCalendar className="text-xs flex-shrink-0" aria-hidden />
                {fmtDateRange(data.list.tripStart, data.list.tripEnd)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="inline-flex border border-primary/10 rounded overflow-hidden" aria-live="polite">
              <button className={`px-2 py-1 text-xs ${unit === "g" ? "bg-primary text-base-100" : "bg-base-100"}`} onClick={() => setWeightUnit("g")} aria-pressed={unit === "g"}>g</button>
              <button className={`px-2 py-1 text-xs ${unit === "oz" ? "bg-primary text-base-100" : "bg-base-100"}`} onClick={() => setWeightUnit("oz")} aria-pressed={unit === "oz"}>oz</button>
            </div>
            <button
              type="button"
              onClick={handleUseTemplate}
              disabled={copying}
              className="inline-flex items-center gap-2 rounded-md bg-accent text-base-100 hover:bg-accent/90 px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
            >
              <FiEdit2 className="w-3.5 h-3.5" aria-hidden />
              {t("publicList.cta.labelDesktop")}
            </button>
          </div>
        </div>


      </div>

      {/* Categories + items */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Mobile sub-header — scrolls with content */}
        <div className="md:hidden space-y-2 pb-2 border-b border-primary/10">
          <div className="flex justify-center">
            <PackStats
              base={stats.base}
              worn={stats.worn}
              consumable={stats.consumable}
              total={stats.total}
              disablePopover
            />
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleUseTemplate}
              disabled={copying}
              className="inline-flex items-center gap-2 rounded-md bg-accent text-base-100 hover:bg-accent/90 px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
            >
              <FiEdit2 className="w-3.5 h-3.5" aria-hidden />
              {t("publicList.cta.labelMobile")}
            </button>
          </div>
          <div className="flex justify-center">
            <div className="inline-flex border border-primary/10 rounded overflow-hidden" aria-live="polite">
              <button className={`px-2 py-1 text-xs ${unit === "g" ? "bg-primary text-base-100" : "bg-base-100"}`} onClick={() => setWeightUnit("g")} aria-pressed={unit === "g"}>g</button>
              <button className={`px-2 py-1 text-xs ${unit === "oz" ? "bg-primary text-base-100" : "bg-base-100"}`} onClick={() => setWeightUnit("oz")} aria-pressed={unit === "oz"}>oz</button>
            </div>
          </div>
        </div>

        {catOrder.map((catId) => {
          const title =
            catId === "__uncategorized__"
              ? uncategorizedLabel
              : catById.get(catId) || fallbackCategoryLabel;
          const items = grouped[catId] || [];
          const totalG = catTotalG(items);

          return (
            <section key={catId} className="bg-neutral rounded-lg py-2">
              {/* Category header */}
              <div className="flex items-center min-w-0 mb-3 px-3">
                <h2 className="text-base font-semibold flex-1 min-w-0 truncate pr-2 text-primaryAlt">
                  {title}
                </h2>
                <span className="flex-shrink-0 text-primaryAlt tabular-nums text-sm">
                  {fmtWeight(totalG, unit)}
                </span>
              </div>

              {/* Desktop rows */}
              <div className="hidden md:block space-y-1 px-1">
                {items.map((it) => {
                  const g = Number(it.weight_g) || 0;
                  const linkHref = it.affiliate?.deepLink || it.affiliate?.url || it.link || null;
                  return (
                    <div
                      key={it.id || it._id}
                      className="grid items-center gap-x-2 text-sm bg-base-100 px-3 py-2 rounded shadow"
                      style={{ gridTemplateColumns: "160px minmax(200px,1fr) 80px 22px 22px 22px 28px" }}
                    >
                      <span className="font-semibold text-primary truncate">{it.itemType || "—"}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(it)}
                        className="truncate text-primary text-left hover:underline cursor-pointer"
                      >
                        {it.brand && <span className="mr-1">{it.brand}</span>}
                        {it.name}
                      </button>
                      <span className="tabular-nums text-primary text-right">{fmtWeight(g, unit)}</span>
                      <span className={it.consumable ? "text-green-600" : "opacity-20"} title={t("publicList.item.consumable")}>
                        <FaUtensils aria-hidden />
                      </span>
                      <span className={it.worn ? "text-blue-600" : "opacity-20"} title={t("publicList.item.worn")}>
                        <FaTshirt aria-hidden />
                      </span>
                      <span className="text-xs text-primaryAlt tabular-nums text-center">×{it.qty ?? 1}</span>
                      <span>
                        {linkHref && (
                          <a
                            href={linkHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-70"
                            title={t("publicList.item.viewProduct")}
                          >
                            <FiExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden space-y-2 px-1">
                {items.map((it) => {
                  const g = Number(it.weight_g) || 0;
                  const linkHref = it.affiliate?.deepLink || it.affiliate?.url || it.link || null;
                  return (
                    <li key={it.id || it._id} className="bg-base-100 px-3 py-2 rounded shadow">
                      <div className="flex items-center gap-1 overflow-hidden mb-1">
                        <span className="font-semibold text-primary text-sm flex-shrink-0">{it.itemType || "—"}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedItem(it)}
                          className="truncate text-primary text-sm ml-1 text-left hover:underline cursor-pointer"
                        >
                          {it.brand && <span className="mr-1">{it.brand}</span>}
                          {it.name}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="tabular-nums text-primary">{fmtWeight(g, unit)}</span>
                        <div className="flex items-center gap-3">
                          <span className={it.consumable ? "text-green-600" : "opacity-20"}>
                            <FaUtensils aria-hidden />
                          </span>
                          <span className={it.worn ? "text-blue-600" : "opacity-20"}>
                            <FaTshirt aria-hidden />
                          </span>
                          <span className="text-xs text-primaryAlt">×{it.qty ?? 1}</span>
                          {linkHref && (
                            <a href={linkHref} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <FiExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {selectedItem && (
        <PublicItemModal
          item={selectedItem}
          unit={unit}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
