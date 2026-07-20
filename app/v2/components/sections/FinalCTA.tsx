"use client";

import { cn } from "@/v2/lib/cn";
import { PRIMARY_IP, SOCIALS } from "@/v2/lib/content";
import { Button, Container } from "../ui";
import { BrandIcon, Icon } from "../icons";
import { CountUp, Magnetic, Reveal, useCopy } from "../motion";
import { SERVERS } from "@/v2/lib/content";

export function FinalCTA() {
  const { copied, copy } = useCopy();
  const totalOnline = SERVERS.reduce((t, s) => t + (s.online ?? 0), 0);

  return (
    <section className="relative isolate overflow-hidden py-28 lg:py-40">
      <div className="absolute inset-0 -z-30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/servers-background.png" alt="" className="h-full w-full object-cover opacity-25" />
      </div>
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-[var(--rw-bg)] via-[var(--rw-bg)]/85 to-[var(--rw-bg)]" />
      <div className="rw-aurora -z-20" />
      <div className="rw-grid absolute inset-0 -z-20" />

      <Container className="relative text-center">
        <Reveal>
          <span className="rw-mono inline-flex items-center gap-2 rounded-full border border-[var(--rw-orange)]/30 bg-[var(--rw-orange)]/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-[var(--rw-amber)]">
            <span className="rw-live-dot h-1.5 w-1.5" />
            {totalOnline} игроков онлайн
          </span>
        </Reveal>

        <Reveal delay={0.06}>
          <h2 className="rw-display mx-auto mt-7 max-w-4xl text-[clamp(2.75rem,7vw,6rem)] font-bold uppercase leading-[0.9] tracking-tight">
            Готов начать свой{" "}
            <span className="rw-gradient-text">путь?</span>
          </h2>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-[var(--rw-muted)] sm:text-lg">
            Заходи на сервер, собирай команду и напиши свою историю выживания.
            Вайп уже ждёт — а вместе с ним свежий старт для всех.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <Button href="#servers" size="lg">
                <Icon name="Play" size={18} />
                Играть сейчас
              </Button>
            </Magnetic>
            <Button href={SOCIALS.discord} target="_blank" rel="noopener noreferrer" variant="ghost" size="lg">
              <BrandIcon name="discord" size={18} />
              Вступить в Discord
            </Button>
            <button
              onClick={() => copy(PRIMARY_IP)}
              className={cn(
                "inline-flex h-14 items-center gap-2.5 rounded-xl border px-6 text-[15px] font-medium transition-colors",
                copied
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : "border-[var(--rw-line-2)] bg-white/[0.03] text-[var(--rw-text)] hover:border-[var(--rw-orange)]/40",
              )}
            >
              <Icon name={copied ? "Check" : "Copy"} size={16} />
              <span className="rw-mono text-sm">{copied ? "Скопировано" : PRIMARY_IP}</span>
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mx-auto mt-12 flex max-w-lg items-center justify-center gap-8 border-t border-[var(--rw-line)] pt-8">
            <div>
              <div className="rw-display text-3xl font-semibold text-[var(--rw-text)]">
                <CountUp to={48217} />
              </div>
              <div className="text-xs text-[var(--rw-faint)]">игроков с нами</div>
            </div>
            <div className="h-10 w-px bg-[var(--rw-line-2)]" />
            <div>
              <div className="rw-display text-3xl font-semibold text-[var(--rw-text)]">4.9<span className="text-[var(--rw-amber)]">★</span></div>
              <div className="text-xs text-[var(--rw-faint)]">средняя оценка</div>
            </div>
            <div className="h-10 w-px bg-[var(--rw-line-2)]" />
            <div>
              <div className="rw-display text-3xl font-semibold text-[var(--rw-text)]">24/7</div>
              <div className="text-xs text-[var(--rw-faint)]">поддержка</div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
