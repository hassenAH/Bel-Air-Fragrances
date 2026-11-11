import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteSchema } from "@/components/site-schema";
import { getCatalog } from "@/lib/catalog";
import { BRAND, HERO_BG, TAGLINE } from "@/lib/config";
import { DEFAULT_TITLE, IS_PUBLIC_SITE, SITE_URL, snippet } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = { themeColor: HERO_BG };

/** Site-wide defaults. Pages override what they need. The texts can be changed in the Sheet (seo_* keys). */
export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getCatalog();
  const title = content.seoTitle || DEFAULT_TITLE;
  const description = snippet(
    content.seoDescription || `${BRAND}: ${TAGLINE} Order online and pay in cash when your parcel arrives.`,
  );

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${BRAND}` },
    description,
    applicationName: BRAND,
    // Real site: indexed. Previews and local builds: kept out of Google.
    robots: IS_PUBLIC_SITE ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: BRAND,
      locale: "en_US",
      title,
      description,
      // Without seo_image in the Sheet, the generated card (app/opengraph-image.tsx) is used.
      ...(content.seoImage ? { images: [content.seoImage] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(content.seoImage ? { images: [content.seoImage] } : {}) },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
        : undefined,
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full scroll-smooth antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteSchema />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
