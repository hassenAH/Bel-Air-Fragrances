"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BRAND, HERO_BG } from "@/lib/config";

/** The curtain never lifts before this many ms after the page started loading (no one-frame flash). */
const MIN_MS = 900;
/** ...and always lifts by this time, even if the 3D is still loading: the flat bottle shows, the 3D joins later. */
const MAX_MS = 7000;
/** Length of the lift animation (keep in sync with `.splash` in globals.css). */
const LEAVE_MS = 900;

/** True once the loader has run during this page load: going back to the home page by a link doesn't show it again. */
let alreadyShown = false;

const noopSubscribe = () => () => {};

type Phase = "show" | "leaving" | "gone";

/**
 * Full-screen loader for the home page. It covers the page until the 3D bottle is really ready (model
 * downloaded, shaders compiled, first frames drawn), then lifts like a curtain and the hero text animates in.
 *
 * It is part of the server-rendered HTML, so the page is covered from the very first paint (no flash of
 * half-loaded content). If JavaScript never runs, a CSS timer hides it (see `.splash` in globals.css), and the
 * page text underneath is always in the HTML for search engines and screen readers.
 */
export function Splash({ enabled, ready }: { enabled: boolean; ready: boolean }) {
  const [phase, setPhase] = useState<Phase>(alreadyShown ? "gone" : "show");
  // `enabled` is only trustworthy after hydration (the server can't know about WebGL): wait for this.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Decide when to lift the curtain.
  useEffect(() => {
    if (phase !== "show" || !mounted) return;
    const skip = new URLSearchParams(window.location.search).get("splash") === "off"; // handy for testing
    // Nothing to wait for: no WebGL, "reduce motion", or 3D switched off.
    // performance.now() = time since the page started loading, so a slow load is never delayed further.
    const wait = !enabled || skip ? 0 : ready ? MIN_MS - performance.now() : MAX_MS - performance.now();
    const t = window.setTimeout(() => setPhase("leaving"), Math.max(0, wait));
    return () => window.clearTimeout(t);
  }, [phase, mounted, enabled, ready]);

  // The page behind does not scroll while the loader is up.
  useEffect(() => {
    if (phase !== "show" || !mounted) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [phase, mounted]);

  // Lifting: tell the page (hero text animates in), then remove the loader once it has slid away.
  useEffect(() => {
    if (phase !== "leaving") return;
    alreadyShown = true;
    window.dispatchEvent(new Event("splash-done"));
    const t = window.setTimeout(() => setPhase("gone"), LEAVE_MS + 100);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      id="splash"
      data-phase={phase}
      role="status"
      aria-label={`Loading ${BRAND}`}
      className="splash fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: HERO_BG }}
    >
      <div className="splash-content flex flex-col items-center">
        <svg viewBox="0 0 80 120" className="h-28 w-auto" aria-hidden>
          <defs>
            <clipPath id="splash-body">
              <rect x="12" y="26" width="56" height="88" rx="10" />
            </clipPath>
          </defs>
          <rect x="32" y="4" width="16" height="14" rx="2" fill="#1c1917" />
          <rect x="36" y="18" width="8" height="8" fill="#a8895a" />
          <rect x="12" y="26" width="56" height="88" rx="10" fill="#faf7f2" />
          {/* The "perfume" rises while the page loads. Flat colour, no gradient. */}
          <g clipPath="url(#splash-body)">
            <rect className="splash-liquid" x="12" y="26" width="56" height="88" fill="#d99632" />
          </g>
          <rect x="22" y="58" width="36" height="28" rx="2" fill="#faf7f2" stroke="#1c1917" strokeWidth="1.5" />
          <rect x="12" y="26" width="56" height="88" rx="10" fill="none" stroke="#a8895a" strokeWidth="2.5" />
        </svg>

        <p className="font-display mt-7 text-2xl tracking-[0.25em] uppercase sm:text-3xl">{BRAND}</p>
        <p className="mt-2 text-[11px] tracking-[0.35em] text-accent-dark uppercase">Preparing your fragrance</p>
        <div className="mt-6 h-px w-40 overflow-hidden bg-foreground/15" aria-hidden>
          <div className="splash-bar h-full w-1/3 bg-accent-dark" />
        </div>
      </div>
    </div>
  );
}
