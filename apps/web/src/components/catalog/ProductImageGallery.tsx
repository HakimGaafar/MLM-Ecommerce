"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import AppOverlay from "@/components/ui/AppOverlay";

export type GalleryImage = { id: string; url: string; isPrimary: boolean };

type GalleryUi = {
  prevImage: string;
  nextImage: string;
  zoomIn: string;
  zoomOut: string;
  close: string;
  openGallery: string;
  imageOf: string;
};

const AUTO_MS = 4500;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.35;

function unoptimized(url: string) {
  return url.startsWith("/uploads/");
}

export default function ProductImageGallery({
  images,
  productName,
  locale,
  ui,
}: {
  images: GalleryImage[];
  productName: string;
  locale: "en" | "ar";
  ui: GalleryUi;
}) {
  const isRtl = locale === "ar";
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((i) => i.isPrimary)));
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [paused, setPaused] = useState(false);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  const count = images.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const current = images[safeIndex];

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const goPrev = useCallback(() => goTo(safeIndex - 1), [goTo, safeIndex]);
  const goNext = useCallback(() => goTo(safeIndex + 1), [goTo, safeIndex]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) setPaused(true);
  }, []);

  useEffect(() => {
    if (count <= 1 || paused || lightbox) return;
    const timer = window.setInterval(() => goNext(), AUTO_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, lightbox, goNext]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        isRtl ? goNext() : goPrev();
      } else if (e.key === "ArrowRight") {
        isRtl ? goPrev() : goNext();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, goPrev, goNext, isRtl]);

  useEffect(() => {
    if (lightbox) dialogRef.current?.focus();
  }, [lightbox]);

  function openLightbox(at: number) {
    setIndex(at);
    setZoom(1);
    setLightbox(true);
  }

  function closeLightbox() {
    setLightbox(false);
    setZoom(1);
  }

  function changeLightboxImage(delta: number) {
    goTo(safeIndex + delta);
    setZoom(1);
  }

  function markFailed(id: string) {
    setFailedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  if (count === 0) {
    return (
      <div className="relative flex aspect-[16/10] items-center justify-center bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]">
        <span className="text-5xl opacity-50" aria-hidden>
          🛒
        </span>
      </div>
    );
  }

  const counterLabel = ui.imageOf
    .replace("{current}", String(safeIndex + 1))
    .replace("{total}", String(count));

  return (
    <>
      <section
        className="group relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <button
          type="button"
          className="relative block w-full cursor-zoom-in overflow-hidden bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          onClick={() => openLightbox(safeIndex)}
          aria-label={ui.openGallery}
        >
          <div className="relative aspect-[16/10]">
            {images.map((img, i) => (
              <div
                key={img.id}
                className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                  i === safeIndex ? "gallery-slide-active z-10 opacity-100" : "z-0 pointer-events-none opacity-0"
                }`}
                aria-hidden={i !== safeIndex}
              >
                {failedIds.has(img.id) ? (
                  <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-50" aria-hidden>
                    🛒
                  </div>
                ) : (
                  <Image
                    src={img.url}
                    alt={i === safeIndex ? productName : ""}
                    fill
                    className="object-cover"
                    priority={i === 0}
                    sizes="(max-width: 768px) 100vw, 768px"
                    unoptimized={unoptimized(img.url)}
                    onError={() => markFailed(img.id)}
                  />
                )}
              </div>
            ))}
          </div>

          {count > 1 ? (
            <>
              <span className="absolute bottom-3 end-3 z-20 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {counterLabel}
              </span>
              <div className="absolute bottom-3 start-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                {images.map((img, i) => (
                  <span
                    key={img.id}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === safeIndex ? "w-5 bg-white" : "w-1.5 bg-white/45"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </button>

        {count > 1 ? (
          <>
            <CarouselArrow
              label={ui.prevImage}
              side="start"
              className="absolute start-2 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
            />
            <CarouselArrow
              label={ui.nextImage}
              side="end"
              className="absolute end-2 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              reverse
            />
          </>
        ) : null}
      </section>

      {count > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                  i === safeIndex
                    ? "border-[var(--primary)] ring-2 ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
                    : "border-[var(--border)] opacity-80 hover:opacity-100"
                }`}
                aria-label={`${productName} — ${i + 1}`}
                aria-current={i === safeIndex ? "true" : undefined}
              >
                {failedIds.has(img.id) ? (
                  <div className="absolute inset-0 flex items-center justify-center text-lg opacity-50" aria-hidden>
                    🛒
                  </div>
                ) : (
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized={unoptimized(img.url)}
                    onError={() => markFailed(img.id)}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <AppOverlay
        open={lightbox}
        onClose={closeLightbox}
        panelSize="viewport"
        ariaLabel={productName}
        dialogRef={dialogRef}
        panelClassName="gallery-lightbox-toolbar border-0 p-0 shadow-[var(--shadow-md)]"
      >
                <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3 sm:px-5">
                  <p className="text-sm font-medium">{counterLabel}</p>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={ui.zoomOut}
                      onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                      disabled={zoom <= ZOOM_MIN}
                    >
                      −
                    </IconButton>
                    <span className="min-w-[3rem] text-center text-xs tabular-nums text-[var(--muted)]">
                      {Math.round(zoom * 100)}%
                    </span>
                    <IconButton
                      label={ui.zoomIn}
                      onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                      disabled={zoom >= ZOOM_MAX}
                    >
                      +
                    </IconButton>
                    <IconButton label={ui.close} onClick={closeLightbox} className="ms-2">
                      ✕
                    </IconButton>
                  </div>
                </div>

                <div
                  className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-12 sm:px-16"
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
                    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)));
                  }}
                >
                  {count > 1 ? (
                    <CarouselArrow
                      label={ui.prevImage}
                      side="start"
                      className="absolute start-2 top-1/2 z-30 -translate-y-1/2 sm:start-4"
                      onClick={() => changeLightboxImage(-1)}
                      variant="lightbox"
                    />
                  ) : null}

                  <div
                    className="relative h-[min(72vh,720px)] w-full max-w-5xl transition-transform duration-200 ease-out"
                    style={{ transform: `scale(${zoom})` }}
                  >
                    {failedIds.has(current.id) ? (
                      <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-50" aria-hidden>
                        🛒
                      </div>
                    ) : (
                      <Image
                        src={current.url}
                        alt={productName}
                        fill
                        className="object-contain drop-shadow-lg"
                        sizes="100vw"
                        unoptimized={unoptimized(current.url)}
                        onError={() => markFailed(current.id)}
                        priority
                      />
                    )}
                  </div>

                  {count > 1 ? (
                    <CarouselArrow
                      label={ui.nextImage}
                      side="end"
                      className="absolute end-2 top-1/2 z-30 -translate-y-1/2 sm:end-4"
                      onClick={() => changeLightboxImage(1)}
                      reverse
                      variant="lightbox"
                    />
                  ) : null}
                </div>

                {count > 1 ? (
                  <ul className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-4">
                    {images.map((img, i) => (
                      <li key={img.id}>
                        <button
                          type="button"
                          onClick={() => {
                            goTo(i);
                            setZoom(1);
                          }}
                          className={`gallery-lightbox-thumb relative block h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${
                            i === safeIndex
                              ? "gallery-lightbox-thumb-active opacity-100"
                              : "opacity-75 hover:opacity-100"
                          }`}
                        >
                          {failedIds.has(img.id) ? (
                            <div className="absolute inset-0 flex items-center justify-center text-xs opacity-50" aria-hidden>
                              🛒
                            </div>
                          ) : (
                            <Image
                              src={img.url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="56px"
                              unoptimized={unoptimized(img.url)}
                              onError={() => markFailed(img.id)}
                            />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
      </AppOverlay>
    </>
  );
}

function CarouselArrow({
  label,
  side,
  className,
  onClick,
  reverse,
  variant = "carousel",
}: {
  label: string;
  side: "start" | "end";
  className?: string;
  onClick: (e: MouseEvent) => void;
  reverse?: boolean;
  variant?: "carousel" | "lightbox";
}) {
  const chevron = reverse ? "›" : "‹";
  const base =
    variant === "lightbox"
      ? "gallery-lightbox-arrow flex h-11 w-11 items-center justify-center rounded-full text-2xl transition"
      : "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)]/90 text-xl text-[var(--foreground)] shadow-[var(--shadow-md)] backdrop-blur-sm transition hover:bg-[var(--surface)]";

  return (
    <button
      type="button"
      aria-label={label}
      className={`${base} ${className ?? ""}`}
      onClick={onClick}
    >
      {chevron}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`gallery-lightbox-btn flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}


