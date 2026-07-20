import type { Metadata } from "next";
import { HomeV2 } from "./v2/Home";

export const metadata: Metadata = {
  title: "RUST WAY — Комплекс премиальных Rust-серверов",
  description:
    "RUST WAY — не просто Rust-сервер. Кастомные плагины, честная экономика, еженедельные ивенты с призовым фондом 10 000 ₽ и реальные Steam-скины. Chill x2, Hard хардкор и Vanilla. Играй сейчас.",
  keywords: ["Rust", "Rust сервер", "Rust Way", "Chill", "Hard", "Vanilla", "вайп", "кейсы", "скины"],
  openGraph: {
    title: "RUST WAY — Комплекс премиальных Rust-серверов",
    description:
      "Кастомные плагины, честная экономика, ивенты с призовым фондом и реальные Steam-скины. Выбери свой стиль игры.",
    type: "website",
    locale: "ru_RU",
    siteName: "RUST WAY",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "RUST WAY" }],
  },
  twitter: { card: "summary_large_image", title: "RUST WAY", description: "Комплекс премиальных Rust-серверов." },
};

export default function Home() {
  return <HomeV2 />;
}
