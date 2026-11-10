// Brand settings. Change these in .env.local (see .env.example) — no code edits needed.
export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Bel Air Fragrances";
export const TAGLINE =
  process.env.NEXT_PUBLIC_TAGLINE ?? "Fine fragrances, delivered to your door.";
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "TND";

// Hero background. The 3D canvas uses the same colour so glass refracts a seamless backdrop.
export const HERO_BG = "#f0e6d4";

export function formatPrice(amount: number): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${n} ${CURRENCY}`;
}
