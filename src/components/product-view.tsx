"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Fire,
  FlowerLotus,
  Money,
  PhoneCall,
  Tree,
  Truck,
  Wind,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import { formatPrice } from "@/lib/config";
import type { Product } from "@/lib/types";

const NOTE_ICONS = { top: Wind, heart: FlowerLotus, base: Tree } as const;

function Notes({ kind, label, value }: { kind: keyof typeof NOTE_ICONS; label: string; value: string }) {
  if (!value) return null;
  const Icon = NOTE_ICONS[kind];
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3ead9] text-accent-dark">
        <Icon size={24} weight="duotone" aria-hidden />
      </span>
      <div>
        <dt className="text-xs tracking-widest text-muted uppercase">{label}</dt>
        <dd className="mt-0.5">{value.split(";").map((s) => s.trim()).filter(Boolean).join(" · ")}</dd>
      </div>
    </div>
  );
}

/**
 * One product, several sizes. `variants` are the Sheet rows that share the same name
 * (smallest size first); `initialId` is the one in the URL.
 */
export function ProductView({
  variants,
  initialId,
  freeDeliveryOver,
}: {
  variants: Product[];
  initialId: string;
  freeDeliveryOver: number;
}) {
  const [selectedId, setSelectedId] = useState(initialId);
  const product = variants.find((v) => v.id === selectedId) ?? variants[0];
  const multiple = variants.length > 1;

  // On phones a slim "Add to cart" bar slides up once the real button has scrolled out of view.
  const mainCta = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = mainCta.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function choose(v: Product) {
    setSelectedId(v.id);
    // Keep the address bar in sync so a refresh or a shared link opens the same size.
    window.history.replaceState(null, "", `/products/${encodeURIComponent(v.id)}`);
  }

  const soldOut = product.stock <= 0;
  const low = product.stock > 0 && product.stock <= 5;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 pb-28 md:py-12 md:pb-12">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground">
        <ArrowLeft size={16} weight="bold" aria-hidden /> All fragrances
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div data-hero-in>
          {/* Remount only when the photos differ between sizes. */}
          <ProductGallery key={product.images.join("|")} product={product} />
        </div>
        <div data-hero-in>
          <h1 className="font-display text-5xl">{product.name}</h1>
          <p className="mt-1 text-muted">{product.size} · Eau de parfum</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="font-display text-4xl">{formatPrice(product.price)}</p>
            <p
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs tracking-widest uppercase ${
                soldOut ? "bg-line text-muted" : low ? "bg-accent text-background" : "bg-[#f3ead9] text-accent-dark"
              }`}
            >
              {soldOut ? (
                <XCircle size={16} weight="fill" aria-hidden />
              ) : low ? (
                <Fire size={16} weight="fill" aria-hidden />
              ) : (
                <CheckCircle size={16} weight="fill" aria-hidden />
              )}
              {soldOut ? "Sold out" : low ? `Only ${product.stock} left` : "In stock"}
            </p>
          </div>

          {product.description && <p className="mt-6 leading-relaxed text-muted">{product.description}</p>}

          {multiple && (
            <fieldset className="mt-8">
              <legend className="text-xs tracking-widest text-muted uppercase">Size</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {variants.map((v) => {
                  const selected = v.id === product.id;
                  const out = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => choose(v)}
                      className={`min-w-24 border px-4 py-3 text-left transition ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-line bg-card hover:border-foreground"
                      } ${out && !selected ? "text-muted" : ""}`}
                    >
                      <span className={`block text-sm font-medium ${out ? "line-through" : ""}`}>{v.size}</span>
                      <span className={`block text-xs ${selected ? "text-background/80" : "text-muted"}`}>
                        {out ? "Sold out" : formatPrice(v.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <dl className="mt-8 space-y-5 border-t border-line pt-6 text-sm">
            <Notes kind="top" label="Top notes" value={product.topNotes} />
            <Notes kind="heart" label="Heart notes" value={product.heartNotes} />
            <Notes kind="base" label="Base notes" value={product.baseNotes} />
          </dl>

          <div ref={mainCta} className="mt-8">
            <AddToCart key={product.id} id={product.id} stock={product.stock} />
          </div>

          <ul className="mt-6 space-y-3 border border-line bg-card p-5 text-sm">
            <li className="flex items-start gap-3">
              <Money size={22} weight="duotone" className="mt-px shrink-0 text-accent-dark" aria-hidden />
              Pay in cash when your parcel arrives. Nothing to pay online.
            </li>
            <li className="flex items-start gap-3">
              <PhoneCall size={22} weight="duotone" className="mt-px shrink-0 text-accent-dark" aria-hidden />
              We call you to confirm your order before it ships.
            </li>
            <li className="flex items-start gap-3">
              <Truck size={22} weight="duotone" className="mt-px shrink-0 text-accent-dark" aria-hidden />
              {freeDeliveryOver > 0 ? `Free delivery on orders over ${formatPrice(freeDeliveryOver)}.` : "Delivered to your door."}
            </li>
          </ul>
        </div>
      </div>

      {/* Phones only: slim bar with the price and the button, shown while the main button is off screen. */}
      <div
        aria-hidden={ctaVisible}
        inert={ctaVisible}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background px-4 py-3 shadow-[0_-6px_20px_rgba(28,25,23,0.08)] transition-transform duration-300 md:hidden ${
          ctaVisible ? "translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-lg leading-tight">{product.name}</p>
            <p className="text-sm text-muted">
              {product.size} · {formatPrice(product.price)}
            </p>
          </div>
          <div className="w-44 shrink-0">
            <AddToCart key={`bar-${product.id}`} id={product.id} stock={product.stock} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
