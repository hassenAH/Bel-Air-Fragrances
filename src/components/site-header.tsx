import Link from "next/link";
import { AnnouncementBar } from "@/components/announcement-bar";
import { CartLink } from "@/components/cart-link";
import { MobileMenu, type MenuLink } from "@/components/mobile-menu";
import { getCatalog } from "@/lib/catalog";
import { BRAND } from "@/lib/config";

/** Ticker + sticky header. Links to sections that are empty (e.g. no reviews yet) are left out. */
export async function SiteHeader() {
  const { content, testimonials } = await getCatalog();
  const hasReviews = testimonials.length > 0 || !!content.reviewsSummary || content.googleRating !== null;

  const links: MenuLink[] = [
    { href: "/#collection", label: "Shop", icon: "shop" },
    { href: "/#about", label: "About", icon: "about" },
    ...(hasReviews ? [{ href: "/#reviews", label: "Reviews", icon: "reviews" } as MenuLink] : []),
  ];

  return (
    <>
      <AnnouncementBar />
      {/* Solid background on purpose: a blur/filter here would trap the fixed mobile menu inside the header's box. */}
      <header className="sticky top-0 z-40 border-b border-line bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/"
            className="font-display min-w-0 text-base leading-tight font-medium tracking-[0.1em] uppercase sm:text-2xl sm:tracking-[0.2em]"
          >
            {BRAND}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <nav aria-label="Main" className="mr-4 hidden items-center gap-8 text-sm tracking-wide uppercase md:flex">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="relative py-1 transition hover:text-accent-dark">
                  {l.label}
                </Link>
              ))}
            </nav>
            <CartLink />
            <MobileMenu links={links} brand={BRAND} />
          </div>
        </div>
      </header>
    </>
  );
}
