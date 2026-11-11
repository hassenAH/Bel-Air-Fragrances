import { ImageResponse } from "next/og";
import { BRAND, TAGLINE } from "@/lib/config";

// The card shown when a link to the shop is shared (WhatsApp, Facebook, iMessage, X...).
// Flat colours only. Put your own picture in the Settings tab (seo_image) to replace it.
export const alt = `${BRAND} — perfume`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#f0e6d4",
          color: "#1c1917",
          padding: "0 90px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 700 }}>
          <div style={{ fontSize: 26, letterSpacing: 10, color: "#8a6f45", textTransform: "uppercase" }}>Eau de parfum</div>
          <div style={{ fontSize: 88, lineHeight: 1.05, marginTop: 24, fontFamily: "serif" }}>{BRAND}</div>
          <div style={{ fontSize: 32, marginTop: 28, color: "#57534e", lineHeight: 1.35 }}>{TAGLINE}</div>
          <div style={{ display: "flex", marginTop: 44 }}>
            <div style={{ background: "#1c1917", color: "#faf7f2", fontSize: 24, letterSpacing: 5, padding: "16px 30px", textTransform: "uppercase" }}>
              Pay on delivery
            </div>
          </div>
        </div>

        {/* flat bottle */}
        <div style={{ position: "absolute", right: 130, top: 90, width: 280, height: 450, display: "flex" }}>
          <div style={{ position: "absolute", left: 100, top: 0, width: 80, height: 60, background: "#1c1917", borderRadius: 8 }} />
          <div style={{ position: "absolute", left: 120, top: 60, width: 40, height: 40, background: "#a8895a" }} />
          <div style={{ position: "absolute", left: 0, top: 100, width: 280, height: 350, background: "#a8895a", borderRadius: 44 }} />
          <div
            style={{
              position: "absolute",
              left: 55,
              top: 200,
              width: 170,
              height: 130,
              border: "6px solid #f0e6d4",
              borderRadius: 8,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
