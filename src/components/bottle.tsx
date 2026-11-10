import { BottleSvg } from "@/components/bottle-svg";
import { SmartImage } from "@/components/smart-image";
import type { Product } from "@/lib/types";

export { BottleSvg };

/** Product photo, or an elegant bottle placeholder when the Sheet has no image URL. */
export function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  if (product.image) {
    return (
      <SmartImage
        src={product.image}
        alt={`${product.name} ${product.size}`}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-linear-to-b from-[#f1e9dc] to-[#e4d6bd] ${className}`}>
      <BottleSvg label={`${product.name} bottle`} />
    </div>
  );
}
