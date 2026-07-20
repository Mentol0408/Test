import { Inter, JetBrains_Mono } from "next/font/google";

/* Single Inter instance (all weights). --font-rw-display is aliased to it in v2.css. */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-rw-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
  variable: "--font-rw-mono",
  display: "swap",
});

export const rwFontVars = `${inter.variable} ${mono.variable}`;
