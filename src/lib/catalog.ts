import { cacheLife, cacheTag } from "next/cache";
import { parseContent, parseTestimonials } from "./content";
import { sampleCatalog } from "./sample-data";
import type { Catalog, RawCatalog } from "./types";

export const CATALOG_TAG = "catalog";

/**
 * The Sheet's `image` cell can hold several links separated by ";" "|" or a new line.
 * Only http(s) links and site paths ("/images/x.jpg") are accepted.
 */
export function splitImages(raw: string): string[] {
  return String(raw ?? "")
    .split(/[;|\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s) || s.startsWith("/"));
}

function normalize(raw: RawCatalog, demo = false): Catalog {
  return {
    settings: raw.settings,
    products: raw.products.map((p) => {
      const images = splitImages(p.image);
      return { ...p, image: images[0] ?? "", images };
    }),
    // An Apps Script from before these sections existed sends neither: both stay empty (nothing is invented).
    content: parseContent(raw.content),
    testimonials: parseTestimonials(raw.testimonials),
    demo,
  };
}

/**
 * Reads products + settings from the Google Sheet (via the Apps Script web app).
 * Cached: the site re-reads the Sheet at most every 2 minutes, and immediately
 * after an order is placed (see src/app/api/order/route.ts).
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 120, expire: 86400 });
  cacheTag(CATALOG_TAG);

  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return normalize(sampleCatalog, true);

  const res = await fetch(`${url}?action=catalog`, { redirect: "follow" });
  if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Sheet error: ${data.error}`);
  return normalize({
    products: data.products,
    settings: data.settings,
    content: data.content,
    testimonials: data.testimonials,
  });
}
