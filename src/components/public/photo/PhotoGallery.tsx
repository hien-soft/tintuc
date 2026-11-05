"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryPhoto {
  id: string;
  thumb: string;
  stand: string;
  large: string;
  caption: string;
  alt: string;
  time?: string;
}

interface Labels {
  close: string;
  prev: string;
  next: string;
}

/** Lưới ảnh + lightbox (phím ←/→/Esc, vuốt trên cảm ứng). */
export function PhotoGallery({ photos, labels }: { photos: GalleryPhoto[]; labels: Labels }) {
  const [index, setIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = photos.length;

  const go = useCallback((delta: number) => setIndex((i) => (i === null ? i : (i + delta + count) % count)), [count]);
  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, go]);

  if (count === 0) return null;
  const [lead, ...rest] = photos;
  const current = index !== null ? photos[index] : null;

  return (
    <>
      <div className="space-y-2">
        <button type="button" onClick={() => setIndex(0)} className="group relative block w-full overflow-hidden bg-black" aria-label={lead.alt}>
          <img src={lead.large} alt={lead.alt} fetchPriority="high" className="mx-auto max-h-[70vh] w-full object-contain transition group-hover:opacity-90" />
          <span className="absolute bottom-3 right-3 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur">1 / {count}</span>
        </button>
        {rest.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {rest.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setIndex(i + 1)} className="block w-full overflow-hidden" aria-label={p.alt}>
                  <img src={p.thumb} alt={p.alt} loading="lazy" className="aspect-[4/3] w-full object-cover transition hover:scale-105" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {current && index !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="tabular-nums">
              {index + 1} / {count}
            </span>
            <button ref={closeRef} type="button" onClick={() => setIndex(null)} aria-label={labels.close} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            <img key={current.id} src={current.large} alt={current.alt} className="max-h-full max-w-full select-none object-contain" draggable={false} />
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={labels.prev} className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 sm:flex">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
                <button type="button" onClick={() => go(1)} aria-label={labels.next} className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 sm:flex">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <div className="mx-auto w-full max-w-4xl px-4 py-3 text-center text-sm text-gray-200">
            <p>{current.caption}</p>
            {current.time && <p className="mt-1 text-xs text-gray-400">{current.time}</p>}
          </div>
        </div>
      )}
    </>
  );
}
