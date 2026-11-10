/** One grey shimmering block. Purely visual: hidden from screen readers. */
function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** The product page while the product loads: same layout as the real page, so nothing jumps. */
export function ProductSkeleton() {
  return (
    // role="status" + a screen-reader-only label announce "loading" once; the blocks themselves are hidden.
    <div role="status" aria-busy="true" className="mx-auto max-w-5xl px-5 py-12">
      <span className="sr-only">Loading the product…</span>
      <Bone className="h-4 w-32" />
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        {/* Gallery */}
        <div>
          <Bone className="aspect-3/4 w-full" />
          <div className="mt-3 flex gap-2">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-20 w-16 shrink-0" />
            ))}
          </div>
        </div>
        {/* Details */}
        <div>
          <Bone className="h-12 w-3/4" />
          <Bone className="mt-3 h-4 w-40" />
          <Bone className="mt-6 h-8 w-32" />
          <div className="mt-6 space-y-2">
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-11/12" />
            <Bone className="h-4 w-2/3" />
          </div>
          {/* Sizes */}
          <Bone className="mt-8 h-3 w-12" />
          <div className="mt-3 flex gap-3">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-14 w-24" />
            ))}
          </div>
          {/* Notes */}
          <div className="mt-8 space-y-5 border-t border-line pt-6">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Bone className="h-3 w-20" />
                <Bone className="mt-2 h-4 w-48" />
              </div>
            ))}
          </div>
          {/* Add to cart */}
          <Bone className="mt-8 h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
