"use client";

/* =====================================================================
   FeaturesBento — "Кастомные плагины и ивенты"
   A real bento: the hero tile (Битва деревень) owns a 2x2 block, a tall
   tile owns the right column, and three tiles line the bottom row. Each is
   an image tile with hover zoom, gradient legibility overlay and accent line.
   ===================================================================== */

import { PLUGINS, type PluginFeature } from "@/v2/lib/content";
import { Section, SectionHeading, Badge } from "../ui";
import { Reveal } from "../motion";
import { Icon } from "../icons";

/* Explicit lg grid placement for a balanced 3x3 bento. */
const AREA: Record<string, string> = {
  "cases": "lg:col-[1/3] lg:row-[1/3]",
  "drone-market": "lg:col-[3/4] lg:row-[1/3]",
  "random-research": "lg:col-[1/2] lg:row-[3/4]",
  "leaderboard": "lg:col-[2/3] lg:row-[3/4]",
  "battle-villages": "lg:col-[3/4] lg:row-[3/4]",
};

function serverTone(name: string): "chill" | "hard" | "vanilla" | "default" {
  const n = name.toLowerCase();
  if (n === "chill") return "chill";
  if (n === "hard") return "hard";
  if (n === "vanilla") return "vanilla";
  return "default";
}

function BentoTile({ item }: { item: PluginFeature }) {
  const big = item.size === "lg";
  return (
    <article
      className={`group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl border border-[var(--rw-line)] ${AREA[item.id] ?? ""} ${big ? "sm:col-span-2 lg:min-h-0" : ""}`}
    >
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.image}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
      />
      {/* Legibility + brand overlays */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/10 transition-opacity duration-500 group-hover:from-black/85" />
      <div aria-hidden className="rw-noise absolute inset-0 opacity-[0.05]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(90% 80% at 50% 100%, rgba(255,106,26,0.22), transparent 60%)" }}
      />

      {/* Icon chip */}
      <span className="absolute left-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-[var(--rw-amber)] backdrop-blur-md">
        <Icon name={item.icon} size={19} />
      </span>

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {item.servers.map((s) => (
            <Badge key={s} tone={serverTone(s)}>
              {s}
            </Badge>
          ))}
        </div>
        <h3 className={`rw-display mt-3 font-semibold uppercase leading-tight tracking-tight text-[var(--rw-text)] ${big ? "text-3xl sm:text-4xl" : "text-xl"}`}>
          {item.title}
        </h3>
        <p className={`mt-2 text-pretty leading-relaxed text-[var(--rw-muted)] ${big ? "max-w-md text-sm sm:text-base" : "text-sm line-clamp-3"}`}>
          {item.subtitle}
        </p>
        {/* Accent line slides in on hover */}
        <span aria-hidden className="mt-4 block h-px w-10 origin-left scale-x-100 bg-[image:var(--rw-grad)] transition-all duration-500 group-hover:w-20" />
      </div>
    </article>
  );
}

export function FeaturesBento() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Уникальные механики"
        title={
          <>
            Кастомные плагины и <span className="rw-gradient-text">ивенты</span>
          </>
        }
        description="Мы заменили стандартные решения на собственные — каждый аспект игры глубже, честнее и увлекательнее."
      />
      <Reveal delay={0.1}>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:grid-rows-3 lg:min-h-[680px]">
          {PLUGINS.map((item) => (
            <BentoTile key={item.id} item={item} />
          ))}
        </div>
      </Reveal>
    </Section>
  );
}
