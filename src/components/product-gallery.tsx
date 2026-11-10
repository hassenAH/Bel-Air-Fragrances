"use client";

import { useRef, useState } from "react";
import { ProductImage } from "@/components/bottle";
import type { Product } from "@/lib/types";

/** Main image + thumbnails. Swipe on touch screens, arrows and thumbnails everywhere. */
export function ProductGallery({ product }: { product: Product }) {
  const images = product.images;
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  // No photos in the Sheet: show the placeholder bottle.
  if (images.length === 0) {
    return (
      <div className="aspect-3/4 overflow-hidden border border-line bg-card">
        <ProductImage product={product} />
      </div>
    );
  }

  const many = images.length > 1;
  const go = (n: number) => setIndex((n + images.length) % images.length);
  const label = `${product.name} ${product.size}`;

  return (
    <div>
      <div
        className="relative aspect-3/4 touch-pan-y overflow-hidden border border-line bg-card"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null || !many) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
        }}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        {/* All images are stacked so switching is an instant cross-fade. */}
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- image URLs come from the Sheet and can be any host
          <img
            key={src}
            src={src}
            alt={`${label} (${i + 1} of ${images.length})`}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
            aria-hidden={i !== index}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {many && (
          <>
            <button
              aria-label="Previous image"
              onClick={() => go(index - 1)}
              className="absolute top-1/2 left-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-lg backdrop-blur transition hover:bg-background"
            >
              ‹
            </button>
            <button
              aria-label="Next image"
              onClick={() => go(index + 1)}
              className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-lg backdrop-blur transition hover:bg-background"
            >
              ›
            </button>
            <p
              className="absolute right-3 bottom-3 rounded-full bg-background/80 px-2.5 py-0.5 text-xs backdrop-blur"
              aria-live="polite"
            >
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>

      {many && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`block h-20 w-16 overflow-hidden border transition ${
                  i === index ? "border-foreground" : "border-line opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Sheet-provided URL */}
                <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
