import { BottleSvg } from "@/components/bottle";
import { BottleSlot } from "@/components/motion/bottle-stage";
import { BRAND } from "@/lib/config";
import { DEFAULT_ABOUT } from "@/lib/content";
import type { SiteContent, Testimonial } from "@/lib/types";

/** Gold stars with a fractional fill (4.8 shows almost five full stars). */
function Stars({ value, className = "" }: { value: number; className?: string }) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className={`relative inline-block leading-none ${className}`}>
      <span aria-hidden className="text-line">
        ★★★★★
      </span>
      <span aria-hidden className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-accent" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

/** The four gold corner brackets around the frame. They draw themselves on scroll (data-draw). */
const CORNERS = [
  { place: "-top-3 -left-3", d: "M2 42 V2 H42" },
  { place: "-top-3 -right-3", d: "M2 2 H42 V42" },
  { place: "-bottom-3 -left-3", d: "M2 2 V42 H42" },
  { place: "-bottom-3 -right-3", d: "M42 2 V42 H2" },
];

/**
 * About us. The framed box on the left is an empty "slot": the 3D bottle from the hero flies down
 * and lands in it while you scroll (see motion/bottle-scene.tsx). Without 3D it shows your photo
 * (about_image) or a flat bottle illustration instead.
 */
export function AboutSection({ content }: { content: SiteContent }) {
  const title = content.aboutTitle || DEFAULT_ABOUT.title;
  const paragraphs = content.aboutParagraphs.length ? content.aboutParagraphs : DEFAULT_ABOUT.paragraphs;

  const fallback = content.aboutImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- Sheet-provided URL
    <img src={content.aboutImage} alt={`About ${BRAND}`} loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center border border-line bg-linear-to-b from-[#f1e9dc] to-[#e4d6bd]">
      <BottleSvg label={`${BRAND} perfume bottle`} />
    </div>
  );

  return (
    <section id="about" className="relative scroll-mt-4 border-b border-line">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 py-24 md:grid-cols-2 md:gap-20 md:py-32">
        {/* The frame. No background: the 3D canvas behind the page shows through. */}
        <div className="relative mx-auto w-full max-w-[420px] md:max-w-none">
          <BottleSlot name="about" className="relative aspect-4/5 w-full" fallback={fallback} />

          {CORNERS.map((c) => (
            <svg key={c.place} aria-hidden viewBox="0 0 44 44" fill="none" className={`pointer-events-none absolute h-11 w-11 text-accent ${c.place}`}>
              <path data-draw d={c.d} pathLength={1} strokeDasharray="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          ))}

          {/* Circular badge, turns slowly as you scroll */}
          <svg
            data-spin
            aria-hidden
            viewBox="0 0 120 120"
            className="pointer-events-none absolute -right-3 -bottom-8 h-28 w-28 text-accent-dark md:-right-8 md:h-36 md:w-36"
          >
            <defs>
              <path id="about-badge-circle" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
            </defs>
            <circle cx="60" cy="60" r="58" fill="#faf7f2" stroke="currentColor" strokeOpacity="0.35" />
            <text fontSize="10.5" fill="currentColor" style={{ textTransform: "uppercase" }}>
              <textPath href="#about-badge-circle" textLength="268" lengthAdjust="spacing">
                {`${BRAND} · Eau de parfum · `}
              </textPath>
            </text>
            <circle cx="60" cy="60" r="3" fill="currentColor" />
          </svg>
        </div>

        <div>
          <p data-reveal className="mb-5 text-xs tracking-[0.35em] text-accent-dark uppercase">
            About us
          </p>
          <h2 aria-label={title} className="font-display text-5xl leading-[1.05] md:text-6xl">
            {title.split(" ").map((word, i) => (
              <span key={i} aria-hidden className="mr-[0.25em] inline-block overflow-hidden pb-[0.12em] align-bottom">
                <span data-word className="inline-block">
                  {word}
                </span>
              </span>
            ))}
          </h2>
          <div className="mt-8 space-y-4 text-lg leading-relaxed text-muted">
            {paragraphs.map((p, i) => (
              <p key={i} data-reveal>
                {p}
              </p>
            ))}
          </div>
          <a
            data-reveal
            href="#collection"
            className="mt-10 inline-flex items-center gap-3 border border-foreground px-8 py-3 text-sm tracking-widest uppercase transition hover:bg-foreground hover:text-background"
          >
            Shop the collection <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function ReviewsSection({
  content,
  testimonials,
  demo,
}: {
  content: SiteContent;
  testimonials: Testimonial[];
  demo: boolean;
}) {
  const { googleRating, googleReviewsCount, googleMapsUrl, reviewsSummary } = content;
  // Nothing real to show: hide the whole section instead of showing an empty or invented one.
  if (!testimonials.length && !reviewsSummary && googleRating === null) return null;

  return (
    <section id="reviews" className="scroll-mt-4 border-t border-line bg-white/50">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <h2 data-reveal className="font-display text-center text-4xl md:text-5xl">
          {content.reviewsTitle || "What our customers say"}
        </h2>

        {googleRating !== null && (
          <div data-reveal className="mt-8 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <span className="font-display text-5xl">{googleRating.toFixed(1)}</span>
              <Stars value={googleRating} className="text-2xl" />
            </div>
            <p className="text-sm text-muted">
              {googleReviewsCount ? `Based on ${googleReviewsCount} Google reviews` : "Rated on Google"}
            </p>
          </div>
        )}

        {reviewsSummary && (
          <figure data-reveal className="mx-auto mt-10 max-w-2xl border-y border-line py-8 text-center">
            <figcaption className="mb-3 text-xs tracking-[0.3em] text-muted uppercase">Résumé des avis · Google</figcaption>
            <blockquote className="font-display text-2xl leading-snug italic md:text-3xl">{reviewsSummary}</blockquote>
          </figure>
        )}

        {testimonials.length > 0 && (
          <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <li key={i} data-reveal>
                <figure className="flex h-full flex-col border border-line bg-card p-6">
                  {t.rating > 0 && <Stars value={t.rating} className="text-lg" />}
                  <blockquote className="mt-3 flex-1 leading-relaxed text-foreground/80">“{t.text}”</blockquote>
                  {t.name && <figcaption className="mt-4 text-sm tracking-wide text-muted">— {t.name}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        )}

        <p data-reveal className="mt-10 text-center text-sm text-muted">
          Reviews from Google Maps
          {googleMapsUrl && (
            <>
              {" · "}
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4 hover:text-accent-dark"
              >
                See all reviews
              </a>
            </>
          )}
        </p>

        {demo && (
          <p role="note" className="mx-auto mt-6 max-w-xl border border-red-300 bg-red-50 p-3 text-center text-xs text-red-800">
            Sample content (demo mode): connect your Google Sheet and add your own reviews. Nothing here is real.
          </p>
        )}
      </div>
    </section>
  );
}
