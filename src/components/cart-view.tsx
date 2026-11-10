"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Check,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  MapPin,
  Minus,
  Money,
  NotePencil,
  Package,
  Phone,
  PhoneCall,
  Plus,
  ShoppingBagOpen,
  Tag,
  Trash,
  Truck,
  User,
  WarningCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { ProductImage } from "@/components/bottle";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/config";
import { discountAmount } from "@/lib/coupon";
import type { Product, Settings } from "@/lib/types";

// "pl-11" leaves room for the icon on the left of each field.
const input =
  "w-full border border-line bg-background pl-11 pr-4 py-3 text-sm outline-none transition focus:border-accent focus:bg-card";

/** A form field with a small gold icon on its left. */
function Field({ Icon, top = false, children }: { Icon: Icon; top?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon
        size={20}
        weight="duotone"
        aria-hidden
        className={`pointer-events-none absolute left-3.5 text-accent-dark ${top ? "top-3.5" : "top-1/2 -translate-y-1/2"}`}
      />
      {children}
    </div>
  );
}

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

  // Progress towards free delivery (only when the shop has set a threshold).
  const threshold = settings.freeDeliveryOver;
  const remaining = Math.max(0, threshold - goods);
  const progress = threshold > 0 ? Math.min(100, (goods / threshold) * 100) : 0;

  if (confirmed) {
    return (
      <div className="border border-line bg-card p-8 text-center md:p-12">
        {confirmed.demo && (
          <p role="alert" className="mb-8 flex items-start gap-3 border border-red-300 bg-red-50 p-4 text-left text-sm text-red-800">
            <WarningCircle size={22} weight="fill" className="mt-px shrink-0" aria-hidden />
            <span>
              <strong>Demo mode: this order was NOT saved.</strong> The store is not connected to Google Sheets yet
              (APPS_SCRIPT_URL / APPS_SCRIPT_SECRET are missing). See README step 4.
            </span>
          </p>
        )}
        <CheckCircle size={80} weight="duotone" className="mx-auto text-accent" aria-hidden />
        <h2 className="font-display mt-4 text-5xl">{confirmed.demo ? "Demo order" : "Thank you!"}</h2>
        <p className="mt-4">
          Your order <strong className="rounded-full bg-[#f3ead9] px-3 py-1 text-accent-dark">{confirmed.orderId}</strong> has been received.
        </p>

        <ol className="mx-auto mt-8 max-w-md space-y-4 text-left text-sm">
          {[
            { Icon: PhoneCall, text: "We call you shortly to confirm your delivery." },
            { Icon: Package, text: "We prepare your parcel and send it to you." },
            { Icon: Money, text: `You pay ${formatPrice(confirmed.total)} in cash when it arrives.` },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3ead9] text-accent-dark">
                <Icon size={24} weight="duotone" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ol>

        <Link
          href="/"
          className="group mt-10 inline-flex items-center gap-3 border border-foreground px-8 py-3 text-sm tracking-widest uppercase transition hover:bg-foreground hover:text-background"
        >
          <ArrowLeft size={18} weight="bold" className="transition group-hover:-translate-x-1" aria-hidden /> Continue shopping
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="border border-line bg-card px-6 py-16 text-center">
        <ShoppingBagOpen size={72} weight="duotone" className="mx-auto text-accent" aria-hidden />
        <p className="font-display mt-4 text-3xl">Your cart is empty</p>
        <p className="mt-2 text-muted">Find a fragrance you love and it will appear here.</p>
        <Link
          href="/#collection"
          className="group mt-8 inline-flex items-center gap-3 bg-foreground px-8 py-4 text-sm tracking-widest text-background uppercase transition hover:bg-accent-dark"
        >
          Browse the collection <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-1" aria-hidden />
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
    <div className="grid gap-10 md:grid-cols-[1fr_400px]">
      <div>
        {/* Free-delivery progress: flat colours, updates as items or coupons change */}
        {threshold > 0 && (
          <div className="mb-6 border border-line bg-card p-4">
            <p className="flex items-center gap-3 text-sm">
              {remaining > 0 ? (
                <Truck size={24} weight="duotone" className="shrink-0 text-accent-dark" aria-hidden />
              ) : (
                <CheckCircle size={24} weight="fill" className="shrink-0 text-accent" aria-hidden />
              )}
              {remaining > 0 ? (
                <span>
                  Add <strong>{formatPrice(remaining)}</strong> more for <strong>free delivery</strong>
                </span>
              ) : (
                <span>
                  You have unlocked <strong>free delivery</strong>
                </span>
              )}
            </p>
            <div
              role="progressbar"
              aria-label="Progress towards free delivery"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="mt-3 h-2 w-full bg-line"
            >
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <ul className="divide-y divide-line border-y border-line">
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="flex gap-4 py-5">
              <div className="h-28 w-24 shrink-0 overflow-hidden border border-line">
                <ProductImage product={product} />
              </div>
              <div className="flex-1">
                <Link href={`/products/${encodeURIComponent(product.id)}`} className="font-display text-xl transition hover:text-accent-dark">
                  {product.name}
                </Link>
                <p className="text-sm text-muted">
                  {product.size} · {formatPrice(product.price)}
                </p>
                {product.stock < qty && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-red-700" role="alert">
                    <WarningCircle size={16} weight="fill" aria-hidden />
                    {product.stock === 0 ? "Out of stock" : `Only ${product.stock} available`} — please adjust.
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center border border-line">
                    <button
                      aria-label="Decrease quantity"
                      className="flex h-10 w-10 items-center justify-center transition hover:bg-line"
                      onClick={() => cart.setQty(product.id, qty - 1)}
                    >
                      <Minus size={16} weight="bold" aria-hidden />
                    </button>
                    <span className="w-9 text-center font-medium" aria-live="polite">
                      {qty}
                    </span>
                    <button
                      aria-label="Increase quantity"
                      className="flex h-10 w-10 items-center justify-center transition hover:bg-line disabled:opacity-40"
                      disabled={qty >= Math.min(product.stock, 20)}
                      onClick={() => cart.setQty(product.id, qty + 1)}
                    >
                      <Plus size={16} weight="bold" aria-hidden />
                    </button>
                  </div>
                  <button
                    className="inline-flex items-center gap-1.5 text-muted transition hover:text-red-700"
                    onClick={() => cart.remove(product.id)}
                  >
                    <Trash size={18} weight="duotone" aria-hidden /> Remove
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium">{formatPrice(product.price * qty)}</p>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} className="space-y-4 self-start border border-line bg-card p-6">
        <h2 className="font-display text-3xl">Delivery details</h2>

        <Field Icon={User}>
          <input name="name" required autoComplete="name" placeholder="Full name" className={input} />
        </Field>
        <Field Icon={Phone}>
          <input name="phone" required type="tel" autoComplete="tel" placeholder="Phone number" className={input} />
        </Field>
        <Field Icon={Buildings}>
          <input name="city" required autoComplete="address-level2" placeholder="City" className={input} />
        </Field>
        <Field Icon={MapPin} top>
          <textarea name="address" required rows={2} autoComplete="street-address" placeholder="Full address" className={input} />
        </Field>
        <Field Icon={EnvelopeSimple}>
          <input name="email" type="email" autoComplete="email" placeholder="Email (optional, for a confirmation)" className={input} />
        </Field>
        <Field Icon={NotePencil} top>
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className={input} />
        </Field>
        {/* Honeypot: hidden from people, bots fill it in. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        {/* Coupon: not part of the order form fields (no name); Enter applies it instead of submitting. */}
        <div className="border-t border-line pt-4">
          {coupon ? (
            <div className="flex items-center justify-between gap-3 bg-[#f3ead9] px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <Tag size={20} weight="fill" className="text-accent-dark" aria-hidden />
                <span>
                  <strong>{coupon.code}</strong> · {coupon.percent}% off
                </span>
              </span>
              <button
                type="button"
                onClick={() => setCoupon(null)}
                aria-label="Remove coupon"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-line hover:text-foreground"
              >
                <X size={16} weight="bold" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="coupon" className="sr-only">
                Coupon code
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={20} weight="duotone" aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-accent-dark" />
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
                </div>
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponStatus === "checking" || !couponInput.trim()}
                  className="flex shrink-0 items-center justify-center border border-foreground px-4 text-sm tracking-widest uppercase transition hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {couponStatus === "checking" ? <CircleNotch size={18} weight="bold" className="animate-spin" aria-label="Checking" /> : "Apply"}
                </button>
              </div>
              {couponError && (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-red-700">
                  <WarningCircle size={16} weight="fill" aria-hidden /> {couponError}
                </p>
              )}
            </>
          )}
        </div>

        <dl className="space-y-1.5 pt-1 text-sm">
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
          <div className="mt-2 flex items-center justify-between bg-[#f3ead9] px-4 py-3 text-base font-medium">
            <dt>Total to pay on delivery</dt>
            <dd className="font-display text-2xl">{formatPrice(total)}</dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
            <WarningCircle size={18} weight="fill" className="mt-px shrink-0" aria-hidden /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending" || hasProblem}
          className="flex w-full items-center justify-center gap-3 bg-foreground px-6 py-4 text-sm tracking-widest text-background uppercase transition hover:bg-accent-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? (
            <>
              <CircleNotch size={20} weight="bold" className="animate-spin" aria-hidden /> Placing order…
            </>
          ) : (
            <>
              <Check size={20} weight="bold" aria-hidden /> Place order · Cash on delivery
            </>
          )}
        </button>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted">
          <Money size={16} weight="duotone" aria-hidden /> Nothing is charged online. You pay on delivery.
        </p>
      </form>
    </div>
  );
}
