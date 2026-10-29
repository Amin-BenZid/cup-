import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      id: "/barista/dashboard",
      name: "Beep · Staff",
      short_name: "Beep",
      description: "Your orders, ready when you are.",
      start_url: "/barista/dashboard",
      scope: "/",
      display: "standalone",
      orientation: "any",
      background_color: "#faf7f2",
      theme_color: "#1d1916",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
