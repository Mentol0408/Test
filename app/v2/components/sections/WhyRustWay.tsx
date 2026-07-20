"use client";

/* =====================================================================
   WhyRustWay — "Почему стоит играть у нас"
   Premium reasons grid: staggered glass cards with hover lift, brightening
   hairline, molten corner glow, animated accent line and index numbers.
   ===================================================================== */

import { REASONS } from "@/v2/lib/content";
import { Section, SectionHeading } from "../ui";
import { Stagger, StaggerItem } from "../motion";
import { Icon } from "../icons";

export function WhyRustWay() {
  return (
    <Section id="advantages">
      <SectionHeading
        eyebrow="Почему мы"
        title={
          <>
            Почему стоит <span className="rw-gradient-text">играть у нас</span>
          </>
        }
        description="Продуманные системы и плагины делают игру глубже, честнее и интереснее — а не богаче ради доната."
      />

      <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:mt-16">
        {REASONS.map((r, i) => (
          <StaggerItem key={r.id} className="group h-full">
            <article
              className="relative flex h-full flex-col overflow-hidden rounded-2xl rw-glass rw-topline p-7 transition-all duration-500 ease-out hover:-translate-y-1 hover:border-[var(--rw-line-3)] hover:shadow-[0_24px_70px_-24px_rgba(255,106,26,0.5)]"
            >
              {/* Molten corner glow revealed on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(255,106,26,0.28),transparent_68%)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              />

              {/* Index number */}
              <span className="rw-mono absolute right-6 top-6 text-xs tracking-[0.22em] text-[var(--rw-faint)] transition-colors duration-500 group-hover:text-[var(--rw-orange-2)]">
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Icon tile */}
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--rw-orange)]/25 bg-[var(--rw-orange)]/10 text-[var(--rw-amber)] transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-[var(--rw-orange)]/50 group-hover:bg-[var(--rw-orange)]/[0.16]">
                <Icon name={r.icon} size={22} />
              </div>

              {/* Title */}
              <h3 className="rw-display mt-6 text-xl font-semibold uppercase tracking-wide text-[var(--rw-text)]">
                {r.title}
              </h3>

              {/* Accent line — grows on hover */}
              <span
                aria-hidden
                className="mt-3 block h-px w-8 rounded-full bg-gradient-to-r from-[var(--rw-orange)] to-[var(--rw-ember)] transition-all duration-500 ease-out group-hover:w-16"
              />

              {/* Body */}
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--rw-muted)]">
                {r.text}
              </p>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
