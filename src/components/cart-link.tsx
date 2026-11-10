"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-store";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="flex items-center gap-2 text-sm tracking-wide uppercase hover:text-accent-dark"
    >
      Cart
      <span
        aria-label={`${count} items in cart`}
        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-xs text-background"
      >
        {count}
      </span>
    </Link>
  );
}
