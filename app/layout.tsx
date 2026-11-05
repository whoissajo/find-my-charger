import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lahore EV Finder — Find your next charge",
  description:
    "Explore publicly mapped electric vehicle charging stations across Lahore. Search AC and DC chargers, check mapped connector details, get directions and export GeoJSON for RustGIS.",
  applicationName: "Lahore EV Finder",
  openGraph: {
    title: "Lahore EV Finder",
    description: "A clearer way to find your next charge in Lahore.",
    type: "website",
    locale: "en_PK",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07110f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
