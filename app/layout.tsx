import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrashantVerse | Trading terminal",
  description: "PrashantVerse intraday crypto terminal: $100,000 virtual account, ten live markets, and a $500 daily loss trigger.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
