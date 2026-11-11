import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center">
      <p className="font-display text-7xl text-accent">404</p>
      <h1 className="font-display mt-4 text-4xl">This page is not here</h1>
      <p className="mt-3 text-muted">The fragrance you are looking for may have sold out, or the link is old.</p>
      <Link
        href="/#collection"
        className="group mt-8 inline-flex items-center gap-3 bg-foreground px-8 py-4 text-sm tracking-widest text-background uppercase transition hover:bg-accent-dark"
      >
        See the collection <ArrowRight size={18} weight="bold" className="transition group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
  );
}
