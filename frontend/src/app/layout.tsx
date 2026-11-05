import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#090b10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://twoolkit.vercel.app"),
  title: "TWOOLKIT — All-in-One File Management, Scanning & Conversion",
  description:
    "An enterprise-grade, all-in-one file management platform combining document scanning, storage management, PDF utilities, image studio, file compression, and batch processing.",
  applicationName: "TwoolKit",
  alternates: {
    canonical: "https://twoolkit.vercel.app/",
  },
  openGraph: {
    title: "TWOOLKIT — All-in-One File Management, Scanning & Conversion",
    description:
      "An enterprise-grade, all-in-one file management platform combining document scanning, storage management, PDF utilities, image studio, file compression, and batch processing.",
    url: "https://twoolkit.vercel.app/",
    siteName: "TwoolKit",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://twoolkit.vercel.app/og-image.png",
        secureUrl: "https://twoolkit.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "TwoolKit — Official Logo & All-in-One File Intelligence Platform",
        type: "image/png",
      },
      {
        url: "https://twoolkit.vercel.app/og-logo-square.png",
        secureUrl: "https://twoolkit.vercel.app/og-logo-square.png",
        width: 512,
        height: 512,
        alt: "TwoolKit Official T-Nexus Logo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TWOOLKIT — All-in-One File Management, Scanning & Conversion",
    description:
      "An enterprise-grade, all-in-one file management platform combining document scanning, storage management, PDF utilities, image studio, file compression, and batch processing.",
    images: ["https://twoolkit.vercel.app/og-image.png"],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden text-slate-100 bg-[#090b10]`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
