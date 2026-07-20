import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./v2/v2.css";
import { rwFontVars } from "./v2/fonts";

const TikTokSans = Inter({
  variable: "--font-tiktok-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || "https://rust-way.ru"),
  title: "RUST WAY — Комплекс премиальных Rust-серверов",
  description: "Rust Way — комплекс премиальных игровых серверов: кастомные плагины, честная экономика и реальные Steam-скины.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#070709",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`rw-root ${rwFontVars} ${TikTokSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
