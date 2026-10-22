import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FindIt — Campus Lost & Found",
  description: "Find what’s missing or help someone get it back. A lost and found platform for your campus community.",
};

export const viewport: Viewport = {
  themeColor: "#10254A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
