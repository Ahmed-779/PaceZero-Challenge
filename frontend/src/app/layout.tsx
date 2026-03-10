import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PaceZero — LP Scoring Engine",
  description:
    "LP Prospect Enrichment & Scoring Engine for PaceZero Capital Partners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b bg-white sticky top-0 z-50">
          <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              <span className="text-emerald-700">Pace</span>
              <span className="text-gray-900">Zero</span>
            </Link>
            <div className="flex gap-6 text-sm font-medium text-gray-600">
              <Link
                href="/"
                className="hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/prospects"
                className="hover:text-gray-900 transition-colors"
              >
                Prospects
              </Link>
              <Link
                href="/upload"
                className="hover:text-gray-900 transition-colors"
              >
                Upload
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-screen-xl mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
