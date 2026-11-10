"use client";

import { useState } from "react";
import { BottleSvg } from "@/components/bottle-svg";

/**
 * A photo from the Sheet with a shimmering skeleton behind it until it has loaded.
 * - The skeleton sits BEHIND the image, so if JavaScript is slow or off the photo still shows normally.
 * - A broken link (typo, deleted file) shows the bottle illustration instead of an empty box.
 */
export function SmartImage({
  src,
  alt,
  className = "",
  wrapperClassName = "relative block h-full w-full",
  hidden = false,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Replaces the default full-size wrapper (e.g. to stack images with "absolute inset-0"). */
  wrapperClassName?: string;
  hidden?: boolean;
  eager?: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  if (state === "failed") {
    return (
      <span
        aria-hidden={hidden}
        className={`${wrapperClassName} flex items-center justify-center bg-linear-to-b from-[#f1e9dc] to-[#e4d6bd]`}
      >
        <BottleSvg label={alt} />
      </span>
    );
  }

  return (
    <span aria-hidden={hidden} className={`${wrapperClassName} ${state === "loading" ? "skeleton" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- image URLs come from the Sheet and can be any host */}
      <img
        // Images that finished (or failed) before React took over never fire onLoad/onError: check once on mount.
        ref={(el) => {
          if (!el || state !== "loading" || !el.complete) return;
          setState(el.naturalWidth > 0 ? "loaded" : "failed");
        }}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        className={className}
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
      />
    </span>
  );
}
