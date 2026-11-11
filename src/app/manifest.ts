import type { MetadataRoute } from "next";
import { BRAND, HERO_BG, TAGLINE } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND,
    short_name: BRAND.length > 14 ? BRAND.split(/\s+/).slice(0, 2).join(" ") : BRAND,
    description: TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: HERO_BG,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
