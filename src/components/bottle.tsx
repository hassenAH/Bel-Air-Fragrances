import type { Product } from "@/lib/types";

/** Flat bottle illustration — used as placeholder art and as the no-WebGL fallback. */
export function BottleSvg({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 80 120" className="h-2/3" role="img" aria-label={label}>
      <rect x="32" y="4" width="16" height="14" rx="2" fill="#1c1917" />
      <rect x="36" y="18" width="8" height="8" fill="#a8895a" />
      <rect x="12" y="26" width="56" height="88" rx="10" fill="#ffffff" fillOpacity="0.65" stroke="#a8895a" strokeWidth="1.5" />
      <rect x="22" y="58" width="36" height="28" rx="2" fill="none" stroke="#a8895a" strokeWidth="1" />
      <rect x="16" y="82" width="48" height="28" rx="6" fill="#a8895a" fillOpacity="0.25" />
    </svg>
  );
}

/** Product photo, or an elegant bottle placeholder when the Sheet has no image URL. */
export function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  if (product.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- image URLs come from the Sheet and can be any host
      <img
        src={product.image}
        alt={`${product.name} ${product.size}`}
        loading="lazy"
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
