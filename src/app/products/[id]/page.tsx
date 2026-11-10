import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductView } from "@/components/product-view";
import { ScrollScope } from "@/components/motion/scroll-scope";
import { ProductSkeleton } from "@/components/skeletons";
import { getCatalog } from "@/lib/catalog";
import { variantsOf } from "@/lib/variants";

export async function generateStaticParams() {
  const { products } = await getCatalog();
  // One page per size id. Cache Components needs at least one param at build time.
  return products.length ? products.map((p) => ({ id: p.id })) : [{ id: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { products } = await getCatalog();
  const [first] = variantsOf(products, decodeURIComponent(id));
  return first ? { title: first.name, description: first.description } : {};
}

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const { products } = await getCatalog();
  const variants = variantsOf(products, id);
  if (variants.length === 0) notFound();

  return (
    <ScrollScope>
      {/* key: a different size id in the URL (e.g. from a link) starts with that size selected */}
      <ProductView key={id} variants={variants} initialId={id} />
    </ScrollScope>
  );
}
