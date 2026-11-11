import { BRAND } from "./config";

/**
 * The public address of the site, with no trailing slash. Search engines need absolute URLs
 * (canonical links, sitemap, share images), so this matters.
 *
 * Order: NEXT_PUBLIC_SITE_URL (your own domain) -> the address Netlify gives the site -> localhost.
 * Netlify sets URL (the main address) and DEPLOY_PRIME_URL (the address of this particular deploy).
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    // Production builds use the main address; previews / branch deploys use their own.
    process.env.CONTEXT === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL,
    process.env.URL,
  ];
  for (const c of candidates) {
    const v = (c ?? "").trim().replace(/\/+$/, "");
    if (/^https?:\/\/[^\s]+$/i.test(v)) return v;
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

/**
 * True only for the real, public site. Previews and local builds ask search engines to stay away,
 * so a test copy of the shop can never compete with the real one in Google.
 */
export const IS_PUBLIC_SITE = (() => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.CONTEXT ? process.env.CONTEXT === "production" : true;
  return process.env.CONTEXT === "production";
})();

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const productPath = (id: string) => `/products/${encodeURIComponent(id)}`;

/** Short text for a snippet: one line, cut at a word boundary with an ellipsis. */
export function snippet(value: string, max = 158): string {
  const v = value.replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Safe to put inside a <script type="application/ld+json"> tag (a "<" could close the tag early). */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export const DEFAULT_TITLE = `${BRAND} — Perfume, pay on delivery`;
