// client/src/components/TourModal.jsx
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { useTranslation } from "react-i18next";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Intersect a rect with the viewport (prevents huge spotlights when
 * the element is partially offscreen or inside scroll/overflow containers).
 */
function intersectWithViewport(r) {
  const top = Math.max(r.top, 8);
  const left = Math.max(r.left, 8);
  const right = Math.min(r.right, window.innerWidth - 8);
  const bottom = Math.min(r.bottom, window.innerHeight - 8);

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export default function TourModal({
  isOpen,
  stepIndex,
  steps,
  onNext,
  onBack,
  onSkip,
}) {
  const { t } = useTranslation("common");

  const step = steps?.[stepIndex] || null;

  const targetSelector = step?.target || "";

  const [targetRect, setTargetRect] = useState(null);
  const [spotRadius, setSpotRadius] = useState("16px");
  const [remeasureTick, setRemeasureTick] = useState(0);

  // Find target element
  const targetEl = useMemo(() => {
    if (!isOpen) return null;
    if (!targetSelector) return null;
    try {
      return document.querySelector(targetSelector);
    } catch {
      return null;
    }
  }, [isOpen, targetSelector]);

  // Scroll target into view on step change
  useEffect(() => {
    if (!isOpen) return;
    if (!targetEl) return;

    try {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // ignore
    }
  }, [isOpen, targetEl, stepIndex, remeasureTick]);

  // Measure rect (and re-measure on scroll/resize)
  useLayoutEffect(() => {
    if (!isOpen) return;

    const measure = () => {
      if (!targetEl) {
        setTargetRect(null);
        return;
      }

      const raw = targetEl.getBoundingClientRect();
      if (!raw || raw.width < 2 || raw.height < 2) {
        setTargetRect(null);
        return;
      }

      // Clamp to viewport to avoid giant boxes
      const clipped = intersectWithViewport(raw);
      if (!clipped || clipped.width < 2 || clipped.height < 2) {
        setTargetRect(null);
        return;
      }

      setTargetRect(clipped);

      // Keep spotlight shape aligned with the element
      try {
        const cs = window.getComputedStyle(targetEl);
        setSpotRadius(cs.borderRadius || "16px");
      } catch {
        setSpotRadius("16px");
      }
    };

    measure();

    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    let ro = null;
    if (targetEl && "ResizeObserver" in window) {
      ro = new ResizeObserver(measure);
      ro.observe(targetEl);
    }

    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [isOpen, targetEl, stepIndex]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onSkip?.();
      if (e.key === "ArrowRight") onNext?.();
      if (e.key === "ArrowLeft") onBack?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onSkip, onNext, onBack]);

  // Run step enter/exit hooks (for things like opening/closing sidebar on mobile)
  useEffect(() => {
    if (!isOpen) return;

    const isMobile = () =>
      typeof window !== "undefined" && window.innerWidth < 640;

    const prev = steps?.[stepIndex - 1];
    const next = steps?.[stepIndex];

    try {
      prev?.onExit?.({ isMobile: isMobile() });
    } catch {}

    try {
      next?.onEnter?.({ isMobile: isMobile() });
    } catch {}
  }, [isOpen, stepIndex, steps]);

  // Force a re-measure shortly after step changes
  useEffect(() => {
    if (!isOpen) return;

    const t1 = setTimeout(() => setRemeasureTick((n) => n + 1), 80);
    const t2 = setTimeout(() => setRemeasureTick((n) => n + 1), 260);
    const t3 = setTimeout(() => setRemeasureTick((n) => n + 1), 360); // after 300ms sidebar anim
    const t4 = setTimeout(() => setRemeasureTick((n) => n + 1), 520); // extra safety

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isOpen, stepIndex]);

  if (!isOpen || !step) return null;

  const hasSpotlight = !!targetRect;

  // Per-step control (optional):
  const padding = Number.isFinite(Number(step?.spotlightPadding))
    ? Number(step.spotlightPadding)
    : 2;

  const spot = hasSpotlight
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  const isLast = stepIndex >= steps.length - 1;

  // Optional: pulse dot via step.showPulse (defaults off)
  const showPulse = Boolean(step?.showPulse);

  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.aria.productTour", "Product tour")}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />

      {/* Spotlight */}
      {hasSpotlight && (
        <>
          <div
            className="absolute border border-white/15"
            style={{
              top: `${spot.top}px`,
              left: `${spot.left}px`,
              width: `${spot.width}px`,
              height: `${spot.height}px`,
              borderRadius: spotRadius,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.50)",
              pointerEvents: "none",
            }}
          />

          {/* Optional pulse (off by default) */}
          {showPulse && (
            <div
              className="absolute"
              style={{
                top: `${spot.top - 6}px`,
                left: `${spot.left - 6}px`,
                width: 14,
                height: 14,
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-secondary shadow" />
              <div className="absolute inset-0 rounded-full bg-secondary/40 animate-ping" />
            </div>
          )}
        </>
      )}

      {/* Tooltip card: center on desktop, bottom on mobile */}
      <div className="absolute inset-0 flex pointer-events-none items-end sm:items-center justify-center p-3 sm:p-0">
        <div
          className="
      pointer-events-auto
      w-[360px] max-w-[calc(100vw-24px)]
      sm:w-[360px]
      mb-[calc(env(safe-area-inset-bottom,0px)+34px)]
      sm:mb-0
    "
        >
          <div className="bg-neutralAlt rounded-xl shadow-lg border border-primary/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/10 flex items-center justify-between">
              <div className="text-sm font-semibold text-primary">
                {step.title}
              </div>
              <button
                type="button"
                onClick={onSkip}
                className="p-2 rounded hover:bg-base-100/70 text-primary"
                aria-label={t("tour.actions.close", "Close tour")}
              >
                <FaTimes />
              </button>
            </div>

            {/* Fixed content block so the modal never "jumps" */}
            <div className="px-4 py-3">
              {/* Reserve exactly 3 lines worth of space */}
              <p
                className="text-sm text-primary/90 leading-relaxed"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  // Ensures the card height stays identical even for short 1-line steps
                  minHeight: "calc(3 * 1.5em)", // 3 lines * line-height (leading-relaxed ~ 1.5)
                }}
              >
                {step.body}
              </p>

              {/* Progress dots */}
              <div className="mt-3 flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full ${
                      i === stepIndex ? "bg-secondary" : "bg-primary/20"
                    }`}
                  />
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onSkip}
                  className="px-3 py-2 text-sm rounded hover:bg-base-100/70 text-primary"
                >
                  {t("tour.actions.skip", "Skip")}{" "}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={stepIndex === 0}
                    className={`px-3 py-2 text-sm rounded border border-primary/15 hover:bg-base-100/70 text-primary ${
                      stepIndex === 0 ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {t("tour.actions.previous", "Previous")}{" "}
                  </button>
                  <button
                    type="button"
                    onClick={onNext}
                    className="px-3 py-2 text-sm rounded bg-secondary text-white hover:bg-secondary/80"
                  >
                    {isLast
                      ? t("tour.actions.done", "Done")
                      : t("tour.actions.next", "Next")}{" "}
                  </button>
                </div>
              </div>
            </div>
            {/* end fixed content */}
          </div>
        </div>
      </div>
    </div>
  );
}
