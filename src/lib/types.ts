/** A product as the Sheet returns it: `image` may hold several links separated by ; or | */
export type RawProduct = {
  id: string;
  name: string;
  price: number;
  size: string;
  stock: number;
  image: string;
  description: string;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
};

export type Product = Omit<RawProduct, "image"> & {
  /** First image (cards, cart). Empty string when the product has none. */
  image: string;
  /** All images, in Sheet order. */
  images: string[];
};

export type Testimonial = {
  name: string;
  /** 0 = no stars shown, otherwise 1-5. */
  rating: number;
  text: string;
};

/** Home page texts, already cleaned (see lib/content.ts). Empty values mean "not set". */
export type SiteContent = {
  aboutTitle: string;
  aboutParagraphs: string[];
  aboutImage: string;
  reviewsTitle: string;
  /** The "Résumé des avis" text copied from Google Maps. */
  reviewsSummary: string;
  googleRating: number | null;
  googleReviewsCount: number | null;
  googleMapsUrl: string;
  /** Search / share texts (blank = built from the brand and tagline). */
  seoTitle: string;
  seoDescription: string;
  /** Picture shown when the link is shared (blank = the generated card). */
  seoImage: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  /** Shown to Google as the shop's phone number. */
  phone: string;
};

/** What the Apps Script returns: `content` is the raw Settings key -> text map. */
export type RawCatalog = {
  products: RawProduct[];
  settings: Settings;
  content?: Record<string, string>;
  testimonials?: unknown;
};

export type Settings = {
  deliveryFee: number;
  freeDeliveryOver: number;
};

export type Catalog = {
  products: Product[];
  settings: Settings;
  content: SiteContent;
  testimonials: Testimonial[];
  /** True when no Sheet is connected: sample content is shown. */
  demo: boolean;
};

export type OrderRequest = {
  items: { id: string; qty: number }[];
  /** Optional one-time coupon code (validated again by the Sheet when the order is placed). */
  coupon?: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    notes: string;
  };
};
