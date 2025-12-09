// client/src/pages/PublicGearList.jsx
import React from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  FaBalanceScale,
  FaUtensils,
  FaTshirt,
  FaShoppingCart,
  FaEdit,
} from "react-icons/fa";
import { BsBackpack4 } from "react-icons/bs";
import AffiliateGateLink from "../components/AffiliateGateLink";
import AffiliateDisclosureNotice from "../components/AffiliateDisclosureNotice";
import { currencyForRegion, normalizeRegion } from "../utils/region";
import { formatCurrency as fmtCurrency } from "../utils/formatCurrency";
import api, { refreshAccessToken } from "../services/api";
import { useTranslation } from "react-i18next";

// tiny class combiner to avoid pulling in classnames
const cx = (...parts) => parts.filter(Boolean).join(" ");

// helpers
function gToOz(g) {
  if (typeof g !== "number") return null;
  return g / 28.349523125;
}

// display helpers for mobile cards
function fmtWeight(g, unit) {
  if (g == null || Number.isNaN(g)) return "";
  if (unit === "oz") return `${(gToOz(Number(g)) ?? 0).toFixed(2)} oz`;
  return `${Math.round(Number(g))} g`;
}

// header stat formatting: grams -> kg when large; ounces -> lb when large
function fmtHeaderStat(valueG, unit) {
  if (!Number.isFinite(valueG)) return "—";
  if (unit === "g") {
    if (valueG >= 1000) return `${(valueG / 1000).toFixed(1)} kg`;
    return `${Math.round(valueG)} g`;
  }
  const oz = gToOz(valueG) ?? 0;
  if (oz >= 16) return `${(oz / 16).toFixed(1)} lb`;
  return `${oz.toFixed(1)} oz`;
}

function fmtPrice(
  item,
  {
    defaultCurrency = "EUR",
    locale = "en-US",
    placeholder = "—",
    zeroIsMissing = true,
  } = {}
) {
  // Prefer preformatted price if present (assumed intentional formatting)
  if (typeof item.priceFormatted === "string" && item.priceFormatted.trim()) {
    return item.priceFormatted;
  }
  const n = Number(item.price);
  if (!Number.isFinite(n) || (zeroIsMissing && n <= 0)) return placeholder;
  // Choose currency priority: item.currencyCode → item.currency → defaultCurrency
  const currency =
    item.currencyCode || item.currency || defaultCurrency || "EUR";
  return fmtCurrency(n, {
    currency,
    locale,
    minimumFractionDigits: 2,
  });
}

function catTotalG(items) {
  // mirror computeStatsPublic's total contribution rule, but per category (in grams)
  let base = 0,
    worn = 0,
    cons = 0;
  for (const it of items) {
    const w = Number(it.weight_g) || 0;
    const q = Number(it.qty ?? 1) || 1;
    if (it.consumable) cons += w * q;
    else if (it.worn) {
      worn += w;
      if (q > 1) base += w * (q - 1);
    } else base += w * q;
  }
  return base + worn + cons;
}

function majorityCurrencyFromItems(items = []) {
  const counts = new Map();
  for (const it of items) {
    const c = (it.currencyCode || it.currency || "").toUpperCase();
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  let best = null,
    max = 0;
  for (const [c, n] of counts) {
    if (n > max) {
      best = c;
      max = n;
    }
  }
  return best; // e.g., "CAD" or undefined
}

function currencyFromAffiliateUrl(url = "") {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Very light mapping; extend as needed
    if (host.endsWith(".amazon.ca")) return "CAD";
    if (host.endsWith(".amazon.com")) return "USD";
    if (host.endsWith(".amazon.co.uk")) return "GBP";
    if (host.endsWith(".amazon.de")) return "EUR";
    if (host.endsWith(".amazon.fr")) return "EUR";
    if (host.endsWith(".amazon.it")) return "EUR";
    if (host.endsWith(".amazon.es")) return "EUR";
    // Add Awin merchants if you like:
    // if (host.includes("bergfreunde")) return "EUR";
  } catch {}
  return undefined;
}

function fallbackCurrencyFromLinks(items = []) {
  const counts = new Map();
  for (const it of items) {
    const url = it?.affiliate?.deepLink || it?.affiliate?.url || it?.link || "";
    const c = currencyFromAffiliateUrl(url);
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  let best = null,
    max = 0;
  for (const [c, n] of counts) {
    if (n > max) {
      best = c;
      max = n;
    }
  }
  return best;
}

export default function PublicGearList() {
  const { t } = useTranslation("common");
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const copyRanRef = React.useRef(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);
  const [unit, setUnit] = React.useState("g"); // "g" | "oz"

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        const { data } = await api.get(`/public/share/${token}/full`);
        if (!cancelled) {
          setData(data);
          setError("");
        }
      } catch (e) {
        console.error(e);
        if (!cancelled)
          setError(
            e.response?.data?.error || t("publicList.errors.loadFailed")
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  // If ?copy=1 is present, attempt copy automatically after mount (post-auth return)
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("copy") === "1" && !copyRanRef.current) {
      copyRanRef.current = true; // guard against React StrictMode double-invoke
      attemptCopy(); // fire and forget; it will redirect on success
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function attemptCopy() {
    try {
      const { data: resp } = await api.post(
        `/public/share/${token}/copy`,
        null,
        { __noGlobal401: true } // <-- let us handle 401 here
      ); // success → go to new list
      const newId = resp.listId || resp.list?._id;
      if (newId) {
        navigate(`/dashboard/${newId}`, { replace: true });
      } else {
        // Safety net: if API shape changes
        window.location.href = "/dashboard";
      }
    } catch (e) {
      if (e.response?.status === 401) {
        // Token may be expired but user has a refresh cookie — try a silent refresh once.
        try {
          await refreshAccessToken(); // sets new access token if possible
          const { data: retry } = await api.post(
            `/public/share/${token}/copy`,
            null,
            { __noGlobal401: true }
          );
          const newId2 = retry.listId || retry.list?._id;
          if (newId2) {
            navigate(`/dashboard/${newId2}`, { replace: true });
            return;
          }
        } catch {
          // Silent refresh failed → treat as anonymous and go to auth with `next`
          const nextUrl = encodeURIComponent(`/share/${token}?copy=1`);
          // Go to Landing, opening the register modal and preserving `next`
          window.location.href = `/?auth=register&next=${nextUrl}`;
          return;
        }
      }
      // Other errors → surface and stay
      console.error(e);
      alert(e.response?.data?.error || t("publicList.errors.copyFailedAlert"));
    }
  }

  // document title + noindex
  React.useEffect(() => {
    const prevTitle = document.title;
    const robotsMetaExisting = document.querySelector('meta[name="robots"]');
    const prevRobotsContent = robotsMetaExisting?.getAttribute("content") || "";

    let robotsMeta = robotsMetaExisting;
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = "noindex";

    if (data?.list?.title) {
      document.title = `${data.list.title} • ${t(
        "publicList.documentTitleSuffix"
      )}`;
    }

    return () => {
      document.title = prevTitle;
      if (robotsMeta) {
        if (robotsMetaExisting) {
          robotsMeta.content = prevRobotsContent;
        } else {
          document.head.removeChild(robotsMeta);
        }
      }
    };
  }, [data, t]);

  // ---- Compute stats for PackStats (grams in, component handles display) ----
  function computeStatsPublic(items = []) {
    let baseWeight = 0;
    let wornWeight = 0;
    let consumableWeight = 0;

    items.forEach((it) => {
      const w = Number(it.weight_g) || 0;
      const qty = Number(it.qty ?? 1) || 1;
      if (it.consumable) {
        consumableWeight += w * qty;
      } else if (it.worn) {
        // one counts as worn; extras count toward base
        wornWeight += w;
        if (qty > 1) baseWeight += w * (qty - 1);
      } else {
        baseWeight += w * qty;
      }
    });
    return {
      base: baseWeight,
      worn: wornWeight,
      consumable: consumableWeight,
      total: baseWeight + wornWeight + consumableWeight,
    };
  }

  const stats = computeStatsPublic(data?.items || []);

  // compact, icon-only stats row that follows the unit toggle
  function StatsRow({ className = "" }) {
    const chips = [
      {
        key: "base",
        title: t("publicList.stats.base"),
        icon: BsBackpack4,
        value: stats.base,
      },
      {
        key: "worn",
        title: t("publicList.stats.worn"),
        icon: FaTshirt,
        value: stats.worn,
      },
      {
        key: "consumable",
        title: t("publicList.stats.consumable"),
        icon: FaUtensils,
        value: stats.consumable,
      },
      {
        key: "total",
        title: t("publicList.stats.total"),
        icon: FaBalanceScale,
        value: stats.total,
      },
    ];
    return (
      <div
        className={cx("flex flex-wrap items-center gap-x-6 gap-y-2", className)}
      >
        {chips.map(({ key, title, icon: Icon, value }) => (
          <div
            key={key}
            className="inline-flex items-center gap-2 text-primary tabular-nums"
            title={title}
          >
            <Icon className="shrink-0" aria-hidden />
            <span>{fmtHeaderStat(value, unit)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-secondary">
        {t("publicList.status.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-error">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const catById = new Map(data.categories.map((c) => [c.id, c.title]));

  // Determine default currency for this shared list based on list region,
  // with robust fallbacks to items and affiliate links.
  const rawRegion = data?.list?.region || data?.list?.storeRegion || "";
  // Only normalize if we actually have a region string
  const listRegion = rawRegion ? normalizeRegion(rawRegion) : "";

  let defaultCurrency = listRegion ? currencyForRegion(listRegion) : undefined;

  // 1) Try items' explicit currency (majority)
  if (!defaultCurrency) {
    defaultCurrency = majorityCurrencyFromItems(data?.items || []);
  }

  // 2) Try inferring from affiliate link TLDs
  if (!defaultCurrency) {
    defaultCurrency = fallbackCurrencyFromLinks(data?.items || []);
  }

  // 3) Final fallback: "EUR"
  if (!defaultCurrency) {
    defaultCurrency = "EUR";
  }

  const browserLocale =
    Intl.DateTimeFormat().resolvedOptions().locale || "en-US";

  // items grouped by category (single table, category header rows)
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
    <div className="public-share-theme min-h-screen bg-neutral">
      {/* Scoped palette for the public page only */}
      <style>{PUBLIC_THEME_CSS}</style>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ===== Header ===== */}
        {/* Desktop (>= md): Row 1 = Title | CTA | Toggle; Row 2 = icon-only stats */}
        <div className="hidden md:grid mb-4 gap-y-3">
          <AffiliateDisclosureNotice context="public" className="mb-2" />

          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <h1 className="text-3xl font-semibold text-primary truncate">
              {data.list.title}
            </h1>

            {/* Right-side controls: toggle + big CTA */}
            <div className="flex items-center gap-3">
              {/* Unit toggle */}
              <div
                className="inline-flex border rounded overflow-hidden"
                aria-live="polite"
              >
                <button
                  className={cx(
                    "px-3 py-1 text-sm",
                    unit === "g" ? "bg-primary text-base-100" : "bg-base-100"
                  )}
                  onClick={() => setUnit("g")}
                  aria-pressed={unit === "g"}
                >
                  g
                </button>
                <button
                  className={cx(
                    "px-3 py-1 text-sm",
                    unit === "oz" ? "bg-primary text-base-100" : "bg-base-100"
                  )}
                  onClick={() => setUnit("oz")}
                  aria-pressed={unit === "oz"}
                >
                  oz
                </button>
              </div>

              {/* Primary CTA — strong visual affordance */}
              <button
                type="button"
                onClick={attemptCopy}
                className="
          inline-flex items-center gap-2
          px-3 py-1 rounded-lg
          bg-[rgb(var(--color-accent-rgb))] text-[rgb(var(--color-base-100-rgb))]
          shadow-md hover:shadow-lg
          hover:bg-opacity-90 active:translate-y-[0.5px]
          focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-rgb))] focus:ring-offset-1
          transition
        "
                aria-label={t("publicList.cta.ariaLabel")}
              >
                <FaEdit aria-hidden />
                <span className="font-sm">
                  {t("publicList.cta.labelDesktop")}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: stats, full width */}
          <StatsRow />
        </div>

        {/* Mobile (< md): Title (center) → CTA (full width) → Toggle (center) → Stats (center) */}
        <div className="md:hidden mb-4">
          <AffiliateDisclosureNotice context="public" className="mb-2" />

          <h1 className="text-2xl font-semibold text-primary text-center">
            {data.list.title}
          </h1>

          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={attemptCopy}
              className="
      inline-flex items-center gap-2 text-sm
      px-3 py-2 rounded-lg
      min-h-[44px] whitespace-nowrap
      bg-[rgb(var(--color-accent-rgb))] text-[rgb(var(--color-base-100-rgb))]
      shadow-md hover:shadow-lg
      hover:bg-opacity-90 active:translate-y-[0.5px]
      focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-rgb))] focus:ring-offset-1
      transition
    "
              aria-label={t("publicList.cta.ariaLabel")}
            >
              <FaEdit aria-hidden />
              <span className="font-sm">{t("publicList.cta.labelMobile")}</span>
            </button>
          </div>

          <div className="mt-3 flex justify-center">
            <div
              className="inline-flex border rounded overflow-hidden"
              aria-live="polite"
            >
              <button
                className={cx(
                  "px-3 py-1 text-sm",
                  unit === "g" ? "bg-primary text-base-100" : "bg-base-100"
                )}
                onClick={() => setUnit("g")}
                aria-pressed={unit === "g"}
              >
                g
              </button>
              <button
                className={cx(
                  "px-3 py-1 text-sm",
                  unit === "oz" ? "bg-primary text-base-100" : "bg-base-100"
                )}
                onClick={() => setUnit("oz")}
                aria-pressed={unit === "oz"}
              >
                oz
              </button>
            </div>
          </div>

          <StatsRow className="justify-center mt-3" />
        </div>

        {/* ======= PUBLIC LIST MODE: MOBILE CARDS (< md) ======= */}
        <div className="md:hidden">
          {catOrder.map((catId) => {
            const title =
              catId === "__uncategorized__"
                ? uncategorizedLabel
                : catById.get(catId) || fallbackCategoryLabel;
            const items = grouped[catId] || [];
            const totalG = catTotalG(items);

            return (
              <section key={catId} className="bg-neutral rounded-lg py-2">
                {/* Category header (no grabber / no X) */}
                <div className="flex items-center mb-3 min-w-0">
                  <h3 className="font-bold flex-1 min-w-0 truncate pr-2 text-primaryAlt">
                    <span>{title}</span>
                  </h3>
                  <span className="pr-1 flex-shrink-0 text-primaryAlt tabular-nums">
                    {fmtWeight(totalG, unit)}
                  </span>
                </div>

                {/* Items */}
                <ul>
                  {items.map((it) => {
                    const g = Number(it.weight_g) || 0;
                    const linkHref =
                      it.affiliate?.deepLink ||
                      it.affiliate?.url ||
                      it.link ||
                      null;

                    return (
                      <li
                        key={it.id || it._id}
                        className="bg-base-100 px-3 py-2 rounded shadow mb-2"
                      >
                        {/* Grid matches SortableItem mobile (minus ellipsis) */}
                        <div className="grid grid-rows-[auto_auto] gap-y-1 gap-x-2 text-sm">
                          {/* Row 1: type + brand/name (no ellipsis menu) */}
                          <div className="row-start-1 col-span-2 flex items-center overflow-hidden">
                            <div className="font-semibold text-primary flex-shrink-0 mr-1">
                              {it.itemType || "—"}
                            </div>
                            <div className="truncate text-primary flex-1 overflow-hidden">
                              {it.brand && (
                                <span className="mr-1">{it.brand}</span>
                              )}
                              {it.name}
                            </div>
                          </div>

                          {/* Row 2: left (weight + price) · right (🍴 👕 qty 🛒) */}
                          <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
                            {/* Left: fixed-width columns so every card lines up */}
                            <div className="grid grid-cols-[70px_75px] text-primary">
                              <span className="tabular-nums text-left">
                                {fmtWeight(g, unit)}
                              </span>
                              <span className="tabular-nums text-left">
                                {fmtPrice(it, {
                                  defaultCurrency,
                                  locale: browserLocale,
                                  placeholder: "—",
                                })}
                              </span>
                            </div>

                            {/* Right group: state icons + qty + cart (read-only) */}
                            <div className="flex items-center gap-3">
                              <span
                                className={`${
                                  it.consumable
                                    ? "text-green-600"
                                    : "opacity-30"
                                }`}
                                title={t("publicList.item.consumable")}
                                aria-label={t("publicList.item.consumable")}
                              >
                                <FaUtensils aria-hidden />
                              </span>
                              <span
                                className={`${
                                  it.worn ? "text-blue-600" : "opacity-30"
                                }`}
                                title={t("publicList.item.worn")}
                                aria-label={t("publicList.item.worn")}
                              >
                                <FaTshirt aria-hidden />
                              </span>
                              <span
                                className="text-xs text-primary tabular-nums"
                                title={t("publicList.item.quantity")}
                              >
                                × {it.qty ?? 1}
                              </span>
                              {linkHref ? (
                                <AffiliateGateLink
                                  href={linkHref}
                                  context="public"
                                  className="text-primary"
                                  title={t("publicList.item.viewProduct")}
                                  ariaLabel={t(
                                    "publicList.item.viewProductPaid"
                                  )}
                                >
                                  <FaShoppingCart
                                    className="h-4 w-4"
                                    aria-hidden
                                  />
                                </AffiliateGateLink>
                              ) : (
                                /* placeholder to keep row layout consistent */
                                <span
                                  className="inline-flex h-5 w-5 align-middle opacity-0"
                                  aria-hidden
                                />
                              )}
                            </div>
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

        {/* ======= PUBLIC LIST MODE: DESKTOP (≥ md) — match SortableItem list row, read-only ======= */}
        <div className="hidden md:block">
          {catOrder.map((catId) => {
            const title =
              catId === "__uncategorized__"
                ? uncategorizedLabel
                : catById.get(catId) || fallbackCategoryLabel;
            const items = grouped[catId] || [];
            const totalG = catTotalG(items);

            return (
              <section key={catId} className="bg-neutral rounded-lg py-2">
                {/* Category header (no grabber / no X) */}
                <div className="flex items-center mb-3 min-w-0">
                  <h3 className="font-bold flex-1 min-w-0 truncate pr-2 text-primaryAlt">
                    <span>{title}</span>
                  </h3>
                  <span className="pr-1 flex-shrink-0 text-primaryAlt tabular-nums">
                    {fmtWeight(totalG, unit)}
                  </span>
                </div>

                {/* Rows */}
                <div className="space-y-2">
                  {items.map((it) => {
                    const g = Number(it.weight_g) || 0;
                    const linkHref =
                      it.affiliate?.deepLink ||
                      it.affiliate?.url ||
                      it.link ||
                      null;

                    return (
                      <div
                        key={it.id || it._id}
                        className="grid items-center text-sm
                  grid-cols-[120px,minmax(260px,1fr),96px,112px,24px,24px,48px,24px]
                  gap-x-2 bg-base-100 px-3 py-2 rounded shadow"
                      >
                        {/* 1) Item type */}
                        <div className="font-semibold text-primary truncate">
                          {it.itemType || "—"}
                        </div>

                        {/* 2) Name/brand */}
                        <div className="truncate text-primary">
                          {it.brand && <span className="mr-1">{it.brand}</span>}
                          {it.name}
                        </div>

                        {/* 3) Weight (right-aligned, tabular) */}
                        <div className="justify-self-end tabular-nums text-primary w-[96px] text-right">
                          {fmtWeight(g, unit)}
                        </div>

                        {/* 4) Price (right-aligned, tabular) */}
                        <div className="justify-self-end tabular-nums text-primary w-[112px] text-right">
                          {fmtPrice(it, {
                            defaultCurrency,
                            locale: browserLocale,
                            placeholder: "—",
                          })}
                        </div>

                        {/* 5) Consumable */}
                        <div className="justify-self-center">
                          <span
                            className={`${
                              it.consumable ? "text-green-600" : "opacity-30"
                            }`}
                            title={t("publicList.item.consumable")}
                            aria-label={t("publicList.item.consumable")}
                          >
                            <FaUtensils aria-hidden />
                          </span>
                        </div>

                        {/* 6) Worn */}
                        <div className="justify-self-center">
                          <span
                            className={`${
                              it.worn ? "text-blue-600" : "opacity-30"
                            }`}
                            title={t("publicList.item.worn")}
                            aria-label={t("publicList.item.worn")}
                          >
                            <FaTshirt aria-hidden />
                          </span>
                        </div>

                        {/* 7) Qty */}
                        <div className="justify-self-center tabular-nums text-primary">
                          {it.qty ?? 1}
                        </div>

                        {/* 8) Cart */}
                        <div className="justify-self-center">
                          {linkHref ? (
                            <AffiliateGateLink
                              href={linkHref}
                              context="public"
                              className="text-primary hover:text-primary/80"
                              title={t("publicList.item.viewProduct")}
                              ariaLabel={t("publicList.item.viewProductPaid")}
                            >
                              <FaShoppingCart aria-hidden />
                            </AffiliateGateLink>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Fixed "public share" palette (scoped to this page only)
// Uses the same CSS variable names your utility classes resolve to.
const PUBLIC_THEME_CSS = `
  .public-share-theme {
    --color-primary-rgb: 23, 43, 77;      /* Navy — headings/buttons */
    --color-primaryAlt-rgb: 23, 43, 77;
    --color-secondary-rgb: 68, 84, 111;   /* Steel — secondary text */
    --color-secondaryAlt-rgb: 68, 84, 111;
    --color-accent-rgb: 12, 102, 228;     /* Electric blue — accent */
    --color-neutral-rgb: 241, 242, 244;   /* Light gray — page/category bg */
    --color-neutralAlt-rgb: 241, 242, 244;
    --color-error-rgb: 239, 68, 68;       /* Red — errors */
    --color-base-100-rgb: 255, 255, 255;  /* White — card background */
    --color-base-100Alt-rgb: 255, 255, 255;
  }
  `;
