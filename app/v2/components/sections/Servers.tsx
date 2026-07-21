"use client";

/* =====================================================================
   Servers — "Ознакомься с нашими серверами"
   Full cinematic server card: identity + tags + description + stat cells
   with notes + "Особенности сервера" panel on the left; server art, live
   online box and the connect block on the right. Vanilla = maintenance.
   ===================================================================== */

import { cn } from "@/v2/lib/cn";
import { SERVERS, type ServerData } from "@/v2/lib/content";
import { Section, SectionHeading, Badge } from "../ui";
import { Reveal, useCopy } from "../motion";
import { Icon } from "../icons";

function accentVar(key: ServerData["key"]) {
  return `var(--rw-${key})`;
}

function pingNote(ping: number) {
  if (ping < 20) return "Отличное соединение";
  if (ping < 35) return "Хорошее соединение";
  return "Стабильное соединение";
}
function mapNote(size: number) {
  if (size >= 4500) return "Огромная карта";
  if (size >= 4000) return "Большая карта";
  return "Средняя карта";
}

function StatCell({ icon, label, value, note, accent }: { icon: string; label: string; value: string; note: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[var(--rw-line)] bg-black/25 p-3.5">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={15} style={{ color: accent }} />
        <span className="rw-mono text-[10px] uppercase tracking-[0.14em] text-[var(--rw-faint)]">{label}</span>
      </div>
      <div className="rw-display mt-1.5 text-xl font-bold leading-none text-[var(--rw-text)]">{value}</div>
      <div className="mt-1 text-[11px] leading-tight text-[var(--rw-faint)]">{note}</div>
    </div>
  );
}

function ServerCard({ server, index }: { server: ServerData; index: number }) {
  const { copied, copy } = useCopy();
  const accent = accentVar(server.key);
  const maintenance = Boolean(server.maintenance);
  const pct = server.online != null ? Math.min(100, Math.round((server.online / server.capacity) * 100)) : 0;
  const btnGrad = `linear-gradient(120deg, ${accent}, color-mix(in srgb, ${accent} 66%, #000))`;

  return (
    <Reveal delay={index * 0.08}>
      <article
        className={cn(
          "group relative overflow-hidden rounded-3xl rw-glass rw-topline p-5 transition-all duration-500 hover:-translate-y-1 sm:p-6",
          maintenance && "opacity-[0.78]",
        )}
      >
        {/* Full-card background art */}
        <div aria-hidden className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={server.image} alt="" className="h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, var(--rw-bg) 24%, color-mix(in srgb, var(--rw-bg) 72%, transparent) 52%, color-mix(in srgb, var(--rw-bg) 20%, transparent) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, color-mix(in srgb, var(--rw-bg) 78%, transparent) 0%, transparent 45%)" }} />
          <div className="absolute inset-0 bg-[var(--rw-bg)]/55 lg:hidden" />
        </div>

        {/* Accent glow + left bar */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `radial-gradient(70% 90% at 100% 0%, color-mix(in srgb, ${accent} 16%, transparent), transparent 55%)` }}
        />
        <span aria-hidden className="absolute left-0 top-0 h-full w-1.5 rounded-r" style={{ background: `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 40%, transparent))` }} />

        <div className="relative grid gap-5 lg:grid-cols-[1.62fr_1fr]">
          {/* ============ LEFT ============ */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* Identity */}
            <div className="flex items-center gap-4">
              <div
                className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--rw-line-2)] bg-black/40 transition-transform duration-500 group-hover:scale-[1.04]"
                style={{ boxShadow: `inset 0 0 44px color-mix(in srgb, ${accent} 22%, transparent)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={server.logo} alt={`${server.name} logo`} className="h-[62px] w-[62px] object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="rw-display text-4xl font-black uppercase leading-[0.85] tracking-tighter text-[var(--rw-text)] sm:text-5xl">
                    {server.name}
                  </h3>
                  <span
                    className="rw-mono rounded-md px-2 py-1 text-xs font-bold"
                    style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 32%, transparent)` }}
                  >
                    {server.rate}
                  </span>
                  {server.featured && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)` }}
                    >
                      <Icon name="Flame" size={11} /> Хит выбора
                    </span>
                  )}
                </div>
                <p className="rw-mono mt-2 text-xs uppercase tracking-[0.16em] text-[var(--rw-faint)]">{server.subtitle}</p>
              </div>
            </div>

            {/* Tags — desktop only, mobile stays compact */}
            <div className="hidden flex-wrap gap-2 lg:flex">
              {server.tags.map((t) => (
                <Badge key={t.label} tone={t.tone} className="rw-mono uppercase tracking-wider">
                  {t.label}
                </Badge>
              ))}
            </div>

            {/* Description */}
            <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-[var(--rw-muted)]">{server.description}</p>

            {/* Stat cells — desktop only */}
            <div className="hidden gap-3 lg:grid lg:grid-cols-4">
              <StatCell icon="Skull" label="Сложность" value={server.difficulty} note={server.difficultyNote} accent={accent} />
              <StatCell icon="Signal" label="Пинг" value={`${server.ping} ms`} note={pingNote(server.ping)} accent={accent} />
              <StatCell icon="Map" label="Размер карты" value={String(server.mapSize)} note={mapNote(server.mapSize)} accent={accent} />
              <StatCell icon="Users" label="Лимит команды" value={String(server.teamLimit)} note="Игроков в команде" accent={accent} />
            </div>

            {/* Features panel — desktop only */}
            <div className="hidden rounded-2xl border border-[var(--rw-line)] bg-black/20 p-4 sm:p-5 lg:block">
              <div className="mb-4 flex items-center gap-2">
                <Icon name="Star" size={15} style={{ color: accent }} />
                <span className="rw-mono text-[11px] uppercase tracking-[0.18em] text-[var(--rw-faint)]">Особенности сервера</span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {server.features.map((f) => (
                  <div key={f.title} className="flex flex-col gap-1.5">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)` }}
                    >
                      <Icon name={f.icon} size={16} />
                    </span>
                    <span className="text-[13px] font-semibold leading-tight text-[var(--rw-text)]">{f.title}</span>
                    <span className="text-[11px] leading-tight text-[var(--rw-faint)]">{f.subtitle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ============ RIGHT ============ */}
          <div className="flex flex-col justify-between gap-4">
            {/* Online box */}
            <div className="rounded-2xl border border-[var(--rw-line)] bg-black/25 p-4">
              {maintenance ? (
                <div className="flex items-center justify-between">
                  <span className="rw-mono text-[11px] uppercase tracking-[0.16em] text-[var(--rw-faint)]">Статус</span>
                  <Badge tone="amber"><Icon name="Wifi" size={12} /> {server.statusLabel}</Badge>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rw-mono text-[11px] uppercase tracking-[0.16em] text-[var(--rw-faint)]">
                      <span className="rw-live-dot h-2 w-2" /> Онлайн
                    </span>
                    <span className="rw-display text-xl font-bold tabular-nums text-[var(--rw-text)]">
                      {server.online}
                      <span className="text-[var(--rw-faint)]">/{server.capacity}</span>
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 70%, #fff 5%), ${accent})` }} />
                  </div>
                </>
              )}
              <div className="mt-3.5 flex items-center gap-2 border-t border-[var(--rw-line)] pt-3.5 text-sm">
                <Icon name="RefreshCw" size={14} style={{ color: accent }} />
                <span className="rw-mono text-[11px] uppercase tracking-[0.12em] text-[var(--rw-faint)]">Вайп:</span>
                <span className="font-medium text-[var(--rw-text)]">{server.wipe}</span>
              </div>
            </div>

            {/* Connect + copy (anchored to the bottom, aligned with the features panel) */}
            <div className="flex flex-col gap-4">
              {maintenance ? (
                <button
                  aria-disabled
                  className="inline-flex h-14 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--rw-line)] bg-white/[0.02] font-semibold text-[var(--rw-faint)]"
                >
                  <Icon name="Clock" size={17} /> Скоро вернёмся
                </button>
              ) : (
                <a
                  href={server.connect}
                  className="group/btn relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl font-bold text-white transition-transform duration-300 hover:-translate-y-0.5"
                  style={{ background: btnGrad, boxShadow: `0 12px 30px -10px color-mix(in srgb, ${accent} 70%, transparent)` }}
                >
                  <Icon name="Play" size={17} /> Подключиться
                </a>
              )}

              <button
                onClick={() => copy(server.ip)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition-colors",
                  copied ? "border-emerald-400/40 bg-emerald-400/10" : "border-[var(--rw-line-2)] bg-black/25 hover:border-[var(--rw-line-3)]",
                )}
              >
                <span className="min-w-0">
                  <span className="rw-mono block text-[10px] uppercase tracking-[0.16em] text-[var(--rw-faint)]">
                    {copied ? "Скопировано" : "Копировать connect"}
                  </span>
                  <span className="rw-mono block truncate text-xs text-[var(--rw-text)]">connect {server.ip}</span>
                </span>
                <Icon name={copied ? "Check" : "Copy"} size={16} className={copied ? "text-emerald-300" : "text-[var(--rw-muted)]"} />
              </button>

              {/* Compact stats — mobile only, like the classic card */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl border border-[var(--rw-line)] bg-black/25 p-4 lg:hidden">
                {[
                  { icon: "Skull", label: "", value: server.difficulty },
                  { icon: "Map", label: "Карта", value: String(server.mapSize) },
                  { icon: "Users", label: "Лимит", value: String(server.teamLimit) },
                  { icon: "Signal", label: "Пинг", value: `${server.ping} ms` },
                ].map((s) => (
                  <div key={s.icon} className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[13px]">
                    <Icon name={s.icon} size={14} className="shrink-0" style={{ color: accent }} />
                    {s.label && <span className="text-[var(--rw-faint)]">{s.label}:</span>}
                    <span className="truncate font-semibold text-[var(--rw-text)]">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

export function Servers() {
  return (
    <Section id="servers">
      <SectionHeading
        eyebrow="Наши сервера"
        title={
          <>
            Ознакомься с нашими <span className="rw-gradient-text">серверами</span>
          </>
        }
        description="Все такие разные, но их объединяете вы. Выбери режим под своё настроение — от хардкора до чилла."
      />
      <div className="mt-12 flex flex-col gap-6 lg:mt-16">
        {SERVERS.map((server, i) => (
          <ServerCard key={server.key} server={server} index={i} />
        ))}
      </div>
    </Section>
  );
}
