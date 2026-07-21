"use client";

import { cn } from "@/v2/lib/cn";
import { COMMUNITY, type CommunityLink } from "@/v2/lib/content";
import { Section, Container, SectionHeading, LivePill } from "../ui";
import { Reveal, Stagger, StaggerItem, CountUp } from "../motion";
import { Icon, BrandIcon } from "../icons";

/* First item (Discord) is featured as a large card; the rest form a 2x2 grid. */
const [DISCORD, ...REST] = COMMUNITY;

/* YouTube / TikTok read as "subscribe", the social hubs as "join". */
function ctaLabel(item: CommunityLink) {
  return item.id === "youtube" || item.id === "tiktok" ? "Подписаться" : "Присоединиться";
}

export function Community() {
  return (
    <Section id="community" bare className="relative overflow-hidden">
      {/* Atmospheric backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="rw-grid absolute inset-0 opacity-60" />
        <div className="rw-spot absolute inset-x-0 top-0 h-[420px]" />
      </div>

      <Container>
        <SectionHeading
          eyebrow="Комьюнити"
          title={
            <>
              Наше <span className="rw-gradient-text">комьюнити</span>
            </>
          }
          description="Следи за нами и получай регулярные подарки, анонсы вайпов и эксклюзивные ивенты."
        />

        <Stagger
          className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-16 lg:grid-cols-12 lg:grid-rows-2"
        >
          {/* -------------------------------------------------- Featured: Discord */}
          <StaggerItem className="h-full sm:col-span-2 lg:col-span-6 lg:row-span-2">
            <a
              href={DISCORD.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${DISCORD.name} — ${DISCORD.handle}`}
              className="rw-glass rw-topline group relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1 sm:p-9 lg:p-10"
            >
              {/* Radial glow on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(120% 90% at 50% 0%, rgba(${DISCORD.glow}, .35), transparent 68%)`,
                }}
              />
              {/* Colored border ring on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ boxShadow: `inset 0 0 0 1px rgba(${DISCORD.glow}, .5)` }}
              />
              {/* Oversized watermark mark */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -right-8 opacity-[0.07] transition-all duration-700 ease-out group-hover:scale-110 group-hover:opacity-[0.13]"
                style={{ color: `rgb(${DISCORD.glow})` }}
              >
                <BrandIcon name={DISCORD.icon} size={240} />
              </div>

              {/* Top row: brand tile + live status */}
              <div className="relative flex items-start justify-between gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-sm transition-transform duration-500 group-hover:scale-105"
                  style={{
                    color: `rgb(${DISCORD.glow})`,
                    borderColor: `rgba(${DISCORD.glow}, .4)`,
                    background: `rgba(${DISCORD.glow}, .1)`,
                  }}
                >
                  <BrandIcon name={DISCORD.icon} size={34} />
                </div>
                <LivePill>Онлайн 24/7</LivePill>
              </div>

              {/* Body pinned to the bottom */}
              <div className="relative mt-auto pt-10">
                <span className="rw-mono text-[11px] uppercase tracking-[0.24em] text-[var(--rw-faint)]">
                  Официальный сервер
                </span>
                <h3 className="rw-display mt-2 text-3xl font-semibold uppercase leading-none tracking-tight text-[var(--rw-text)] sm:text-4xl">
                  {DISCORD.name}
                </h3>
                <p className="rw-mono mt-2 text-sm text-[var(--rw-faint)]">{DISCORD.handle}</p>
                <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-[var(--rw-muted)] sm:text-base">
                  Общайся с игроками, находи команду, участвуй в розыгрышах и первым узнавай об анонсах вайпов.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <span
                    className="rw-btn-primary inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-medium"
                  >
                    <span className="relative z-10 inline-flex items-center gap-2">
                      {ctaLabel(DISCORD)}
                      <Icon
                        name="ArrowUpRight"
                        size={18}
                        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm text-[var(--rw-muted)]">
                    <Icon name="Users" size={16} className="text-[var(--rw-orange-2)]" />
                    <span className="rw-display text-lg font-semibold tabular-nums text-[var(--rw-text)]">
                      <CountUp to={12480} />
                    </span>
                    участников
                  </span>
                </div>
              </div>
            </a>
          </StaggerItem>

          {/* -------------------------------------------------- Remaining links */}
          {REST.map((item) => (
            <StaggerItem key={item.id} className="h-full lg:col-span-3">
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.name} — ${item.handle}`}
                className="rw-glass rw-topline group relative flex h-full min-h-[196px] flex-col justify-between overflow-hidden rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1"
              >
                {/* Radial glow on hover */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(120% 100% at 50% 0%, rgba(${item.glow}, .35), transparent 70%)`,
                  }}
                />
                {/* Colored border ring on hover */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ boxShadow: `inset 0 0 0 1px rgba(${item.glow}, .5)` }}
                />

                {/* Top: brand tile + external arrow */}
                <div className="relative flex items-start justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border backdrop-blur-sm transition-transform duration-500 group-hover:scale-105"
                    style={{
                      color: `rgb(${item.glow})`,
                      borderColor: `rgba(${item.glow}, .4)`,
                      background: `rgba(${item.glow}, .1)`,
                    }}
                  >
                    <BrandIcon name={item.icon} size={24} />
                  </div>
                  <Icon
                    name="ArrowUpRight"
                    size={18}
                    className="text-[var(--rw-faint)] transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--rw-text)]"
                  />
                </div>

                {/* Bottom: name + handle + affordance */}
                <div className="relative mt-6">
                  <h3 className="rw-display text-xl font-semibold uppercase leading-none tracking-tight text-[var(--rw-text)]">
                    {item.name}
                  </h3>
                  <p className="rw-mono mt-1.5 truncate text-xs text-[var(--rw-faint)]">{item.handle}</p>
                  <span
                    className={cn(
                      "rw-mono mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em]",
                      "text-[var(--rw-muted)] transition-colors duration-300 group-hover:text-[var(--rw-text)]",
                    )}
                  >
                    {ctaLabel(item)}
                    <Icon
                      name="ArrowUpRight"
                      size={14}
                      className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                </div>
              </a>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Reassurance line */}
        <Reveal delay={0.1}>
          <p className="rw-mono mt-8 text-center text-xs uppercase tracking-[0.2em] text-[var(--rw-faint)]">
            Более 12 000 игроков уже с нами · присоединяйся к движу
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
