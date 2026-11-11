"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BRAND, HERO_BG } from "@/lib/config";
import { Splash } from "./splash";

// Three.js is large: load it only in the browser, only on the page that needs it.
const BottleScene = dynamic(() => import("./bottle-scene"), { ssr: false });

const StageContext = createContext({ enabled: false, ready: false });

let webglSupport: boolean | undefined;
const noopSubscribe = () => () => {};
function supportsWebGL() {
  if (webglSupport === undefined) {
    try {
      const c = document.createElement("canvas");
      webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * Wraps the hero and the About section. A single full-screen 3D canvas sticks behind them (the page
 * text sits on top) and the bottle flies between the two <BottleSlot>s while you scroll.
 * Without WebGL, or with "reduce motion", no canvas is created and the slots show a flat illustration.
 */
export function BottleStage({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const webgl = useSyncExternalStore(noopSubscribe, supportsWebGL, () => false);
  const reduced = useReducedMotion();
  // ?3d=off in the address bar switches the 3D bottle off (flat illustrations only).
  const forcedOff = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("3d") === "off",
    () => false,
  );
  const enabled = webgl && !reduced && !forcedOff;
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const handleReady = useCallback(() => setReady(true), []);

  // Pause rendering while the whole stage is scrolled out of view (saves battery).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <StageContext.Provider value={{ enabled, ready }}>
      {/* Covers the page until the 3D bottle is ready (see splash.tsx). */}
      <Splash enabled={enabled} ready={ready} />
      {/* No overflow-hidden here: it would break the sticky canvas. */}
      <div ref={root} className="relative" style={{ background: HERO_BG }}>
        {enabled && (
          // A layer exactly as tall as the stage, with a one-screen-tall sticky canvas inside it. The canvas
          // can never leave this layer, so it cannot hang over the sections below (the page text sits on top).
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div className="sticky top-0 h-lvh w-full">
              <BottleScene brand={BRAND} active={visible} onReady={handleReady} stageRef={root} />
            </div>
          </div>
        )}
        <div className="relative z-10">{children}</div>
      </div>
    </StageContext.Provider>
  );
}

/**
 * An empty box the 3D bottle is placed into. `fallback` (a flat illustration or photo) is what shows
 * when 3D is unavailable, and until the model has loaded.
 */
export function BottleSlot({
  name,
  className,
  fallback,
}: {
  name: "hero" | "about";
  className: string;
  fallback: React.ReactNode;
}) {
  const { enabled, ready } = useContext(StageContext);
  return (
    <div data-bottle-slot={name} className={className}>
      <div className={`absolute inset-0 transition-opacity duration-700 ${enabled && ready ? "opacity-0" : "opacity-100"}`}>
        {fallback}
      </div>
    </div>
  );
}
