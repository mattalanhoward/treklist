// client/src/components/ImageCarousel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function ImageCarousel({
  images = [],
  alt = "",
  className = "",
  loading = false,
  heightClass = "h-60",
}) {
  const safeImages = useMemo(() => {
    return (Array.isArray(images) ? images : []).filter(Boolean);
  }, [images]);

  const [index, setIndex] = useState(0);
  const [loadedSet, setLoadedSet] = useState(() => new Set());

  // Reset when image set changes
  useEffect(() => {
    setIndex(0);
    setLoadedSet(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeImages.join("|")]);

  // Preload images so next/prev is instant (or close)
  useEffect(() => {
    if (safeImages.length === 0) return;

    let cancelled = false;
    const nextLoaded = new Set();

    const imgs = safeImages.map((src) => {
      const im = new Image();
      im.onload = () => {
        if (cancelled) return;
        nextLoaded.add(src);
        setLoadedSet(new Set(nextLoaded));
      };
      im.onerror = () => {
        // ignore
      };
      im.src = src;
      return im;
    });

    return () => {
      cancelled = true;
      void imgs; // allow GC
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeImages.join("|")]);

  if (loading) {
    return (
      <div
        className={
          "w-full " +
          heightClass +
          " rounded bg-white/30 animate-pulse " +
          className
        }
      />
    );
  }

  if (safeImages.length === 0) {
    return (
      <div
        className={
          "w-full " +
          heightClass +
          " rounded bg-white/30 flex items-center justify-center text-primary text-sm " +
          className
        }
      />
    );
  }

  const clampedIndex = Math.min(index, safeImages.length - 1);
  const current = safeImages[clampedIndex];
  const isCurrentLoaded = loadedSet.has(current);

  const goPrev = () =>
    setIndex((i) => (i - 1 + safeImages.length) % safeImages.length);
  const goNext = () => setIndex((i) => (i + 1) % safeImages.length);

  const showNav = safeImages.length > 1;

  return (
    <div className={"w-full " + className}>
      {/* Image frame */}
      <div
        className={
          "relative w-full " +
          heightClass +
          " rounded overflow-hidden flex items-center justify-center"
        }
      >
        {!isCurrentLoaded && (
          <div className="absolute inset-0 animate-pulse bg-white/20" />
        )}

        <img
          src={current}
          alt={alt}
          loading="eager"
          className="w-full h-full object-contain"
          onLoad={() => setLoadedSet((s) => new Set([...s, current]))}
        />

        {/* Arrow controls (overlay, centered) */}
        {showNav && (
          <>
            <div className="absolute left-0 top-0 h-full w-4 flex items-center justify-center">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous image"
                className="rounded p-2 text-primary hover:bg-neutralAlt/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <FiChevronLeft />
              </button>
            </div>

            <div className="absolute right-0 top-0 h-full w-4 flex items-center justify-center">
              <button
                type="button"
                onClick={goNext}
                aria-label="Next image"
                className="rounded p-2 text-primary hover:bg-neutralAlt/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <FiChevronRight />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Dots (below image) */}
      {showNav && (
        <div className="flex justify-center">
          <div className="flex items-center justify-center gap-2 bg-neutralAlt/70 border border-primary rounded-full px-2 py-1">
            {safeImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                className={
                  "h-2 w-2 rounded-full " +
                  (i === clampedIndex
                    ? "bg-primary"
                    : "bg-transparent opacity-60 border border-primary")
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
