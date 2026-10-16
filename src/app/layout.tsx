import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import ClientOnly from "@/components/ClientOnly";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Cup",
    template: "%s · Cup",
  },
  description:
    "Your coffee, ready when you are. Turn any phone into a café pager — no hardware.",
  applicationName: "Cup",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Cup",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.webmanifest',

};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ibmArabic.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
