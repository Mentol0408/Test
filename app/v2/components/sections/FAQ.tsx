"use client";

import { useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/v2/lib/cn";
import { FAQ as FAQ_ITEMS, SOCIALS } from "@/v2/lib/content";
import { Section, SectionHeading, Button } from "../ui";
import { BrandIcon, Icon } from "../icons";
import { Reveal, Stagger, StaggerItem, Magnetic, motion } from "../motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <Section id="faq" className="relative overflow-hidden">
      {/* Ambient molten glow, radially masked so it never bleeds into neighbours */}
      <div className="rw-spot pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" aria-hidden />

      <SectionHeading
        align="center"
        className="mx-auto"
        eyebrow="FAQ"
        title={
          <>
            Частые <span className="rw-gradient-text">вопросы</span>
          </>
        }
        description="Коротко о вайпах, монетах, кейсах и подключении. Не нашёл ответ — загляни в Discord."
      />

      <Stagger className="mx-auto mt-12 flex max-w-3xl flex-col gap-3 sm:mt-16" amount={0.15}>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          const triggerId = `faq-trigger-${i}`;
          const panelId = `faq-panel-${i}`;

          return (
            <StaggerItem key={item.q}>
              <div
                className={cn(
                  "rw-glass rw-topline group relative overflow-hidden rounded-2xl transition-colors duration-300",
                  isOpen
                    ? "border-[var(--rw-orange)]/35 bg-white/[0.02]"
                    : "border-[var(--rw-line)] hover:border-[var(--rw-line-2)]",
                )}
              >
                {/* Molten accent bar on the active item */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-0 h-full w-[2px] origin-top bg-[image:var(--rw-grad)] transition-transform duration-500 ease-out",
                    isOpen ? "scale-y-100" : "scale-y-0",
                  )}
                />

                <h3 className="m-0">
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rw-orange)] sm:px-6"
                  >
                    <span
                      className={cn(
                        "rw-display text-base font-semibold uppercase leading-snug tracking-tight transition-colors duration-300 sm:text-lg",
                        isOpen
                          ? "text-[var(--rw-amber)]"
                          : "text-[var(--rw-text)] group-hover:text-[var(--rw-orange-2)]",
                      )}
                    >
                      {item.q}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all duration-300 ease-out",
                        isOpen
                          ? "rotate-45 border-[var(--rw-orange)]/45 bg-[var(--rw-orange)]/12 text-[var(--rw-amber)]"
                          : "border-[var(--rw-line-2)] text-[var(--rw-muted)] group-hover:border-[var(--rw-line-3)] group-hover:text-[var(--rw-text)]",
                      )}
                    >
                      <Icon name="Plus" size={18} />
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0.2 : 0.42, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-6 sm:px-6">
                        <div className="mb-4 h-px w-full bg-[var(--rw-line)]" />
                        <p className="max-w-prose text-[15px] leading-relaxed text-[var(--rw-muted)]">
                          {item.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* Closing CTA — nudge unresolved questions into Discord */}
      <Reveal delay={0.1}>
        <div className="rw-glass rw-topline mx-auto mt-6 flex max-w-3xl flex-col items-center gap-5 rounded-2xl px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col gap-1">
            <span className="rw-display text-lg font-semibold uppercase tracking-tight text-[var(--rw-text)]">
              Остались вопросы?
            </span>
            <span className="text-sm leading-relaxed text-[var(--rw-muted)]">
              Живое комьюнити и поддержка ответят быстрее любого FAQ.
            </span>
          </div>
          <Magnetic>
            <Button
              href={SOCIALS.discord}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              className="shrink-0"
            >
              <BrandIcon name="discord" size={18} />
              Спросить в Discord
            </Button>
          </Magnetic>
        </div>
      </Reveal>
    </Section>
  );
}
