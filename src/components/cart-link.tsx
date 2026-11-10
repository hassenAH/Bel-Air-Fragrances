"use client";

import Link from "next/link";
import { ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/lib/cart-store";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart, empty"}
      className="group relative inline-flex h-11 items-center gap-2 rounded-full px-3 transition hover:bg-line/70"
    >
      <ShoppingBagOpen size={26} weight="duotone" className="text-foreground transition group-hover:text-accent-dark" aria-hidden />
      <span className="hidden text-sm tracking-wide uppercase sm:inline">Cart</span>
      {count > 0 && (
        // key={count}: a new element each time the number changes, so the pop animation replays
        <span
          key={count}
          aria-hidden
          className="badge-pop absolute top-0 left-6 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-background sm:static sm:ml-0"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
