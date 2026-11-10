"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-store";

export function AddToCart({ id, stock }: { id: string; stock: number }) {
  const { add, lines } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = lines.find((l) => l.id === id)?.qty ?? 0;

  if (stock <= 0) {
    return (
      <button disabled className="w-full cursor-not-allowed bg-line px-6 py-4 text-sm tracking-widest text-muted uppercase">
        Out of stock
      </button>
    );
  }

  const atMax = inCart >= stock;

  return (
    <div className="space-y-3">
      <button
        disabled={atMax}
        onClick={() => {
          add(id, 1, stock);
          setAdded(true);
        }}
        className="w-full bg-foreground px-6 py-4 text-sm tracking-widest text-background uppercase transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {atMax ? "Maximum in cart" : "Add to cart"}
      </button>
      {(added || inCart > 0) && (
        <p className="text-sm text-muted" role="status">
          {inCart} in your cart.{" "}
          <Link href="/cart" className="text-foreground underline underline-offset-4">
            Checkout
          </Link>
        </p>
      )}
    </div>
  );
}
