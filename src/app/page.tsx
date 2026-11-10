import Link from "next/link";
import { BottleSvg, ProductImage } from "@/components/bottle";
import { AboutSection, ReviewsSection } from "@/components/home-sections";
import { BottleSlot, BottleStage } from "@/components/motion/bottle-stage";
import { ScrollScope } from "@/components/motion/scroll-scope";
import { getCatalog } from "@/lib/catalog";
import { BRAND, TAGLINE, formatPrice } from "@/lib/config";
import { groupProducts, type ProductGroup } from "@/lib/variants";

const ACTS = [
  { n: "01", title: "Top notes", text: "The first impression. Bright and volatile, it greets you in the first few minutes." },
  { n: "02", title: "Heart notes", text: "The soul of the fragrance. It blooms as the top fades and stays for hours." },
  { n: "03", title: "Base notes", text: "The lasting trail. Warm, deep and soft on skin long after you have left the room." },
];

export default async function Home() {
  const { products, content, testimonials, demo } = await getCatalog();
  const groups = groupProducts(products);

  return (
    <ScrollScope>
      {/* Hero + About share one 3D canvas: the bottle flies from the hero into the About frame as you scroll. */}
      <BottleStage>
      <section data-hero className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-5 py-10 md:grid-cols-2 md:py-16">
          <div data-hero-text className="order-2 text-center md:order-1 md:text-left">
            <p data-hero-in className="mb-4 text-xs tracking-[0.35em] text-accent-dark uppercase">
              Eau de parfum
            </p>
            <h1 data-hero-in className="font-display text-5xl leading-[1.05] font-medium md:text-7xl">
              {BRAND}
            </h1>
            <p data-hero-in className="mx-auto mt-5 max-w-md text-muted md:mx-0">
              {TAGLINE}
            </p>
            <a
              data-hero-in
              href="#collection"
              className="mt-8 inline-block border border-foreground px-8 py-3 text-sm tracking-widest uppercase transition hover:bg-foreground hover:text-background"
            >
              Shop the collection
            </a>
          </div>
          <div data-hero-in className="order-1 md:order-2">
            <BottleSlot
              name="hero"
              className="relative h-[380px] w-full md:h-[560px]"
              fallback={
                <div className="flex h-full w-full items-center justify-center">
                  <BottleSvg label={`${BRAND} perfume bottle`} />
                </div>
              }
            />
          </div>
        </div>
      </section>

      <AboutSection content={content} />
      </BottleStage>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 data-reveal className="font-display mb-12 text-center text-4xl md:text-5xl">
          Three acts, one fragrance
        </h2>
        <div className="grid gap-10 md:grid-cols-3">
          {ACTS.map((a) => (
            <div key={a.n} data-reveal className="border-t border-line pt-6">
              <p className="font-display text-5xl text-accent">{a.n}</p>
              <h3 className="font-display mt-2 text-2xl">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="collection" className="border-t border-line bg-white/50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 data-reveal className="font-display mb-12 text-center text-4xl md:text-5xl">
            The collection
          </h2>
          {groups.length === 0 ? (
            <p className="text-center text-muted">New fragrances are coming soon.</p>
          ) : (
            // flex + justify-center: a short last row (e.g. 3 products on a 4-column layout) stays centred
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-10">
              {groups.map((g) => (
                <ProductCard key={g.key} group={g} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <ReviewsSection content={content} testimonials={testimonials} demo={demo} />
    </ScrollScope>
  );
}

/** One card per product; all its sizes are listed and chosen on the product page. */
function ProductCard({ group }: { group: ProductGroup }) {
  const { name, variants } = group;
  const inStock = variants.filter((v) => v.stock > 0);
  const photo = variants.find((v) => v.images.length > 0) ?? variants[0];
  const prices = (inStock.length ? inStock : variants).map((v) => v.price);
  const from = Math.min(...prices);
  const priceLabel = Math.max(...prices) > from ? `From ${formatPrice(from)}` : formatPrice(from);
  const target = inStock[0] ?? variants[0];

  return (
    // Column widths for a 1.25rem gap: 2 columns on phones, 3 on tablets, 4 on large screens.
    <li
      data-reveal
      className="w-[calc((100%_-_1.25rem)/2)] md:w-[calc((100%_-_2.5rem)/3)] lg:w-[calc((100%_-_3.75rem)/4)]"
    >
      <Link href={`/products/${encodeURIComponent(target.id)}`} className="group block">
        <div className="relative aspect-3/4 overflow-hidden border border-line bg-card">
          <ProductImage product={photo} className="transition duration-700 group-hover:scale-105" />
          {/* Second photo fades in on hover/focus */}
          {photo.images[1] && (
            // eslint-disable-next-line @next/next/no-img-element -- Sheet-provided URL
            <img
              src={photo.images[1]}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </div>
        <h3 className="font-display mt-4 text-xl">{name}</h3>
        <p className="text-sm text-muted">{variants.map((v) => v.size).join(" · ")}</p>
        <p className="mt-1 text-sm">
          {inStock.length > 0 ? priceLabel : <span className="text-muted">Out of stock</span>}
        </p>
      </Link>
    </li>
  );
}
