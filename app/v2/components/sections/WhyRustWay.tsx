"use client";

/* =====================================================================
   WhyRustWay — "Почему стоит играть у нас"
   Premium image cards: cinematic art on top, eyebrow + title + body and a
   "Подробнее" link. Hover lift, brightening hairline and image zoom.
   ===================================================================== */

import { REASONS } from "@/v2/lib/content";
import { Section, SectionHeading } from "../ui";
import { Stagger, StaggerItem } from "../motion";
import { Icon } from "../icons";

export function WhyRustWay() {
  return (
    <Section id="advantages">
      <SectionHeading
        align="center"
        className="mx-auto"
        eyebrow="Почему мы"
        title={
          <>
            Почему стоит <span className="rw-gradient-text">играть у нас</span>
          </>
        }
        description="Продуманные системы и плагины делают игру глубже, честнее и интереснее — а не богаче ради доната."
      />

      <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:mt-16">
        {REASONS.map((r) => (
          <StaggerItem key={r.id} className="group h-full">
            <a
              href={r.href}
              className="relative flex h-full flex-col overflow-hidden rounded-2xl rw-glass rw-topline transition-all duration-500 ease-out hover:-translate-y-1 hover:border-[var(--rw-line-3)] hover:shadow-[0_24px_70px_-24px_rgba(255,106,26,0.5)]"
            >
              {/* Cinematic art */}
              <div className="relative aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={r.title}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[var(--rw-panel)] via-[var(--rw-panel)]/10 to-transparent" />
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-6">
                <span className="rw-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--rw-orange-2)]">
                  {r.eyebrow}
                </span>
                <h3 className="rw-display mt-2 text-xl font-semibold uppercase tracking-wide text-[var(--rw-text)]">
                  {r.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--rw-muted)]">
                  {r.text}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--rw-orange-2)] transition-colors group-hover:text-[var(--rw-amber)]">
                  Подробнее
                  <Icon
                    name="ArrowUpRight"
                    size={15}
                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
              </div>
            </a>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
