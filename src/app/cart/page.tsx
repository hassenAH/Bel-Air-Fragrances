import type { Metadata } from "next";
import { ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import { CartView } from "@/components/cart-view";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Cart & checkout" };

export default async function CartPage() {
  const { products, settings } = await getCatalog();
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="font-display mb-8 flex items-center gap-3 text-4xl">
        <ShoppingBagOpen size={40} weight="duotone" className="text-accent" aria-hidden /> Your cart
      </h1>
      <CartView products={products} settings={settings} />
    </div>
  );
}
