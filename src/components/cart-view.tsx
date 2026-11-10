"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/bottle";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/config";
import { discountAmount } from "@/lib/coupon";
import type { Product, Settings } from "@/lib/types";

const input =
  "w-full border border-line bg-card px-4 py-3 text-sm outline-none focus:border-accent";

export function CartView({ products, settings }: { products: Product[]; settings: Settings }) {
  const cart = useCart();
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ orderId: string; total: number; demo: boolean } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking">("idle");
  const [couponError, setCouponError] = useState("");

  const lines = cart.lines.flatMap((l) => {
    const product = products.find((p) => p.id === l.id);
    return product ? [{ product, qty: l.qty }] : [];
  });

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  // Shown for convenience; the Sheet recalculates (and re-checks the coupon) when the order is placed.
  const discount = coupon ? discountAmount(subtotal, coupon.percent) : 0;
  const goods = subtotal - discount;
  const delivery = settings.freeDeliveryOver > 0 && goods >= settings.freeDeliveryOver ? 0 : settings.deliveryFee;
  const total = goods + delivery;
  const hasProblem = lines.some((l) => l.product.stock < l.qty);

  if (confirmed) {
    return (
      <div className="border border-line bg-card p-10 text-center">
        {confirmed.demo && (
          <p role="alert" className="mb-6 border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <strong>Demo mode: this order was NOT saved.</strong> The store is not connected to Google Sheets yet
            (APPS_SCRIPT_URL / APPS_SCRIPT_SECRET are missing). See README step 4.
          </p>
        )}
        <h2 className="font-display text-4xl">{confirmed.demo ? "Demo order" : "Thank you!"}</h2>
        <p className="mt-4">
          Your order <strong>{confirmed.orderId}</strong> has been received.
        </p>
        <p className="mt-2 text-muted">
          We will call you shortly to confirm delivery. Please prepare{" "}
          <strong className="text-foreground">{formatPrice(confirmed.total)}</strong> in cash.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-foreground px-8 py-3 text-sm tracking-widest uppercase hover:bg-foreground hover:text-background"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-muted">Your cart is empty.</p>
        <Link href="/" className="mt-4 inline-block underline underline-offset-4">
          Browse the collection
        </Link>
      </div>
    );
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponStatus === "checking") return;
    setCouponError("");
    setCouponStatus("checking");
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        setCoupon({ code: data.code, percent: data.percent });
        setCouponInput("");
      } else {
        setCouponError(data.error ?? "Invalid coupon code.");
      }
    } catch {
      setCouponError("Network problem. Please try again.");
    }
    setCouponStatus("idle");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (hasProblem) return;
    setError("");
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    const field = (k: string) => String(form.get(k) ?? "");

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: field("website"),
          items: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
          coupon: coupon?.code,
          customer: {
            name: field("name"),
            phone: field("phone"),
            email: field("email"),
            city: field("city"),
            address: field("address"),
            notes: field("notes"),
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        const message = String(data.error ?? "Something went wrong. Please try again.");
        setError(message);
        // The coupon was refused (used by someone else, expired...): take it off so the price is honest.
        if (/coupon/i.test(message)) setCoupon(null);
        setStatus("idle");
        return;
      }
      cart.clear();
      // Prefer the total calculated by the Sheet: that is what the customer really pays.
      setConfirmed({
        orderId: data.orderId,
        total: typeof data.total === "number" ? data.total : total,
        demo: data.demo === true,
      });
    } catch {
      setError("Network problem. Please check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-line border-y border-line">
        {lines.map(({ product, qty }) => (
          <li key={product.id} className="flex gap-4 py-5">
            <div className="h-24 w-20 shrink-0 overflow-hidden border border-line">
              <ProductImage product={product} />
            </div>
            <div className="flex-1">
              <Link href={`/products/${encodeURIComponent(product.id)}`} className="font-display text-xl">
                {product.name}
              </Link>
              <p className="text-sm text-muted">
                {product.size} · {formatPrice(product.price)}
              </p>
              {product.stock < qty && (
                <p className="mt-1 text-sm text-red-700" role="alert">
                  {product.stock === 0 ? "Out of stock" : `Only ${product.stock} available`} — please adjust.
                </p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm">
                <div className="flex items-center border border-line">
                  <button
                    aria-label="Decrease quantity"
                    className="px-3 py-1.5 hover:bg-line"
                    onClick={() => cart.setQty(product.id, qty - 1)}
                  >
                    −
                  </button>
                  <span className="w-8 text-center" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    aria-label="Increase quantity"
                    className="px-3 py-1.5 hover:bg-line disabled:opacity-40"
                    disabled={qty >= Math.min(product.stock, 20)}
                    onClick={() => cart.setQty(product.id, qty + 1)}
                  >
                    +
                  </button>
                </div>
                <button className="text-muted underline underline-offset-4" onClick={() => cart.remove(product.id)}>
                  Remove
                </button>
              </div>
            </div>
            <p className="text-sm">{formatPrice(product.price * qty)}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-4 self-start border border-line bg-card p-6">
        <h2 className="font-display text-2xl">Delivery details</h2>

        <input name="name" required autoComplete="name" placeholder="Full name" className={input} />
        <input
          name="phone"
          required
          type="tel"
          autoComplete="tel"
          placeholder="Phone number"
          className={input}
        />
        <input name="city" required autoComplete="address-level2" placeholder="City" className={input} />
        <textarea
          name="address"
          required
          rows={2}
          autoComplete="street-address"
          placeholder="Full address"
          className={input}
        />
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email (optional, for a confirmation)"
          className={input}
        />
        <textarea name="notes" rows={2} placeholder="Notes (optional)" className={input} />
        {/* Honeypot: hidden from people, bots fill it in. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        {/* Coupon: not part of the order form fields (no name); Enter applies it instead of submitting. */}
        <div className="border-t border-line pt-4">
          {coupon ? (
            <div className="flex items-center justify-between rounded-sm bg-accent/10 px-3 py-2 text-sm">
              <span>
                Coupon <strong>{coupon.code}</strong> · {coupon.percent}% off
              </span>
              <button
                type="button"
                onClick={() => setCoupon(null)}
                className="text-muted underline underline-offset-4 hover:text-foreground"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="coupon" className="sr-only">
                Coupon code
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCoupon();
                    }
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Coupon code"
                  className={`${input} uppercase placeholder:normal-case`}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponStatus === "checking" || !couponInput.trim()}
                  className="shrink-0 border border-foreground px-4 text-sm tracking-widest uppercase transition hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {couponStatus === "checking" ? "…" : "Apply"}
                </button>
              </div>
              {couponError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {couponError}
                </p>
              )}
            </>
          )}
        </div>

        <dl className="space-y-1 pt-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          {coupon && (
            <div className="flex justify-between text-accent-dark">
              <dt>
                Coupon {coupon.code} (−{coupon.percent}%)
              </dt>
              <dd>−{formatPrice(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{delivery === 0 ? "Free" : formatPrice(delivery)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-medium">
            <dt>Total to pay on delivery</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending" || hasProblem}
          className="w-full bg-foreground px-6 py-4 text-sm tracking-widest text-background uppercase transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "Placing order…" : "Place order · Cash on delivery"}
        </button>
      </form>
    </div>
  );
}
