"use client";

/* =====================================================================
   Gallery — "Кадры с полей сражений"
   Editorial 12-col grid of screenshots with hover zoom + caption reveal,
   and a full-screen lightbox (AnimatePresence) with prev/next, keyboard
   navigation (Esc / arrows) and body-scroll lock.
   ===================================================================== */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { GALLERY } from "@/v2/lib/content";
import { Section, SectionHeading, Badge } from "../ui";
import { Reveal, motion } from "../motion";
import { Icon } from "../icons";

/* Editorial spans for a magazine-style rhythm (lg = 12 cols). */
const SPAN = [
  "lg:col-span-7",
  "lg:col-span-5",
  "lg:col-span-4",
  "lg:col-span-4",
  "lg:col-span-4",
  "lg:col-span-12",
];

export function Gallery() {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback(
    (dir: number) => setOpen((i) => (i == null ? i : (i + dir + GALLERY.length) % GALLERY.length)),
    [],
  );

  useEffect(() => {
    if (open == null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, go]);

  return (
    <Section id="gallery">
      <SectionHeading
        eyebrow="Галерея"
        title={
          <>
            Кадры с <span className="rw-gradient-text">полей сражений</span>
          </>
        }
        description="Скриншоты с наших серверов: рейды, ночные замесы и рассветы над картой."
      />

      <Reveal delay={0.1}>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-16 lg:grid-cols-12">
          {GALLERY.map((shot, i) => (
            <button
              key={shot.src}
              onClick={() => setOpen(i)}
              aria-label={`Открыть: ${shot.title}`}
              className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--rw-line)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--rw-orange)] ${i === 5 ? "col-span-2" : ""} ${SPAN[i] ?? ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={shot.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />

              {/* expand icon */}
              <span className="absolute right-3 top-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <Icon name="Maximize2" size={15} />
              </span>

              {/* caption */}
              <div className="absolute inset-x-0 bottom-0 flex translate-y-1.5 items-end justify-between p-4 opacity-90 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="rw-display text-left text-lg font-semibold uppercase leading-none tracking-tight text-white drop-shadow">
                  {shot.title}
                </span>
                <Badge tone="amber">{shot.tag}</Badge>
              </div>
            </button>
          ))}
        </div>
      </Reveal>

      {/* ---- Lightbox ---- */}
      <AnimatePresence>
        {open != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
            onClick={close}
          >
            <div className="absolute inset-0 bg-black/88 backdrop-blur-xl" />

            <button
              onClick={close}
              aria-label="Закрыть"
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10 sm:right-6 sm:top-6"
            >
              <Icon name="X" size={20} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label="Предыдущий"
              className="absolute left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10 sm:left-8"
            >
              <Icon name="ChevronLeft" size={22} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label="Следующий"
              className="absolute right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10 sm:right-8"
            >
              <Icon name="ChevronRight" size={22} />
            </button>

            <motion.figure
              key={open}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-[1] max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--rw-line-2)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GALLERY[open].src} alt={GALLERY[open].title} className="max-h-[85vh] w-full object-contain" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent p-5">
                <span className="rw-display text-xl font-semibold uppercase tracking-tight text-white">{GALLERY[open].title}</span>
                <span className="rw-mono text-xs text-white/60">{open + 1} / {GALLERY.length}</span>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}
