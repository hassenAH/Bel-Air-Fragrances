import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import type { OrderRequest } from "@/lib/types";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parse(body: unknown): OrderRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 30) return null;

  const items = b.items.map((i) => ({
    id: str((i as { id?: unknown })?.id, 80),
    qty: Number((i as { qty?: unknown })?.qty),
  }));
  if (items.some((i) => !i.id || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 20)) return null;

  const c = (b.customer ?? {}) as Record<string, unknown>;
  const customer = {
    name: str(c.name, 100),
    phone: str(c.phone, 30),
    email: str(c.email, 120),
    city: str(c.city, 80),
    address: str(c.address, 300),
    notes: str(c.notes, 500),
  };
  if (!customer.name || !customer.address || !customer.city) return null;
  if (!/^[+\d][\d\s().-]{5,}$/.test(customer.phone)) return null;
  if (customer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) return null;

  const coupon = str(b.coupon, 40).toUpperCase();
  return { items, customer, ...(coupon ? { coupon } : {}) };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field, bots usually do.
  if (typeof body === "object" && body !== null && (body as { website?: unknown }).website) {
    return Response.json({ ok: true, orderId: "OK" });
  }

  const order = parse(body);
  if (!order) {
    return Response.json(
      { ok: false, error: "Please check your details (name, phone, city and address are required)." },
      { status: 400 },
    );
  }

  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;

  // Demo mode: no Sheet connected yet.
  if (!url || !secret) {
    console.warn(
      "[demo order] NOT saved to Google Sheets: APPS_SCRIPT_URL / APPS_SCRIPT_SECRET are not set. Order:",
      JSON.stringify(order),
    );
    return Response.json({ ok: true, demo: true, orderId: `DEMO-${Date.now().toString().slice(-6)}` });
  }

  try {
    const started = Date.now();
    // Apps Script answers POSTs with a redirect; fetch follows it automatically.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      // currency: only used to print amounts like "89 TND" in the emails (comes from our env, not the browser)
      body: JSON.stringify({ ...order, secret, currency: process.env.NEXT_PUBLIC_CURRENCY ?? "TND" }),
      redirect: "follow",
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.ok) {
      return Response.json({ ok: false, error: String(data.error ?? "Order failed.") }, { status: 422 });
    }
    revalidateTag(CATALOG_TAG, { expire: 0 }); // stock changed — refresh the catalog
    // Timing for the server log: how long Google took, and whether the emails were queued or sent inline.
    console.info(
      `[order] ${data.orderId} saved. Round trip to Apps Script ${Date.now() - started} ms ` +
        `(script ${data.ms ?? "?"} ms, emails ${data.mail ?? "sent inline (old script)"}).`,
    );
    // total/discount come from the Sheet: that is the amount the customer must pay.
    return Response.json({ ok: true, orderId: data.orderId, total: data.total, discount: data.discount });
  } catch {
    return Response.json(
      { ok: false, error: "We could not place your order right now. Please try again." },
      { status: 502 },
    );
  }
}
