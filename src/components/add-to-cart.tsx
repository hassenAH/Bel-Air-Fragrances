"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ShoppingBagOpen, XCircle } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/lib/cart-store";

/**
 * Add-to-cart button. After a click it briefly turns gold with a tick ("Added"), so you always know it worked.
 * `compact` is the slim version used in the sticky bar on phones.
 */
export function AddToCart({ id, stock, compact = false }: { id: string; stock: number; compact?: boolean }) {
  const { add, lines } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const inCart = lines.find((l) => l.id === id)?.qty ?? 0;
  const pad = compact ? "py-3" : "py-4";

  if (stock <= 0) {
    return (
      <button
        disabled
        className={`flex w-full cursor-not-allowed items-center justify-center gap-3 bg-line px-6 ${pad} text-sm tracking-widest text-muted uppercase`}
      >
        <XCircle size={20} weight="fill" aria-hidden /> Sold out
      </button>
    );
  }

  const atMax = inCart >= stock;

  return (
    <div className={compact ? "" : "space-y-3"}>
      <button
        disabled={atMax}
        onClick={() => {
          add(id, 1, stock);
          setJustAdded(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setJustAdded(false), 1800);
        }}
        className={`flex w-full items-center justify-center gap-3 px-6 ${pad} text-sm tracking-widest text-background uppercase transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
          justAdded ? "bg-accent" : "bg-foreground hover:bg-accent-dark"
        }`}
      >
        {justAdded ? (
          <>
            <Check size={20} weight="bold" aria-hidden /> Added
          </>
        ) : atMax ? (
          "Maximum in cart"
        ) : (
          <>
            <ShoppingBagOpen size={20} weight="duotone" aria-hidden /> Add to cart
          </>
        )}
      </button>
      {!compact && inCart > 0 && (
        <p role="status" className="flex items-center justify-between text-sm text-muted">
          <span>{inCart} in your cart</span>
          <Link href="/cart" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">
            Checkout <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        </p>
      )}
    </div>
  );
}
