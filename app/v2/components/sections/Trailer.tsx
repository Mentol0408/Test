"use client";

/* =====================================================================
   Trailer — "Почувствуй атмосферу"
   YouTube trailer with a custom poster + play facade (the iframe only loads
   after the user clicks, keeping the premium framing and saving bandwidth).
   ===================================================================== */

import { useState } from "react";
import { Section, SectionHeading } from "../ui";
import { Reveal } from "../motion";
import { Icon } from "../icons";

const YT_ID = "_iqIgyIFiIw";

const TRUST = [
  { icon: "Eye", label: "Официальный трейлер" },
  { icon: "Activity", label: "Геймплей с наших серверов" },
  { icon: "Sparkles", label: "Только наш контент" },
];

export function Trailer() {
  const [playing, setPlaying] = useState(false);

  return (
    <Section id="trailer" className="relative overflow-hidden">
      <div aria-hidden className="rw-aurora pointer-events-none absolute inset-0 -z-10 opacity-40" />

      <SectionHeading
        align="center"
        eyebrow="Трейлер"
        title={
          <>
            Почувствуй <span className="rw-gradient-text">атмосферу</span>
          </>
        }
        description="Полторы минуты, чтобы понять, почему игроки остаются на Rust Way."
      />

      <Reveal delay={0.1}>
        <div className="relative mx-auto mt-12 max-w-5xl lg:mt-16">
          {/* Glow behind the frame */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] opacity-70 blur-3xl"
            style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(255,138,61,0.26), transparent 70%)" }}
          />

          <div className="group relative aspect-video overflow-hidden rounded-3xl border border-[var(--rw-line-2)] bg-black shadow-[0_40px_120px_-30px_rgba(226,84,58,0.5)]">
            {playing ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="RUST WAY — Официальный трейлер"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label="Смотреть трейлер"
                className="absolute inset-0 h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${YT_ID}/maxresdefault.jpg`}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (!el.dataset.fb) {
                      el.dataset.fb = "1";
                      el.src = `https://i.ytimg.com/vi/${YT_ID}/hqdefault.jpg`;
                    }
                  }}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/45" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                  <span className="rw-btn-primary flex h-20 w-20 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110">
                    <span className="relative z-10">
                      <Icon name="Play" size={30} className="translate-x-0.5 text-black" />
                    </span>
                  </span>
                  <span className="rw-display text-lg font-bold uppercase tracking-wide text-white drop-shadow">
                    Официальный трейлер · RUST WAY
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Trust row */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUST.map((t) => (
              <span key={t.label} className="rw-mono inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--rw-faint)]">
                <Icon name={t.icon} size={14} className="text-[var(--rw-orange-2)]" />
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
