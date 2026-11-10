"use client";

import { useState } from "react";
import Link from "next/link";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import { formatPrice } from "@/lib/config";
import type { Product } from "@/lib/types";

function Notes({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs tracking-widest text-muted uppercase">{label}</dt>
      <dd className="mt-1">{value.split(";").map((s) => s.trim()).filter(Boolean).join(" · ")}</dd>
    </div>
  );
}

/**
 * One product, several sizes. `variants` are the Sheet rows that share the same name
 * (smallest size first); `initialId` is the one in the URL.
 */
export function ProductView({ variants, initialId }: { variants: Product[]; initialId: string }) {
  const [selectedId, setSelectedId] = useState(initialId);
  const product = variants.find((v) => v.id === selectedId) ?? variants[0];
  const multiple = variants.length > 1;

  function choose(v: Product) {
    setSelectedId(v.id);
    // Keep the address bar in sync so a refresh or a shared link opens the same size.
    window.history.replaceState(null, "", `/products/${encodeURIComponent(v.id)}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← All fragrances
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div data-hero-in>
          {/* Remount only when the photos differ between sizes. */}
          <ProductGallery key={product.images.join("|")} product={product} />
        </div>
        <div data-hero-in>
          <h1 className="font-display text-5xl">{product.name}</h1>
          <p className="mt-1 text-muted">{product.size} · Eau de parfum</p>
          <p className="mt-5 text-2xl">{formatPrice(product.price)}</p>
          {product.description && <p className="mt-6 leading-relaxed text-muted">{product.description}</p>}

          {multiple && (
            <fieldset className="mt-8">
              <legend className="text-xs tracking-widest text-muted uppercase">Size</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {variants.map((v) => {
                  const selected = v.id === product.id;
                  const soldOut = v.stock <= 0;
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
                      } ${soldOut && !selected ? "text-muted" : ""}`}
                    >
                      <span className={`block text-sm font-medium ${soldOut ? "line-through" : ""}`}>{v.size}</span>
                      <span className={`block text-xs ${selected ? "text-background/80" : "text-muted"}`}>
                        {soldOut ? "Sold out" : formatPrice(v.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <dl className="mt-8 space-y-4 border-t border-line pt-6 text-sm">
            <Notes label="Top notes" value={product.topNotes} />
            <Notes label="Heart notes" value={product.heartNotes} />
            <Notes label="Base notes" value={product.baseNotes} />
          </dl>

          <div className="mt-8">
            <AddToCart key={product.id} id={product.id} stock={product.stock} />
            {product.stock > 0 && product.stock <= 5 && (
              <p className="mt-3 text-sm text-accent-dark">Only {product.stock} left.</p>
            )}
            <p className="mt-4 text-sm text-muted">Pay in cash when your order is delivered.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
