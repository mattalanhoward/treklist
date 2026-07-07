// client/src/components/ImageCarousel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiX, FiMaximize2 } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { resizedImageUrl } from "../utils/imageCdn";

const CAROUSEL_WIDTH = 800;
const LIGHTBOX_WIDTH = 1600;

function Lightbox({ images, startIndex, onClose }) {
  const { t } = useTranslation("common");
  const [index, setIndex] = useState(startIndex);
  const showNav = images.length > 1;

  const goPrev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const goNext = () => setIndex((i) => (i + 1) % images.length);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
        aria-label={t("actions.close")}
      >
        <FiX size={20} />
      </button>

      {/* Counter */}
      {showNav && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm tabular-nums">
          {index + 1} / {images.length}
        </span>
      )}

      {/* Image */}
      <img
        src={resizedImageUrl(images[index], LIGHTBOX_WIDTH)}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg select-none"
        draggable={false}
      />

      {/* Arrows */}
      {showNav && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label={t("imageCarousel.previous")}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
          >
            <FiChevronLeft size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label={t("imageCarousel.next")}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
          >
            <FiChevronRight size={22} strokeWidth={2} />
          </button>

          {/* Dot strip */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                className={`rounded-full transition-all duration-200 ${
                  i === index ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ImageCarousel({
  images = [],
  alt = "",
  className = "",
  loading = false,
  heightClass = "h-60",
  objectFit = "contain",
}) {
  const { t } = useTranslation("common");
  const safeImages = useMemo(() => {
    return (Array.isArray(images) ? images : []).filter(Boolean);
  }, [images]);

  // Downscaled versions for inline display (and preloading); the lightbox
  // resizes from the originals separately so zoom stays sharp.
  const displayImages = useMemo(
    () => safeImages.map((u) => resizedImageUrl(u, CAROUSEL_WIDTH)),
    [safeImages],
  );

  const [index, setIndex] = useState(0);
  const [loadedSet, setLoadedSet] = useState(() => new Set());
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    setIndex(0);
    setLoadedSet(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeImages.join("|")]);

  useEffect(() => {
    if (displayImages.length === 0) return;
    let cancelled = false;
    const nextLoaded = new Set();
    const imgs = displayImages.map((src) => {
      const im = new Image();
      im.onload = () => {
        if (cancelled) return;
        nextLoaded.add(src);
        setLoadedSet(new Set(nextLoaded));
      };
      im.src = src;
      return im;
    });
    return () => { cancelled = true; void imgs; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayImages.join("|")]);

  if (loading) {
    return <div className={`w-full ${heightClass} rounded-xl bg-base-200 animate-pulse ${className}`} />;
  }

  if (safeImages.length === 0) {
    return <div className={`w-full ${heightClass} rounded-xl bg-base-200 ${className}`} />;
  }

  const clampedIndex = Math.min(index, safeImages.length - 1);
  const current = displayImages[clampedIndex];
  const isCurrentLoaded = loadedSet.has(current);
  const showNav = safeImages.length > 1;

  const goPrev = (e) => { e?.stopPropagation(); setIndex((i) => (i - 1 + safeImages.length) % safeImages.length); };
  const goNext = (e) => { e?.stopPropagation(); setIndex((i) => (i + 1) % safeImages.length); };

  return (
    <>
      <div className={`w-full ${className}`}>
        <div
          className={`relative w-full ${heightClass} overflow-hidden rounded-xl bg-base-200 flex items-center justify-center group cursor-zoom-in`}
          onClick={() => setLightboxIndex(clampedIndex)}
        >
          {!isCurrentLoaded && (
            <div className="absolute inset-0 animate-pulse bg-base-300" />
          )}

          <img
            src={current}
            alt={alt}
            loading="eager"
            className={`w-full h-full ${objectFit === "cover" ? "object-cover" : "object-contain"}`}
            onLoad={() => setLoadedSet((s) => new Set([...s, current]))}
            draggable={false}
          />

          {/* Expand hint */}
          <div className="absolute top-2.5 right-2.5 bg-black/30 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <FiMaximize2 size={13} />
          </div>

          {/* Arrows */}
          {showNav && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label={t("imageCarousel.previousImage")}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/35 hover:bg-black/55 text-white rounded-full p-1.5 transition-colors focus:outline-none"
              >
                <FiChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label={t("imageCarousel.nextImage")}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/35 hover:bg-black/55 text-white rounded-full p-1.5 transition-colors focus:outline-none"
              >
                <FiChevronRight size={16} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Dots */}
          {showNav && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {safeImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                  aria-label={`Show image ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === clampedIndex
                      ? "w-4 h-1.5 bg-white"
                      : "w-1.5 h-1.5 bg-white/50 hover:bg-white/75"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={safeImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
