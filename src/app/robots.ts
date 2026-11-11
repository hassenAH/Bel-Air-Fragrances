import type { MetadataRoute } from "next";
import { IS_PUBLIC_SITE, absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Deploy previews and local builds: ask crawlers to skip everything.
  if (!IS_PUBLIC_SITE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/cart"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
