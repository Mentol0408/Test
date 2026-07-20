"use client";

import { BRAND, LEGAL, NAV, SOCIALS, COMMUNITY } from "@/v2/lib/content";
import { Container } from "../ui";
import { Logo } from "../Logo";
import { LegalModals } from "../LegalModals";
import { BrandIcon, Icon } from "../icons";

export function Footer() {
  const year = 2026; // avoids hydration mismatch; bump per release

  return (
    <footer className="relative border-t border-[var(--rw-line)] bg-[var(--rw-bg-2)]">
      <div className="rw-grid absolute inset-0 opacity-40" />
      <Container className="relative">
        <div className="grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[var(--rw-muted)]">{BRAND.about}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {COMMUNITY.map((c) => (
                <a
                  key={c.id}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={c.name}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--rw-line)] bg-white/[0.02] text-[var(--rw-muted)] transition-all hover:border-[var(--rw-orange)]/40 hover:text-[var(--rw-text)]"
                >
                  <BrandIcon name={c.icon} size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Nav */}
          <div>
            <h3 className="rw-mono text-[11px] uppercase tracking-[0.22em] text-[var(--rw-faint)]">Навигация</h3>
            <ul className="mt-5 space-y-3">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="text-sm text-[var(--rw-muted)] transition-colors hover:text-[var(--rw-text)]">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal / info */}
          <div>
            <h3 className="rw-mono text-[11px] uppercase tracking-[0.22em] text-[var(--rw-faint)]">Информация</h3>
            <ul className="mt-5 space-y-3">
              <LegalModals />
              <li>
                <a href={`mailto:${LEGAL.email}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--rw-muted)] transition-colors hover:text-[var(--rw-text)]">
                  <Icon name="ArrowUpRight" size={13} />
                  Почта для связи
                </a>
              </li>
            </ul>
          </div>

          {/* CTA card */}
          <div className="rw-glass rw-topline rounded-2xl p-6">
            <h3 className="rw-display text-lg font-semibold uppercase tracking-wide">Готов зайти?</h3>
            <p className="mt-2 text-sm text-[var(--rw-muted)]">Присоединяйся к сообществу и следи за анонсами вайпов.</p>
            <a
              href={SOCIALS.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="rw-btn-primary mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                <BrandIcon name="discord" size={16} />
                Наш Discord
              </span>
            </a>
          </div>
        </div>

        {/* Legal bar */}
        <div className="flex flex-col gap-4 border-t border-[var(--rw-line)] py-8 text-xs text-[var(--rw-faint)] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© {year} {BRAND.name}</span>
            <span className="hidden md:inline text-[var(--rw-line-3)]">•</span>
            <span>{LEGAL.entity}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{LEGAL.ogrnip}</span>
            <span>{LEGAL.inn}</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
