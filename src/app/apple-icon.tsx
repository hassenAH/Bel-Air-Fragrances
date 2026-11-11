import { ImageResponse } from "next/og";

// The icon iPhones use for "Add to Home Screen", also used as the logo in search results.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1c1917", position: "relative" }}>
        <div style={{ position: "absolute", left: 74, top: 22, width: 32, height: 24, background: "#f0e6d4", borderRadius: 6 }} />
        <div style={{ position: "absolute", left: 82, top: 46, width: 16, height: 16, background: "#a8895a" }} />
        <div style={{ position: "absolute", left: 40, top: 64, width: 100, height: 96, background: "#a8895a", borderRadius: 22 }} />
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 90,
            width: 60,
            height: 40,
            border: "5px solid #1c1917",
            borderRadius: 6,
          }}
        />
      </div>
    ),
    size,
  );
}
