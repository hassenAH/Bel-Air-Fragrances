import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CaretDoubleDown,
  FlowerLotus,
  Fire,
  Star,
  Tree,
  Wind,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { BottleSvg, ProductImage } from "@/components/bottle";
import { AboutSection, BenefitsStrip, Ornament, ReviewsSection } from "@/components/home-sections";
import { BottleSlot, BottleStage } from "@/components/motion/bottle-stage";
import { ScrollScope } from "@/components/motion/scroll-scope";
import { getCatalog } from "@/lib/catalog";
import { BRAND, TAGLINE, formatPrice } from "@/lib/config";
import { CARD_WIDTH } from "@/lib/layout";
import { groupProducts, type ProductGroup } from "@/lib/variants";

const ACTS = [
  { n: "01", Icon: Wind, title: "Top notes", text: "The first impression. Bright and volatile, it greets you in the first few minutes." },
  { n: "02", Icon: FlowerLotus, title: "Heart notes", text: "The soul of the fragrance. It blooms as the top fades and stays for hours." },
  { n: "03", Icon: Tree, title: "Base notes", text: "The lasting trail. Warm, deep and soft on skin long after you have left the room." },
];

// This page is prebuilt (the catalog is cached), so its content is already in the HTML when it arrives:
// there is nothing to "load". What does load afterwards are the photos, which show a shimmering
// skeleton until they arrive (see components/smart-image.tsx). Do not wrap these sections in <Suspense>:
// the scroll animations would then touch them before React has attached to them (hydration warning).
export default async function Home() {
  const { products, content, testimonials, demo, settings } = await getCatalog();
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

              {/* Social proof first: the real Google rating from your Sheet (shown only when you have set it). */}
              {content.googleRating !== null && (
                <a
                  data-hero-in
                  href="#reviews"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-background px-4 py-2 text-sm transition hover:border-accent"
                >
                  <Star size={18} weight="fill" className="text-accent" aria-hidden />
                  <strong>{content.googleRating.toFixed(1)}</strong>
                  <span className="text-muted">
                    on Google{content.googleReviewsCount ? ` · ${content.googleReviewsCount} reviews` : ""}
                  </span>
                </a>
              )}

              <div data-hero-in className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:justify-start">
                <a
                  href="#collection"
                  className="group inline-flex items-center gap-3 bg-foreground px-8 py-4 text-sm tracking-widest text-background uppercase transition hover:bg-accent-dark"
                >
                  Shop the collection
                  <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-1" aria-hidden />
                </a>
                <a href="#about" className="py-4 text-sm tracking-widest uppercase underline-offset-8 transition hover:text-accent-dark hover:underline">
                  Our story
                </a>
              </div>
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

          {/* "Scroll" cue: nudges down, jumps to the About section */}
          <a
            data-hero-in
            href="#about"
            aria-label="Scroll to About us"
            className="mx-auto mb-8 hidden w-fit flex-col items-center gap-1 text-[11px] tracking-[0.35em] text-muted uppercase transition hover:text-accent-dark md:flex"
          >
            Scroll
            <CaretDoubleDown size={18} weight="bold" className="nudge" aria-hidden />
          </a>
        </section>

        <AboutSection content={content} />
      </BottleStage>

      <BenefitsStrip settings={settings} content={content} />

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 data-reveal className="font-display mb-6 text-center text-4xl md:text-5xl">
          Three acts, one fragrance
        </h2>
        <Ornament />
        <div className="grid gap-6 md:grid-cols-3">
          {ACTS.map((a) => (
            <div
              key={a.n}
              data-reveal
              className="group border border-line bg-card p-8 text-center transition duration-300 hover:-translate-y-1 hover:border-accent"
            >
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f3ead9] text-accent-dark transition group-hover:bg-accent group-hover:text-background">
                <a.Icon size={34} weight="duotone" aria-hidden />
              </span>
              <p className="font-display mt-5 text-sm tracking-[0.3em] text-accent">{a.n}</p>
              <h3 className="font-display mt-1 text-3xl">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="collection" className="scroll-mt-20 border-t border-line bg-white/50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 data-reveal className="font-display mb-6 text-center text-4xl md:text-5xl">
            The collection
          </h2>
          <Ornament />
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
    <li data-reveal className={CARD_WIDTH}>
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

          {/* Stock badges: real numbers from the Sheet */}
          {inStock.length === 0 && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-foreground px-3 py-1.5 text-[11px] tracking-widest text-background uppercase">
              <XCircle size={14} weight="fill" aria-hidden /> Sold out
            </span>
          )}
          {inStock.length > 0 && inStock.some((v) => v.stock <= 5) && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-accent px-3 py-1.5 text-[11px] tracking-widest text-background uppercase">
              <Fire size={14} weight="fill" aria-hidden /> Low stock
            </span>
          )}

          {/* "View" button appears on hover/focus */}
          <span
            aria-hidden
            className="absolute right-3 bottom-3 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-background text-foreground opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
          >
            <ArrowUpRight size={20} weight="bold" />
          </span>
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
