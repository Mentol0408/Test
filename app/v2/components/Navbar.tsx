"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { cn } from "@/v2/lib/cn";
import { NAV, SOCIALS } from "@/v2/lib/content";
import { Logo } from "./Logo";
import { Button } from "./ui";
import { BrandIcon, Icon } from "./icons";
import { Magnetic } from "./motion";
import HallOfFame from "@/widgets/hallOfFame/HallOfFame";
import PaymentMethodModal from "@/shared/ui/PaymentMethodModal/PaymentMethodModal";
import { BALANCE_TOPUP, PAYMENT_PROVIDERS, type PaymentProvider } from "@/lib/paymentConfig";

const SOCIAL_ORDER = [
  { name: "discord", href: SOCIALS.discord },
  { name: "telegram", href: SOCIALS.telegram },
  { name: "youtube", href: SOCIALS.youtube },
] as const;

export function Navbar() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");
  const [hofOpen, setHofOpen] = useState(false);

  // Steam session / balance / topup
  const [steamId, setSteamId] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [userMenu, setUserMenu] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(BALANCE_TOPUP.defaultAmount);
  const [topupMessage, setTopupMessage] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    setReturnTo(window.location.href);
    fetch("/api/session", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.steamId) return;
        setSteamId(d.steamId);
        fetch("/api/steam/avatar", { credentials: "include", cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((a) => a?.avatar && setAvatar(a.avatar))
          .catch(() => {});
        fetch("/api/balance", { credentials: "include", cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((b) => typeof b?.balance === "number" && setBalance(b.balance))
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  const handleTopup = async (provider: PaymentProvider) => {
    // ИНТЕГРАЦИЯ: добавить ветку для 'skins' со своим эндпоинтом
    const endpoint = provider === "enot" ? "/api/enot/create-payment" : "/api/tbank/create-payment";
    setTopupLoading(true);
    setTopupMessage("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType: "balance_topup", amount: topupAmount }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) return setTopupMessage("Войди через Steam, чтобы пополнить баланс.");
      if (!res.ok || !data?.ok || !data?.url) return setTopupMessage("Эта платёжная система ещё не настроена.");
      window.location.href = data.url;
    } catch {
      setTopupMessage("Не удалось создать платёж. Попробуй ещё раз.");
    } finally {
      setTopupLoading(false);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy
  useEffect(() => {
    const ids = NAV.map((n) => n.href.replace("#", ""));
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        {/* Scroll progress hairline */}
        <motion.span
          aria-hidden
          style={{ scaleX: progress }}
          className="absolute inset-x-0 top-0 z-10 h-[2px] origin-left bg-[image:var(--rw-grad)] opacity-80"
        />
        <div
          className={cn(
            "mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 transition-all duration-500 sm:px-8 lg:h-[72px]",
          )}
        >
          <div
            className={cn(
              "absolute inset-x-0 top-0 -z-10 h-full transition-all duration-500",
              scrolled
                ? "border-b border-[var(--rw-line)] bg-[var(--rw-bg)]/72 backdrop-blur-xl"
                : "border-b border-transparent bg-transparent",
            )}
          />

          <a href="#top" className="shrink-0" aria-label="RUST WAY — на главную">
            <Logo />
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative rounded-lg px-3.5 py-2 text-sm font-medium tracking-tight transition-colors",
                  active === item.href
                    ? "text-[var(--rw-text)]"
                    : "text-[var(--rw-muted)] hover:text-[var(--rw-text)]",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-3.5 -bottom-px h-px origin-left bg-gradient-to-r from-[var(--rw-orange)] to-transparent transition-transform duration-300",
                    active === item.href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                />
              </a>
            ))}
            <button
              onClick={() => setHofOpen(true)}
              className="group relative ml-1 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
            >
              <Icon name="Trophy" size={15} className="text-[var(--rw-amber)]" />
              <span className="rw-rainbow">Зал славы</span>
              <span className="absolute inset-x-3.5 -bottom-px h-px origin-left scale-x-0 bg-gradient-to-r from-[var(--rw-orange)] to-transparent transition-transform duration-300 group-hover:scale-x-100" />
            </button>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1 xl:flex">
              {SOCIAL_ORDER.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--rw-faint)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/5 hover:text-[var(--rw-text)]"
                >
                  <BrandIcon name={s.name} size={18} />
                </a>
              ))}
              <span className="mx-1 h-5 w-px bg-[var(--rw-line-2)]" />
            </div>

            {steamId ? (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  aria-expanded={userMenu}
                  aria-label="Меню игрока"
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl border py-1 pl-1 pr-3 transition-colors",
                    userMenu ? "border-[var(--rw-orange)]/50 bg-[var(--rw-orange)]/10" : "border-[var(--rw-line-2)] bg-white/[0.03] hover:border-[var(--rw-line-3)]",
                  )}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <span className="h-8 w-8 rounded-lg bg-[var(--rw-panel-3)]" />
                  )}
                  <Icon name="ChevronDown" size={14} className="text-[var(--rw-muted)]" />
                </button>

                <AnimatePresence>
                {userMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-[calc(100%+8px)] w-60 origin-top-right overflow-hidden rounded-2xl border border-[var(--rw-line-2)] bg-[var(--rw-bg-2)] p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
                    <div className="border-b border-[var(--rw-line)] px-3 pb-3 pt-2">
                      <span className="rw-mono block text-[10px] uppercase tracking-[0.18em] text-[var(--rw-faint)]">Баланс</span>
                      <strong className="rw-display text-2xl font-black text-[var(--rw-amber)]">{balance} RW</strong>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenu(false);
                        setTopupOpen(true);
                      }}
                      className="rw-btn-primary mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold"
                    >
                      <span className="relative z-10 inline-flex items-center gap-2">
                        <Icon name="Plus" size={16} /> Пополнить баланс
                      </span>
                    </button>
                    <a href="/support" className="mt-1 flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-[var(--rw-muted)] transition-colors hover:bg-white/5 hover:text-[var(--rw-text)]">
                      <Icon name="Headset" size={15} /> Тикеты и поддержка
                    </a>
                    <button
                      onClick={async () => {
                        await fetch("/api/logout", { method: "POST" });
                        window.location.reload();
                      }}
                      className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-[var(--rw-muted)] transition-colors hover:bg-white/5 hover:text-[var(--rw-text)]"
                    >
                      <Icon name="ArrowUpRight" size={15} /> Выйти
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            ) : (
              <Button
                href={`/api/steam/login?returnTo=${encodeURIComponent(returnTo)}`}
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <BrandIcon name="steam" size={16} />
                Войти
              </Button>
            )}

            <Magnetic>
              <Button href="#servers" size="sm" className="hidden sm:inline-flex">
                <Icon name="Play" size={15} />
                Играть
              </Button>
            </Magnetic>

            {/* Mobile toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Меню"
              aria-expanded={open}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--rw-line)] bg-white/[0.03] text-[var(--rw-text)] lg:hidden"
            >
              <Icon name={open ? "X" : "Menu"} size={20} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="absolute inset-0 bg-[var(--rw-bg)]/90 backdrop-blur-xl" onClick={() => setOpen(false)} />
            <motion.nav
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative mt-16 flex flex-col gap-1 px-6 pt-8"
            >
              {NAV.map((item, i) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * i }}
                  className="rw-display flex items-center justify-between border-b border-[var(--rw-line)] py-4 text-2xl font-semibold uppercase tracking-wide text-[var(--rw-text)]"
                >
                  {item.label}
                  <Icon name="ArrowRight" size={18} className="text-[var(--rw-orange)]" />
                </motion.a>
              ))}
              <motion.button
                onClick={() => {
                  setHofOpen(true);
                  setOpen(false);
                }}
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.05 * NAV.length }}
                className="rw-display flex items-center justify-between border-b border-[var(--rw-line)] py-4 text-2xl font-semibold uppercase tracking-wide"
              >
                <span className="rw-rainbow">Зал славы</span>
                <Icon name="Trophy" size={20} className="text-[var(--rw-orange)]" />
              </motion.button>
              <div className="mt-6 flex flex-col gap-3">
                <Button href="#servers" size="lg" onClick={() => setOpen(false)}>
                  <Icon name="Play" size={18} />
                  Играть сейчас
                </Button>
                <Button
                  href={`/api/steam/login?returnTo=${encodeURIComponent(returnTo)}`}
                  variant="ghost"
                  size="lg"
                  onClick={() => setOpen(false)}
                >
                  <BrandIcon name="steam" size={18} />
                  Войти через Steam
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-2">
                {(["discord", "telegram", "vk", "youtube", "tiktok"] as const).map((n) => (
                  <a
                    key={n}
                    href={(SOCIALS as Record<string, string>)[n === "vk" ? "vk" : n]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={n}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--rw-line)] bg-white/[0.03] text-[var(--rw-muted)]"
                  >
                    <BrandIcon name={n} size={20} />
                  </a>
                ))}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <HallOfFame isOpen={hofOpen} onClose={() => setHofOpen(false)} />

      <PaymentMethodModal
        isOpen={topupOpen}
        onClose={() => !topupLoading && setTopupOpen(false)}
        title="Пополнение баланса"
        subtitle={`Пополнение на ${topupAmount} ₽`}
        disabled={topupLoading}
        providers={PAYMENT_PROVIDERS}
        onSelect={(p) => void handleTopup(p)}
        message={topupMessage}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--rw-muted)]">Сумма пополнения</p>
            <strong className="rw-display text-2xl font-black text-[var(--rw-amber)]">{topupAmount} ₽</strong>
          </div>
          <input
            type="range"
            min={BALANCE_TOPUP.min}
            max={BALANCE_TOPUP.max}
            step={BALANCE_TOPUP.step}
            value={topupAmount}
            onChange={(e) => setTopupAmount(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--rw-panel-3)] accent-[var(--rw-orange)]"
          />
          <p className="text-xs text-[var(--rw-faint)]">Выбери сумму, затем платёжный способ ниже.</p>
        </div>
      </PaymentMethodModal>
    </>
  );
}
