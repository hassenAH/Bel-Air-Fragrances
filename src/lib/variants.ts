import type { Product } from "./types";

/**
 * In the Sheet every size is its own row (own id, price, stock).
 * Rows with the same `name` are shown as ONE product with a size picker.
 */
export type ProductGroup = { key: string; name: string; variants: Product[] };

export const groupKey = (p: Product) => p.name.trim().toLowerCase().replace(/\s+/g, " ");

/** "50ml" -> 50, "1.7 oz" -> 1.7, no number -> Infinity (sorted last). */
export function sizeValue(size: string): number {
  const m = /(\d+(?:[.,]\d+)?)/.exec(size);
  return m ? parseFloat(m[1].replace(",", ".")) : Number.POSITIVE_INFINITY;
}

const bySize = (a: Product, b: Product) => {
  const d = sizeValue(a.size) - sizeValue(b.size);
  return Number.isNaN(d) ? 0 : d;
};

export function groupProducts(products: Product[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    const key = groupKey(p);
    const g = map.get(key);
    if (g) g.variants.push(p);
    else map.set(key, { key, name: p.name.trim(), variants: [p] });
  }
  return [...map.values()].map((g) => ({ ...g, variants: [...g.variants].sort(bySize) }));
}

/** All sizes of the product that contains `id`, smallest first. Empty if `id` is unknown. */
export function variantsOf(products: Product[], id: string): Product[] {
  const p = products.find((x) => x.id === id);
  if (!p) return [];
  const key = groupKey(p);
  return groupProducts(products.filter((x) => groupKey(x) === key))[0].variants;
}
