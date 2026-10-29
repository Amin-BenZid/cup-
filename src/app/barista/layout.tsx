import type { Metadata } from "next";

// Staff screens install as their own app that opens straight on the dashboard
// (the root manifest opens the public home page).
export const metadata: Metadata = {
  manifest: "/barista/manifest.webmanifest",
};

export default function BaristaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
