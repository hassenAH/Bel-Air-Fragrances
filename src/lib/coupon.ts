/** Demo-mode only (no Sheet connected): lets you try the coupon box locally. Never used with a real Sheet. */
export const DEMO_COUPON = { code: "DEMO10", percent: 10 };

/** Same rounding as the Apps Script: percent of the products, to the cent. */
export function discountAmount(subtotal: number, percent: number): number {
  return Math.round(subtotal * percent) / 100;
}
