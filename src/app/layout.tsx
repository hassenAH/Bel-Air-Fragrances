import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { CartLink } from "@/components/cart-link";
import { BRAND, TAGLINE } from "@/lib/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: `${BRAND} — Perfume`, template: `%s — ${BRAND}` },
  description: TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
            <Link
              href="/"
              className="font-display pr-3 text-lg leading-tight font-medium tracking-[0.12em] uppercase sm:text-2xl sm:tracking-[0.2em]"
            >
              {BRAND}
            </Link>
            <div className="flex items-center gap-8">
              <nav aria-label="Main" className="hidden items-center gap-6 text-sm tracking-wide uppercase md:flex">
                <Link href="/#collection" className="hover:text-accent-dark">
                  Shop
                </Link>
                <Link href="/#about" className="hover:text-accent-dark">
                  About
                </Link>
              </nav>
              <CartLink />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-8 text-center text-sm text-muted">
          <p>
            © {BRAND}. Cash on delivery — you pay when your parcel arrives.
          </p>
        </footer>
      </body>
    </html>
  );
}
