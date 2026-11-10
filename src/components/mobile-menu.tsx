"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChatCircleText, Info, List, Storefront, X } from "@phosphor-icons/react/dist/ssr";

// Icons are chosen by name here: functions can't be passed from a server component to a client one.
const ICONS = { shop: Storefront, about: Info, reviews: ChatCircleText } as const;

export type MenuLink = { href: string; label: string; icon: keyof typeof ICONS };

/** Slide-in menu for phones (the desktop links are hidden below the md breakpoint). */
export function MobileMenu({ links, brand }: { links: MenuLink[]; brand: string }) {
  const [open, setOpen] = useState(false);

  // Escape closes it; the page behind does not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-line/70"
      >
        <List size={26} weight="bold" aria-hidden />
      </button>

      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        // inert + invisible when closed: it cannot be tabbed into or read by screen readers
        inert={!open}
        // overflow-hidden: the closed panel waits off-screen to the right, and must not widen the page
        className={`fixed inset-0 z-50 overflow-hidden transition-[visibility] duration-300 ${open ? "visible" : "invisible"}`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-foreground transition-opacity duration-300 ${open ? "opacity-50" : "opacity-0"}`}
        />
        <div
          className={`absolute top-0 right-0 flex h-full w-[84%] max-w-sm flex-col bg-background p-6 shadow-2xl transition-transform duration-300 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg tracking-[0.15em] uppercase">{brand}</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-line/70"
            >
              <X size={24} weight="bold" aria-hidden />
            </button>
          </div>

          <nav aria-label="Menu" className="mt-8 flex flex-col">
            {links.map(({ href, label, icon }) => {
              const Icon = ICONS[icon];
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between border-b border-line py-5"
                >
                  <span className="flex items-center gap-4 font-display text-3xl">
                    <Icon size={28} weight="duotone" className="text-accent" aria-hidden />
                    {label}
                  </span>
                  <ArrowRight size={20} weight="bold" className="transition group-hover:translate-x-1" aria-hidden />
                </Link>
              );
            })}
          </nav>

          <Link
            href="/cart"
            onClick={() => setOpen(false)}
            className="mt-auto inline-flex items-center justify-center gap-3 bg-foreground px-6 py-4 text-sm tracking-widest text-background uppercase"
          >
            View cart <ArrowRight size={18} weight="bold" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
