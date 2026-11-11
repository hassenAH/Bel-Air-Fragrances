import { BRAND } from "./config";
import type { SiteContent, Testimonial } from "./types";

/** Shown until the shop writes its own text in the Sheet (Settings tab, key about_text). */
export const DEFAULT_ABOUT = {
  title: `About ${BRAND}`,
  paragraphs: [
    `Welcome to ${BRAND}. We bring you fragrances chosen with care, delivered to your door.`,
    "You order online, we call you to confirm your delivery, and you pay in cash when your parcel arrives.",
  ],
};

/** Only real web links: https, or a path on this site. Anything else (javascript:, data:, http:) is dropped. */
export function safeUrl(value: unknown, opts: { allowPath?: boolean } = {}): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (/^https:\/\/[^\s]+$/i.test(v)) return v;
  if (opts.allowPath && /^\/(?!\/)[^\s]*$/.test(v)) return v;
  return "";
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** "4,8" or "4.8" -> 4.8 ; outside 0-5 or not a number -> null. */
function rating(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 5 ? Math.round(n * 10) / 10 : null;
}

function count(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[\s.,]/g, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Cleans the raw Settings map from the Sheet. Never throws: bad values just become "not set". */
export function parseContent(raw: unknown): SiteContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    aboutTitle: text(r.about_title, 120),
    aboutParagraphs: text(r.about_text, 2000)
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean),
    aboutImage: safeUrl(r.about_image, { allowPath: true }),
    reviewsTitle: text(r.reviews_title, 120),
    reviewsSummary: text(r.reviews_summary, 1200),
    googleRating: rating(r.google_rating),
    googleReviewsCount: count(r.google_reviews_count),
    googleMapsUrl: safeUrl(r.google_maps_url),
    seoTitle: text(r.seo_title, 70),
    seoDescription: text(r.seo_description, 300),
    seoImage: safeUrl(r.seo_image, { allowPath: true }),
    instagramUrl: safeUrl(r.instagram_url),
    facebookUrl: safeUrl(r.facebook_url),
    tiktokUrl: safeUrl(r.tiktok_url),
    phone: text(r.contact_phone, 30).replace(/[^\d+()\-.\s]/g, ""),
  };
}

export function parseTestimonials(raw: unknown): Testimonial[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((t): Testimonial[] => {
      if (!t || typeof t !== "object") return [];
      const o = t as Record<string, unknown>;
      const body = text(o.text, 600);
      if (!body) return [];
      const stars = Math.round(Number(o.rating));
      return [{ name: text(o.name, 60), rating: Number.isFinite(stars) ? Math.min(5, Math.max(0, stars)) : 0, text: body }];
    })
    .slice(0, 12);
}
