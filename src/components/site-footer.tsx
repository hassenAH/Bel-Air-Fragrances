import Link from "next/link";
import { MapPin, Money, PhoneCall, Truck } from "@phosphor-icons/react/dist/ssr";
import { getCatalog } from "@/lib/catalog";
import { BRAND, TAGLINE, formatPrice } from "@/lib/config";

/** Dark footer: quick links, the order promises, and a Google Maps link when the Sheet has one. */
export async function SiteFooter() {
  const { settings, content, testimonials } = await getCatalog();
  const hasReviews = testimonials.length > 0 || !!content.reviewsSummary || content.googleRating !== null;

  const links = [
    { href: "/#collection", label: "Shop" },
    { href: "/#about", label: "About us" },
    ...(hasReviews ? [{ href: "/#reviews", label: "Reviews" }] : []),
    { href: "/cart", label: "Your cart" },
  ];

  const promises = [
    { Icon: Money, text: "Pay in cash when your parcel arrives" },
    { Icon: PhoneCall, text: "We call you to confirm every order" },
    {
      Icon: Truck,
      text: settings.freeDeliveryOver > 0 ? `Free delivery over ${formatPrice(settings.freeDeliveryOver)}` : "Delivery to your door",
    },
  ];

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl tracking-[0.2em] uppercase">{BRAND}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-background/70">{TAGLINE}</p>
          {content.googleMapsUrl && (
            <a
              href={content.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm text-accent underline-offset-4 hover:underline"
            >
              <MapPin size={20} weight="fill" aria-hidden /> Find us on Google Maps
            </a>
          )}
        </div>

        <nav aria-label="Footer">
          <p className="mb-4 text-xs tracking-[0.3em] text-accent uppercase">Explore</p>
          <ul className="space-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-background/80 transition hover:text-background">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-4 text-xs tracking-[0.3em] text-accent uppercase">Ordering with us</p>
          <ul className="space-y-3">
            {promises.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-background/80">
                <Icon size={22} weight="duotone" className="mt-px shrink-0 text-accent" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-background/15 py-5 text-center text-xs text-background/60">
        © {BRAND}. All rights reserved.
      </div>
    </footer>
  );
}
