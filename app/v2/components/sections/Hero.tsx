"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BRAND, HERO_STATS, SERVERS } from "@/v2/lib/content";
import { Button, Container, LivePill } from "../ui";
import { Icon } from "../icons";
import { CountUp, Floaty, Magnetic } from "../motion";
import { Sparkles, EmberStream, LightBeams, WaterCaustics, Bokeh } from "../Effects";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Next Friday 16:00 МСК (= 13:00 UTC) */
function nextWipe(now = new Date()): Date {
  const d = new Date(now);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 0, 0));
  const day = target.getUTCDay(); // 0 Sun ... 5 Fri
  let add = (5 - day + 7) % 7;
  if (add === 0 && now.getTime() >= target.getTime()) add = 7;
  target.setUTCDate(target.getUTCDate() + add);
  return target;
}

function useCountdown() {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const diff = Math.max(0, nextWipe(now).getTime() - now.getTime());
      const s = Math.floor(diff / 1000);
      setParts({
        d: Math.floor(s / 86400),
        h: Math.floor((s % 86400) / 3600),
        m: Math.floor((s % 3600) / 60),
        s: s % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return parts;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Hero() {
  const cd = useCountdown();
  const totalOnline = SERVERS.reduce((t, s) => t + (s.online ?? 0), 0);

  return (
    <section id="top" className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden pt-28 pb-16 lg:pt-24">
      {/* ---- Background layers ---- */}
      {/* Summer base image (/public/f.webp — blue lake + green forest). To use your own shot,
          replace public/f.webp or send it and I'll wire it here. Falls back to /banner.jpg. */}
      <div className="absolute inset-0 -z-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/f.webp"
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fb) {
              el.dataset.fb = "1";
              el.src = "/banner.jpg";
            }
          }}
          alt=""
          aria-hidden
          className="h-full w-full object-cover object-center"
        />
      </div>

      {/* Legibility layers — summer: reveal the blue water + green forest, darken only where text sits */}
      <div className="absolute inset-0 -z-30 bg-[var(--rw-bg)]/8" />
      {/* left headline legibility — softer, clears sooner so the water breathes */}
      <div className="absolute inset-0 -z-30 bg-gradient-to-r from-[var(--rw-bg)]/85 from-0% via-[var(--rw-bg)]/25 via-34% to-transparent" />
      {/* bottom blend into the page */}
      <div className="absolute inset-0 -z-30 bg-gradient-to-t from-[var(--rw-bg)] from-0% via-transparent via-42% to-[var(--rw-bg)]/10" />
      {/* cool sky lift for summer air */}
      <div
        className="pointer-events-none absolute inset-0 -z-30"
        style={{ background: "linear-gradient(to bottom, rgba(120,200,235,0.10), transparent 28%)" }}
      />
      {/* soft, lighter vignette */}
      <div
        className="pointer-events-none absolute inset-0 -z-30"
        style={{ background: "radial-gradient(130% 100% at 50% 42%, transparent 62%, rgba(12,8,5,0.42) 100%)" }}
      />
      {/* Atmospheric effects — layered summer ambience */}
      {/* warm summer sun bloom, upper-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-20"
        style={{ top: "-14%", right: "-6%", width: 640, height: 640, background: "radial-gradient(circle, rgba(255,224,150,0.26), rgba(255,190,90,0.10) 40%, transparent 66%)", filter: "blur(6px)", mixBlendMode: "screen" }}
      />
      <LightBeams className="-z-20" />
      <div className="rw-grid absolute inset-0 -z-20 opacity-40" />
      {/* sunlight shimmering on the lake */}
      <WaterCaustics className="-z-20" />
      {/* dreamy bokeh depth */}
      <Bokeh count={11} className="-z-10" />
      <Sparkles count={54} className="-z-10" />
      {/* Small real campfire on the rock (right side of the shot) — kept subtle */}
      <EmberStream x={86} y={66} count={10} className="-z-10 hidden lg:block" />
      <div className="absolute inset-0 -z-10 rw-noise opacity-[0.04]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-[var(--rw-bg)] to-transparent" />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          {/* ---- Left: headline ---- */}
          <div className="flex flex-col items-start">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="flex flex-wrap items-center gap-3"
            >
              <LivePill>{totalOnline} игроков в бою прямо сейчас</LivePill>
              <span className="rw-mono inline-flex items-center gap-2 rounded-full border border-[var(--rw-line-2)] bg-white/[0.03] px-3.5 py-1.5 text-xs uppercase tracking-[0.2em] text-[var(--rw-muted)]">
                <Icon name="RefreshCw" size={13} className="text-[var(--rw-orange-2)]" />
                Вайп каждую пятницу
              </span>
            </motion.div>

            <h1 className="rw-display mt-6 text-[clamp(2.75rem,9vw,7.5rem)] font-black uppercase leading-[0.86] tracking-[-0.02em]">
              {["ТВОЙ ПУТЬ", "В"].map((line, i) => (
                <motion.span
                  key={line}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: EASE }}
                  className="block"
                >
                  {line === "В" ? (
                    <span className="inline-flex items-baseline gap-[0.25em]">
                      В <span className="rw-gradient-text">RUST</span>
                    </span>
                  ) : (
                    line
                  )}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
              className="mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-[var(--rw-muted)] sm:mt-6 sm:text-lg"
            >
              {BRAND.name} — премиальные серверы: кастомные плагины, честная экономика и реальные Steam-скины.
              <span className="hidden sm:inline"> Еженедельные ивенты с призовым фондом{" "}
                <span className="font-semibold text-[var(--rw-text)]">10 000 ₽</span>. Выбери свой стиль игры.</span>
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Magnetic>
                <Button href="#servers" size="lg">
                  <Icon name="Play" size={18} />
                  Играть сейчас
                </Button>
              </Magnetic>
              <Button href="#trailer" variant="ghost" size="lg">
                <Icon name="Play" size={16} />
                Смотреть трейлер
              </Button>
            </motion.div>

            {/* Stats row */}
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-10 grid w-full max-w-xl grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--rw-line)] pt-7 sm:grid-cols-4"
            >
              {HERO_STATS.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dd className="rw-display text-2xl font-semibold tracking-tight text-[var(--rw-text)] sm:text-3xl">
                    <CountUp to={s.value} suffix={s.suffix ?? ""} />
                  </dd>
                  <dt className="mt-1 text-xs text-[var(--rw-faint)]">{s.label}</dt>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* ---- Right: floating countdown + cards ---- */}
          <div className="relative hidden h-full min-h-[540px] lg:block">
            <Floaty amplitude={6} duration={7} className="absolute right-0 top-0 w-[316px]">
              <div className="rw-glass rw-topline rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <span className="rw-mono text-xs uppercase tracking-[0.2em] text-[var(--rw-orange-2)]">
                    Следующий вайп
                  </span>
                  <Icon name="Clock" size={17} className="text-[var(--rw-faint)]" />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { v: cd.d, l: "дн" },
                    { v: cd.h, l: "ч" },
                    { v: cd.m, l: "мин" },
                    { v: cd.s, l: "сек" },
                  ].map((p) => (
                    <div key={p.l} className="rounded-xl border border-[var(--rw-line)] bg-black/30 py-3 text-center">
                      <div className="rw-display text-[1.7rem] font-semibold tabular-nums leading-none text-[var(--rw-text)]">
                        {pad(p.v)}
                      </div>
                      <div className="rw-mono mt-1 text-[11px] uppercase text-[var(--rw-faint)]">{p.l}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-[var(--rw-muted)]">Пятница, 16:00 МСК — свежая карта и чертежи для всех.</p>
              </div>
            </Floaty>

            <Floaty amplitude={6} duration={8} delay={1} className="absolute right-0 top-[332px] w-[300px]">
              <div className="rw-glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-chill)]/15 text-[var(--rw-chill)]">
                    <Icon name="Castle" size={22} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--rw-text)]">Битва деревень</div>
                    <div className="text-[13px] text-[var(--rw-muted)]">Ивент недели · 10 000 монет</div>
                  </div>
                </div>
              </div>
            </Floaty>

            <Floaty amplitude={6} duration={6.5} delay={0.5} className="absolute right-5 top-[228px] w-[288px]">
              <div className="rw-glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-orange)]/15 text-[var(--rw-amber)]">
                    <Icon name="Gift" size={22} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--rw-text)]">Реальные скины</div>
                    <div className="text-[13px] text-[var(--rw-muted)]">Прямо в Steam-инвентарь</div>
                  </div>
                </div>
              </div>
            </Floaty>

            <Floaty amplitude={6} duration={7.5} delay={1.5} className="absolute right-3 top-[436px] w-[304px]">
              <div className="rw-glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rw-hard)]/15 text-[var(--rw-hard)]">
                    <Icon name="Skull" size={22} />
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--rw-text)]">Баунти турнир</div>
                    <div className="text-[13px] text-[var(--rw-muted)]">Охота за головами · PvP-ивент</div>
                  </div>
                </div>
              </div>
            </Floaty>
          </div>
        </div>
      </Container>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"
      >
        <div className="flex flex-col items-center gap-2 text-[var(--rw-faint)]">
          <span className="rw-mono text-[10px] uppercase tracking-[0.3em]">Листай вниз</span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon name="ChevronDown" size={18} />
          </motion.span>
        </div>
      </motion.div>
    </section>
  );
}
