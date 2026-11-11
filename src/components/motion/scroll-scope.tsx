"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Wrap a page (server-rendered children are fine) to enable scroll animations:
 *   data-hero-in    elements fade/slide in once on load, in DOM order
 *   data-hero       the hero section
 *   data-hero-text  hero copy that drifts up and fades while scrolling past the hero
 *   data-reveal     elements that fade up as they enter the viewport (batched, staggered)
 *   #about          inside it: [data-word] rise one by one, [data-draw] SVG lines draw themselves,
 *                   [data-spin] turns with the scroll
 * (The 3D bottle's flight between the hero and About slots is driven by the scene itself.)
 * Everything is skipped when the visitor prefers reduced motion.
 */
export function ScrollScope({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      // ?motion=off in the address bar skips every scroll animation (static page, handy for testing).
      if (new URLSearchParams(window.location.search).get("motion") === "off") return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Intro
        const intro = el.querySelectorAll("[data-hero-in]");
        // The home page has a loader on top (components/motion/splash.tsx): the intro waits until it lifts.
        let stopWaiting: (() => void) | undefined;
        if (intro.length) {
          const loader = document.getElementById("splash");
          const waiting = !!loader && loader.dataset.phase === "show";
          const tween = gsap.from(intro, {
            autoAlpha: 0,
            y: 28,
            duration: 1,
            stagger: 0.14,
            ease: "power3.out",
            delay: waiting ? 0.3 : 0.1,
            paused: waiting,
          });
          if (waiting) {
            const go = () => tween.play();
            window.addEventListener("splash-done", go, { once: true });
            stopWaiting = () => window.removeEventListener("splash-done", go);
          }
        }

        // Hero copy drifts up and fades as you scroll away
        const hero = el.querySelector<HTMLElement>("[data-hero]");
        const heroText = hero?.querySelector("[data-hero-text]");
        if (hero && heroText) {
          gsap.to(heroText, {
            yPercent: -18,
            autoAlpha: 0.15,
            ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
          });
        }

        // About: title words rise, frame lines draw, the badge turns with the scroll
        const about = el.querySelector<HTMLElement>("#about");
        if (about) {
          const words = about.querySelectorAll("[data-word]");
          if (words.length) {
            gsap.set(words, { yPercent: 115 });
            ScrollTrigger.create({
              trigger: about,
              start: "top 62%",
              once: true,
              onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.08 }),
            });
          }
          const draws = about.querySelectorAll("[data-draw]");
          if (draws.length) {
            gsap.set(draws, { strokeDashoffset: 1 });
            ScrollTrigger.create({
              trigger: about,
              start: "top 55%",
              once: true,
              onEnter: () => gsap.to(draws, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", stagger: 0.15 }),
            });
          }
          const spin = about.querySelector("[data-spin]");
          if (spin) {
            gsap.to(spin, {
              rotation: 360,
              ease: "none",
              scrollTrigger: { trigger: about, start: "top bottom", end: "bottom top", scrub: 0.6 },
            });
          }
        }

        // Reveal on scroll
        const items = gsap.utils.toArray<HTMLElement>(el.querySelectorAll("[data-reveal]"));
        if (items.length) {
          gsap.set(items, { autoAlpha: 0, y: 40 });
          ScrollTrigger.batch(items, {
            start: "top 90%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power3.out", overwrite: true }),
          });
        }

        return () => stopWaiting?.();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
