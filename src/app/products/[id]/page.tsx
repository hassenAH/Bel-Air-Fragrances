import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { ProductView } from "@/components/product-view";
import { ScrollScope } from "@/components/motion/scroll-scope";
import { ProductSkeleton } from "@/components/skeletons";
import { getCatalog } from "@/lib/catalog";
import { BRAND, CURRENCY } from "@/lib/config";
import { absoluteUrl, productPath, snippet } from "@/lib/seo";
import type { Product } from "@/lib/types";
import { canonicalVariant, variantsOf } from "@/lib/variants";

export async function generateStaticParams() {
  const { products } = await getCatalog();
  // One page per size id. Cache Components needs at least one param at build time.
  return products.length ? products.map((p) => ({ id: p.id })) : [{ id: "_" }];
}

/** What to say about the product when the Sheet has no description. */
function describe(first: Product): string {
  if (first.description.trim()) return first.description;
  const notes = [
    first.topNotes && `top notes ${first.topNotes}`,
    first.heartNotes && `heart notes ${first.heartNotes}`,
    first.baseNotes && `base notes ${first.baseNotes}`,
  ].filter(Boolean);
  return `${first.name}, an eau de parfum by ${BRAND}${notes.length ? `: ${notes.join(", ")}` : ""}. Pay in cash on delivery.`;
}

const sizesOf = (variants: Product[]) => variants.map((v) => v.size).filter(Boolean).join(", ");

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { products } = await getCatalog();
  const variants = variantsOf(products, decodeURIComponent(id));
  const [first] = variants;
  // Unknown id: the page itself answers 404 and asks search engines to skip it.
  if (!first) return { title: "Product not found", robots: { index: false, follow: false } };

  const sizes = sizesOf(variants);
  const title = `${first.name} Eau de Parfum${sizes ? ` ${sizes}` : ""}`;
  const description = snippet(describe(first));
  const photo = variants.find((v) => v.images.length > 0)?.images[0];

  return {
    title,
    description,
    // All sizes of a product share one address in search results.
    alternates: { canonical: productPath(canonicalVariant(variants).id) },
    openGraph: {
      type: "website",
      title,
      description,
      url: productPath(canonicalVariant(variants).id),
      ...(photo ? { images: [photo] } : {}),
    },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description, ...(photo ? { images: [photo] } : {}) },
  };
}

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

/** Product + breadcrumb data for Google (price, size options, availability). */
function productSchema(variants: Product[]) {
  const first = variants[0];
  const canonicalUrl = absoluteUrl(productPath(canonicalVariant(variants).id));
  const images = [...new Set(variants.flatMap((v) => v.images))].slice(0, 6);
  const offers = variants.map((v) => ({
    "@type": "Offer",
    sku: v.id,
    name: v.size ? `${v.name} ${v.size}` : v.name,
    price: v.price,
    priceCurrency: CURRENCY,
    availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    url: absoluteUrl(productPath(v.id)),
  }));
  const prices = variants.map((v) => v.price);

  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: first.name,
      description: describe(first),
      sku: first.id,
      category: "Perfume",
      brand: { "@type": "Brand", name: BRAND },
      ...(images.length ? { image: images } : {}),
      url: canonicalUrl,
      offers:
        offers.length === 1
          ? offers[0]
          : {
              "@type": "AggregateOffer",
              priceCurrency: CURRENCY,
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              offerCount: offers.length,
              availability: variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              offers,
            },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: first.name, item: canonicalUrl },
      ],
    },
  ];
}

async function ProductDetail({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const { products, settings } = await getCatalog();
  const variants = variantsOf(products, id);
  if (variants.length === 0) notFound();

  return (
    <ScrollScope>
      <JsonLd data={productSchema(variants)} />
      {/* key: a different size id in the URL (e.g. from a link) starts with that size selected */}
      <ProductView key={id} variants={variants} initialId={id} freeDeliveryOver={settings.freeDeliveryOver} />
    </ScrollScope>
  );
}
