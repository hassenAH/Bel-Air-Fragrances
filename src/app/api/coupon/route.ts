import { DEMO_COUPON } from "@/lib/coupon";

// Best-effort brake against guessing codes: max 8 tries per minute per visitor.
// (In-memory, so each server instance counts separately — the unguessable codes are the real protection.)
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear(); // never grow without bound
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) {
    return Response.json({ ok: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }

  let code = "";
  try {
    const body = await request.json();
    code = typeof body?.code === "string" ? body.code.trim().slice(0, 40).toUpperCase() : "";
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!code) return Response.json({ ok: false, error: "Enter a coupon code." }, { status: 400 });

  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;

  // Demo mode: no Sheet connected yet.
  if (!url || !secret) {
    return code === DEMO_COUPON.code
      ? Response.json({ ok: true, ...DEMO_COUPON, demo: true })
      : Response.json({ ok: false, error: `Demo mode: try ${DEMO_COUPON.code}.` });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, action: "coupon", code }),
      redirect: "follow",
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.ok && data.error === "Missing customer details.") {
      // An Apps Script deployment from before coupons existed treated this as an order.
      console.error("[coupon] The deployed Apps Script has no coupon support: paste the latest Code.gs and deploy a New version.");
      return Response.json({ ok: false, error: "Coupons are not available right now." });
    }
    if (!data.ok) return Response.json({ ok: false, error: String(data.error ?? "Invalid coupon code.") });
    return Response.json({ ok: true, code: data.code, percent: data.percent });
  } catch {
    return Response.json({ ok: false, error: "Could not check the coupon right now. Please try again." }, { status: 502 });
  }
}
