// client/src/pages/PublicGearList.jsx
import React from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { FaUtensils, FaTshirt, FaShoppingCart, FaEdit } from "react-icons/fa";
import PackStats from "../components/PackStats";
import { useUserSettings } from "../contexts/UserSettings";
import AffiliateGateLink from "../components/AffiliateGateLink";
import AffiliateDisclosureNotice from "../components/AffiliateDisclosureNotice";
import PublicHeader from "../components/PublicHeader";
import FooterLegal from "../components/FooterLegal";
import SEO from "../components/SEO";
import api, { refreshAccessToken } from "../services/api";
import { useTranslation } from "react-i18next";
import Spinner from "../components/ui/Spinner";

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

export default function PublicGearList() {
  const { t } = useTranslation("common");
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const copyRanRef = React.useRef(false);

  const { weightUnit, setWeightUnit } = useUserSettings();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);
  const unit = weightUnit === "oz" ? "oz" : "g";
  const setUnit = (u) => setWeightUnit(u);
  const [copying, setCopying] = React.useState(false);

  // IMPORTANT: used for embed height measurement
  const rootRef = React.useRef(null);

  // Embed detection
  // - `?embed=1` explicitly forces embed mode.
  // - window.self !== window.top catches typical iframe embeds.
  const isEmbedParam =
    new URLSearchParams(location.search).get("embed") === "1";
  const isInIframe = (() => {
    try {
      return typeof window !== "undefined" && window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const isEmbed = isEmbedParam || isInIframe;

  // If the URL has ?copy=1, we should immediately copy+redirect.
  // Critically: we should NOT render the public list first.
  const wantsCopy =
    !isEmbed && new URLSearchParams(location.search).get("copy") === "1";

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        // During copy flow, skip loading public list data entirely (prevents flash).
        if (wantsCopy) return;
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
            e.response?.data?.error || t("publicList.errors.loadFailed"),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, t, wantsCopy]);

  // If ?copy=1 is present, attempt copy automatically after mount (post-auth return)
  React.useEffect(() => {
    // Never auto-copy inside embeds (window.open from an effect will be blocked)
    if (isEmbed) return;

    if (wantsCopy && !copyRanRef.current) {
      copyRanRef.current = true; // guard against React StrictMode double-invoke
      setCopying(true);
      attemptCopy().finally(() => {
        // If we didn't navigate away (error case), allow UI again.
        setCopying(false);
      });
    }
  }, [location.search, isEmbed, wantsCopy]);

  async function attemptCopy() {
    // In embeds, avoid in-iframe auth redirects. Open the full share page in a new tab.
    if (isEmbed) {
      const href = `${window.location.origin}/share/${token}?copy=1`;
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const { data: resp } = await api.post(
        `/public/share/${token}/copy`,
        null,
        { __noGlobal401: true }, // <-- let us handle 401 here
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
            { __noGlobal401: true },
          );
          const newId2 = retry.listId || retry.list?._id;
          if (newId2) {
            navigate(`/dashboard/${newId2}`, { replace: true });
            return;
          }
        } catch {
          // Silent refresh failed → treat as anonymous and go to auth with `next`
          const nextUrl = encodeURIComponent(`/share/${token}?copy=1`);
          window.location.href = `/?auth=register&next=${nextUrl}`;
          return;
        }
      }

      console.error(e);
      alert(e.response?.data?.error || t("publicList.errors.copyFailedAlert"));
    }
  }

  // SEO is now handled by the SEO component in the JSX

  // When embedded, report our rendered height to the parent page (postMessage).
  // Uses rootRef + getBoundingClientRect to avoid 100vh / body measurement feedback loops.
  React.useEffect(() => {
    if (!isEmbed) return;
    if (typeof window === "undefined") return;

    const el = rootRef.current;
    if (!el) return;

    let lastSent = 0;
    let rafId = 0;

    const send = () => {
      rafId = 0;
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (!Number.isFinite(h) || h < 50) return;
      if (Math.abs(h - lastSent) < 1) return;
      lastSent = h;

      window.parent?.postMessage(
        { type: "treklist:embed-height", token, height: h },
        "*",
      );
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(send);
    };

    schedule();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    }

    window.addEventListener("resize", schedule);

    // fonts can change layout after first paint → send once ready
    if (document?.fonts?.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }

    return () => {
      window.removeEventListener("resize", schedule);
      if (rafId) cancelAnimationFrame(rafId);
      ro?.disconnect?.();
    };
  }, [isEmbed, token, data, unit]);

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

  // --- Embed styling helpers (compact mode) ---
  const pageBgClass = isEmbed ? "bg-base-100" : "bg-neutral";
  const minHClass = isEmbed ? "min-h-0" : "min-h-screen";
  const containerClass = cx(
    isEmbed ? "max-w-none mx-0 px-1 py-2" : "max-w-5xl mx-auto px-4 py-6",
  );

  // In embeds: flatter sections (no big gray blocks), more like a simple table.
  const sectionShellClass = cx(
    isEmbed ? "bg-transparent rounded-none py-0" : "bg-neutral rounded-lg py-2",
  );

  const desktopRowClass = cx(
    "grid items-center gap-x-2",
    "grid-cols-[160px,minmax(260px,1fr),96px,24px,24px,24px,48px]",
    isEmbed
      ? "text-[12px] px-0 py-1 border-b border-primary/10 bg-transparent shadow-none rounded-none"
      : "text-sm bg-base-100 px-3 py-2 rounded shadow",
  );

  const mobileItemClass = cx(
    isEmbed
      ? "bg-transparent px-0 py-2 border-b border-primary/10"
      : "bg-base-100 px-3 py-2 rounded shadow mb-2",
  );

  // In embeds, we avoid doing auth/copy flows inside the iframe and instead
  // send users to the full share page in a new tab.
  const customizeHref = `/share/${token}?copy=1`;

  function CustomizeCTA({ label, className = "" }) {
    const common = cx(
      `
        inline-flex items-center gap-2
        rounded-md
        bg-[rgb(var(--color-accent-rgb))] text-[rgb(var(--color-base-100-rgb))]
        hover:bg-opacity-90
        focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-rgb))] focus:ring-offset-1
        transition
      `,
      className,
    );

    return isEmbed ? (
      <a
        href={customizeHref}
        target="_blank"
        rel="noopener noreferrer"
        className={common}
        aria-label={t("publicList.cta.ariaLabel")}
      >
        <FaEdit aria-hidden />
        <span className="font-sm">{label}</span>
      </a>
    ) : (
      <button
        type="button"
        onClick={() => {
          setCopying(true);
          attemptCopy().finally(() => {
            setCopying(false);
          });
        }}
        className={common}
        disabled={copying}
        aria-label={t("publicList.cta.ariaLabel")}
      >
        <FaEdit aria-hidden />
        <span className="font-sm">{label}</span>
      </button>
    );
  }

  if (copying) {
    const label = t?.("publicList.status.copying") || "Creating your copy…";
    return (
      <div className="h-screen">
        <Spinner centered label={label} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cx(
          isEmbed ? "py-4" : "min-h-screen",
          "flex items-center justify-center text-secondary",
        )}
      >
        {t("publicList.status.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cx(
          isEmbed ? "py-4" : "min-h-screen",
          "flex items-center justify-center text-error",
        )}
      >
        {error}
      </div>
    );
  }

  if (!data) return null;

  const catById = new Map(data.categories.map((c) => [c.id, c.title]));

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
    <div
      ref={rootRef}
      className={cx(
        "public-share-theme flex flex-col",
        minHClass,
        pageBgClass,
        isEmbed ? "text-[16px] leading-[1.25]" : "",
      )}
    >
      {/* SEO meta tags - only index featured lists */}
      <SEO
        title={data.list.title}
        description={t("publicList.seo.description", {
          title: data.list.title,
        })}
        url={`https://treklist.co/share/${token}/`}
        type="article"
        noindex={!data.list.isFeatured}
      />

      {/* Scoped palette for the public page only */}
      <style>{PUBLIC_THEME_CSS}</style>

      {/* Header + footer are suppressed when embedded */}
      {!isEmbed && <PublicHeader variant="solid" showSections={false} />}

      <main className="flex-1">
        <div className={containerClass}>
          {/* ===== Header ===== */}
          {/* Desktop (>= md): Title + PackStats | CTA | Toggle */}
          <div className="hidden md:grid mb-2 gap-y-2">
            <AffiliateDisclosureNotice
              context="public"
              className={cx(isEmbed ? "text-[12px]" : "", "mb-1")}
            />

            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <h1
                  className={cx(
                    isEmbed ? "text-xl" : "text-3xl",
                    "font-semibold text-primary truncate",
                  )}
                >
                  {data.list.title}
                </h1>

                <PackStats
                  base={stats.base}
                  worn={stats.worn}
                  consumable={stats.consumable}
                  total={stats.total}
                  disablePopover
                />
              </div>

              {/* Right-side controls: toggle + CTA */}
              <div className="flex items-center gap-2">
                {/* Unit toggle */}
                <div
                  className="inline-flex border border-primary/10 rounded overflow-hidden"
                  aria-live="polite"
                >
                  <button
                    className={cx(
                      "px-2 py-1 text-xs",
                      unit === "g" ? "bg-primary text-base-100" : "bg-base-100",
                    )}
                    onClick={() => setUnit("g")}
                    aria-pressed={unit === "g"}
                  >
                    g
                  </button>
                  <button
                    className={cx(
                      "px-2 py-1 text-xs",
                      unit === "oz"
                        ? "bg-primary text-base-100"
                        : "bg-base-100",
                    )}
                    onClick={() => setUnit("oz")}
                    aria-pressed={unit === "oz"}
                  >
                    oz
                  </button>
                </div>

                <CustomizeCTA
                  label={t("publicList.cta.labelDesktop")}
                  className={cx(isEmbed ? "px-2 py-1 text-xs" : "px-3 py-1")}
                />
              </div>
            </div>
          </div>

          {/* Mobile (< md): Title → PackStats → CTA → Toggle */}
          <div className="md:hidden mb-2">
            <AffiliateDisclosureNotice
              context="public"
              className={cx(isEmbed ? "text-[12px]" : "", "mb-1")}
            />

            <h1
              className={cx(
                isEmbed ? "text-lg" : "text-2xl",
                "font-semibold text-primary text-center",
              )}
            >
              {data.list.title}
            </h1>

            <div className="mt-2 flex justify-center">
              <PackStats
                base={stats.base}
                worn={stats.worn}
                consumable={stats.consumable}
                total={stats.total}
                disablePopover
              />
            </div>

            <div className="mt-2 flex justify-center">
              <CustomizeCTA
                label={t("publicList.cta.labelMobile")}
                className={cx(
                  isEmbed
                    ? "text-xs px-2 py-2 min-h-[36px] whitespace-nowrap"
                    : "text-sm px-3 py-2 min-h-[44px] whitespace-nowrap",
                )}
              />
            </div>

            <div className="mt-2 flex justify-center">
              <div
                className="inline-flex border border-primary/10 rounded overflow-hidden"
                aria-live="polite"
              >
                <button
                  className={cx(
                    "px-2 py-1 text-xs",
                    unit === "g" ? "bg-primary text-base-100" : "bg-base-100",
                  )}
                  onClick={() => setUnit("g")}
                  aria-pressed={unit === "g"}
                >
                  g
                </button>
                <button
                  className={cx(
                    "px-2 py-1 text-xs",
                    unit === "oz" ? "bg-primary text-base-100" : "bg-base-100",
                  )}
                  onClick={() => setUnit("oz")}
                  aria-pressed={unit === "oz"}
                >
                  oz
                </button>
              </div>
            </div>
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
                <section key={catId} className={sectionShellClass}>
                  {/* Category header */}
                  <div
                    className={cx(
                      "flex items-center min-w-0",
                      isEmbed ? "py-2" : "mb-3",
                    )}
                  >
                    <h2
                      className={cx(
                        isEmbed ? "text-[13px]" : "text-lg",
                        "font-semibold flex-1 min-w-0 truncate pr-2 text-primaryAlt",
                      )}
                    >
                      <span>{title}</span>
                    </h2>
                    <span className="pr-1 flex-shrink-0 text-primaryAlt tabular-nums">
                      {fmtWeight(totalG, unit)}
                    </span>
                  </div>

                  <ul>
                    {items.map((it) => {
                      const g = Number(it.weight_g) || 0;
                      const linkHref =
                        it.affiliate?.deepLink ||
                        it.affiliate?.url ||
                        it.link ||
                        null;

                      return (
                        <li key={it.id || it._id} className={mobileItemClass}>
                          <div className="grid grid-rows-[auto_auto] gap-y-1 gap-x-2">
                            {/* Row 1 */}
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

                            {/* Row 2 */}
                            <div className="row-start-2 col-span-2 grid grid-cols-[1fr_auto] items-center">
                              <div className="grid grid-cols-[70px_75px] text-primary">
                                <span className="tabular-nums text-left">
                                  {fmtWeight(g, unit)}
                                </span>
                              </div>

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
                                      "publicList.item.viewProductPaid",
                                    )}
                                  >
                                    <FaShoppingCart
                                      className="h-4 w-4"
                                      aria-hidden
                                    />
                                  </AffiliateGateLink>
                                ) : (
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

          {/* ======= PUBLIC LIST MODE: DESKTOP (≥ md) — read-only ======= */}
          <div className="hidden md:block">
            {catOrder.map((catId) => {
              const title =
                catId === "__uncategorized__"
                  ? uncategorizedLabel
                  : catById.get(catId) || fallbackCategoryLabel;
              const items = grouped[catId] || [];
              const totalG = catTotalG(items);

              return (
                <section key={catId} className={sectionShellClass}>
                  <div
                    className={cx(
                      "flex items-center min-w-0",
                      isEmbed ? "py-2" : "mb-3",
                    )}
                  >
                    <h2
                      className={cx(
                        isEmbed ? "text-[16px] pt-4" : "text-lg",
                        "font-semibold flex-1 min-w-0 truncate pr-2 text-primaryAlt",
                      )}
                    >
                      <span>{title}</span>
                    </h2>
                    <span className="pr-1 flex-shrink-0 text-primaryAlt tabular-nums">
                      {fmtWeight(totalG, unit)}
                    </span>
                  </div>

                  <div className={cx(isEmbed ? "" : "space-y-2")}>
                    {items.map((it) => {
                      const g = Number(it.weight_g) || 0;
                      const linkHref =
                        it.affiliate?.deepLink ||
                        it.affiliate?.url ||
                        it.link ||
                        null;

                      return (
                        <div key={it.id || it._id} className={desktopRowClass}>
                          <div className="font-semibold text-primary truncate">
                            {it.itemType || "—"}
                          </div>

                          <div className="truncate text-primary">
                            {it.brand && (
                              <span className="mr-1">{it.brand}</span>
                            )}
                            {it.name}
                          </div>

                          <div className="justify-self-end tabular-nums text-primary w-[96px] text-right pr-2">
                            {fmtWeight(g, unit)}
                          </div>

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

                          <div className="justify-self-center tabular-nums text-primary">
                            {it.qty ?? 1}
                          </div>

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
      </main>

      {!isEmbed && (
        <FooterLegal
          variant="light"
          containerWidth="max-w-5xl"
          className="mt-10"
        />
      )}
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
