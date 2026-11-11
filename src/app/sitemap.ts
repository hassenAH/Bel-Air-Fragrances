import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { absoluteUrl, productPath } from "@/lib/seo";
import { canonicalVariant, groupProducts } from "@/lib/variants";

/** Home page plus one entry per product (its sizes share one page). The cart is left out on purpose. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await getCatalog();
  const groups = groupProducts(products);
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    ...groups.map((g) => ({
      url: absoluteUrl(productPath(canonicalVariant(g.variants).id)),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
