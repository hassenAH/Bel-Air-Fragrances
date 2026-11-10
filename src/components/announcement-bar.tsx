import { Money, PhoneCall, Star, Truck } from "@phosphor-icons/react/dist/ssr";
import { getCatalog } from "@/lib/catalog";
import { formatPrice } from "@/lib/config";

/**
 * A dark ticker above the header with the reasons to order. Every line is true for this shop and comes
 * from your Sheet (free-delivery threshold, Google rating); nothing is made up. With "reduce motion" it stops
 * scrolling and just shows the line once, centred.
 */
export async function AnnouncementBar() {
  const { settings, content } = await getCatalog();

  const items = [
    {
      Icon: Truck,
      text: settings.freeDeliveryOver > 0 ? `Free delivery over ${formatPrice(settings.freeDeliveryOver)}` : "Delivery to your door",
    },
    { Icon: Money, text: "Pay in cash on delivery" },
    { Icon: PhoneCall, text: "We call to confirm every order" },
    ...(content.googleRating !== null
      ? [
          {
            Icon: Star,
            text: `${content.googleRating.toFixed(1)} on Google${content.googleReviewsCount ? ` · ${content.googleReviewsCount} reviews` : ""}`,
          },
        ]
      : []),
  ];

  const row = (copy: boolean) => (
    <ul
      aria-hidden={copy || undefined}
      className={`flex shrink-0 items-center gap-12 pr-12 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-8 motion-reduce:gap-y-1 motion-reduce:pr-0 ${
        copy ? "motion-reduce:hidden" : ""
      }`}
    >
      {items.map(({ Icon, text }) => (
        <li key={text} className="flex items-center gap-2 whitespace-nowrap">
          <Icon size={16} weight="fill" className="text-accent" aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );

  return (
    <div role="region" aria-label="Store information" className="overflow-hidden bg-foreground py-2.5 text-xs tracking-[0.18em] text-background uppercase">
      <div className="marquee flex w-max motion-reduce:w-full">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
