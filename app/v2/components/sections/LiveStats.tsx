"use client";

import { cn } from "@/v2/lib/cn";
import { LIVE_STATS } from "@/v2/lib/content";
import { Section, Container, SectionHeading } from "../ui";
import { Reveal, Stagger, StaggerItem, CountUp } from "../motion";
import { Icon } from "../icons";

export function LiveStats() {
  return (
    <Section id="stats" bare className="relative overflow-hidden py-20 sm:py-28 lg:py-36 scroll-mt-24">
      {/* ---- Atmospheric background layers ---- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="rw-grid absolute inset-0" />
        <div className="rw-spot absolute inset-x-0 top-1/4 h-[420px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--rw-bg)] to-transparent" />
      </div>

      <Container className="relative">
        <SectionHeading
          align="center"
          eyebrow="В цифрах"
          title={
            <>
              Rust Way в <span className="rw-gradient-text">реальном времени</span>
            </>
          }
          description="Живое комьюнити, честная экономика и тысячи сражений каждую неделю."
        />

        {/* Top divider line */}
        <Reveal delay={0.12}>
          <div className="mx-auto mt-14 h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-[var(--rw-line-2)] to-transparent" />
        </Reveal>

        {/* ---- Stat tiles ---- */}
        <Stagger className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {LIVE_STATS.map((s, i) => {
            const featured = i === 0; // "Игроков онлайн" — live tile
            const gradient = featured || s.value >= 100000; // hero the largest numbers

            return (
              <StaggerItem key={s.label} className="h-full">
                <div
                  className={cn(
                    "group relative flex h-full flex-col overflow-hidden rounded-2xl rw-glass rw-topline p-6 transition-all duration-500 hover:-translate-y-1",
                    featured
                      ? "border-emerald-400/25 hover:border-emerald-400/45"
                      : "hover:border-[var(--rw-orange)]/40",
                  )}
                >
                  {/* Hover glow */}
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                      featured
                        ? "bg-[radial-gradient(120%_90%_at_50%_0%,rgba(74,222,128,0.12),transparent_60%)]"
                        : "bg-[radial-gradient(120%_90%_at_50%_0%,rgba(255,106,26,0.14),transparent_60%)]",
                    )}
                  />

                  {/* Top row: icon square + live badge */}
                  <div className="relative flex items-start justify-between">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105",
                        featured
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                          : "border-[var(--rw-orange)]/15 bg-[var(--rw-orange)]/10 text-[var(--rw-amber)]",
                      )}
                    >
                      <Icon name={s.icon} size={22} />
                    </span>

                    {featured ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-2.5 py-1">
                        <span className="rw-live-dot h-1.5 w-1.5" />
                        <span className="rw-mono text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300">
                          Live
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Number — the hero */}
                  <div className="relative mt-8 flex flex-col">
                    <CountUp
                      to={s.value}
                      suffix={s.suffix ?? ""}
                      className={cn(
                        "rw-display text-4xl font-semibold leading-none tracking-tight tabular-nums lg:text-5xl",
                        gradient ? "rw-gradient-text" : "text-[var(--rw-text)]",
                      )}
                    />
                    <span className="mt-3 text-sm leading-snug text-[var(--rw-faint)]">
                      {s.label}
                    </span>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </Section>
  );
}
