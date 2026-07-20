'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import Header from '@/widgets/header/Header';
import type { CaseCatalogResponse, CaseDefinition, CaseItem, CaseRarity } from '@/types/cases';
import styles from './cases.module.scss';

const STRIP_LEN = 64;
const WIN_INDEX = 58;
const TILE_W = 150;
const GAP = 12;
const STEP = TILE_W + GAP;

const RARITY_META: Record<CaseRarity, { label: string; color: string }> = {
  common: { label: 'Обычный', color: '#9aa6b4' },
  rare: { label: 'Редкий', color: '#4a90ff' },
  mythical: { label: 'Мифический', color: '#b15bff' },
  fake: { label: 'Фейк', color: '#ff6b6b' },
};

type OpenedState = {
  openingId: number;
  item: CaseItem;
};

type SessionPayload = {
  steamId: string | null;
  isAdmin: boolean;
};

function randomItem(caseDef: CaseDefinition): CaseItem {
  return caseDef.items[Math.floor(Math.random() * caseDef.items.length)] ?? caseDef.items[0];
}

function formatRW(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function readableError(code: string | null) {
  switch (code) {
    case 'AUTH_REQUIRED':
      return 'Сначала войди через Steam, чтобы открыть кейс.';
    case 'INSUFFICIENT_BALANCE':
      return 'Не хватает RW на открытие кейса.';
    case 'CASES_DISABLED':
      return 'Кейсы временно выключены администратором.';
    case 'ADMIN_ONLY_CASE_OPEN':
      return 'Сейчас открывать кейсы могут только админы.';
    case 'TRADE_URL_REQUIRED':
      return 'Укажи trade-ссылку Steam перед выводом.';
    case 'BOT_UNAVAILABLE':
    case 'CASE_BOT_NOT_CONFIGURED':
      return 'Бот сейчас недоступен. Попробуй вывести скин чуть позже.';
    case 'OPENING_ALREADY_RESOLVED':
      return 'Этот дроп уже обработан.';
    default:
      return code || 'Что-то пошло не так.';
  }
}

function ItemTile({ item, big = false }: { item: CaseItem; big?: boolean }) {
  const color = RARITY_META[item.isFake ? 'mythical' : item.rarity].color;

  return (
    <div className={`${styles.tile} ${big ? styles.tileBig : ''}`} style={{ '--rc': color } as CSSProperties}>
      <div className={styles.tileArt}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} />
        ) : (
          <span className={styles.tileGlyph} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 7h13l5 4-2 2h-3l-2 3H9l-2-3H4z" />
              <path d="M7 11h6" />
            </svg>
          </span>
        )}
      </div>
      <span className={styles.tileName} style={{ color }}>{item.name}</span>
      <span className={styles.tileCat} />
    </div>
  );
}

function CaseOpener({
  caseDef,
  systemEnabled,
  adminOnlyOpen,
  canOpen,
  onClose,
}: {
  caseDef: CaseDefinition;
  systemEnabled: boolean;
  adminOnlyOpen: boolean;
  canOpen: boolean;
  onClose: () => void;
}) {
  const [strip, setStrip] = useState<CaseItem[]>(() => Array.from({ length: STRIP_LEN }, () => randomItem(caseDef)));
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<OpenedState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tradeUrl, setTradeUrl] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<OpenedState | null>(null);

  useEffect(() => {
    setStrip(Array.from({ length: STRIP_LEN }, () => randomItem(caseDef)));
    setOffset(0);
    setWon(null);
    setMessage(null);
  }, [caseDef]);

  const spin = async () => {
    if (spinning || submitting || !systemEnabled || !canOpen) {
      if (adminOnlyOpen && !canOpen) {
        setMessage(readableError('ADMIN_ONLY_CASE_OPEN'));
      }
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/cases/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ caseId: caseDef.id }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; openingId?: number; winningItem?: CaseItem; error?: string } | null;

      if (!response.ok || !result?.ok || !result.winningItem || !result.openingId) {
        setMessage(readableError(result?.error || 'CASE_OPEN_FAILED'));
        return;
      }

      const nextWin = {
        openingId: result.openingId,
        item: result.winningItem,
      };

      winRef.current = nextWin;
      setWon(null);

      const nextStrip = Array.from({ length: STRIP_LEN }, (_, index) => (index === WIN_INDEX ? result.winningItem! : randomItem(caseDef)));
      setStrip(nextStrip);
      setSpinning(false);
      setOffset(0);

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const vw = viewportRef.current?.clientWidth ?? 900;
          const jitter = (Math.random() - 0.5) * (TILE_W * 0.62);
          const target = -(WIN_INDEX * STEP + TILE_W / 2 - vw / 2 + jitter);
          setSpinning(true);
          setOffset(target);
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const claim = async () => {
    if (!won || !tradeUrl.trim()) {
      setMessage(readableError('TRADE_URL_REQUIRED'));
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/cases/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ openingId: won.openingId, tradeUrl: tradeUrl.trim() }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        setMessage(readableError(result?.error || 'CASE_CLAIM_FAILED'));
        return;
      }

      setMessage('Скин отправлен ботом. Проверь оффер в Steam.');
    } finally {
      setSubmitting(false);
    }
  };

  const sell = async () => {
    if (!won) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/cases/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ openingId: won.openingId }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; balance?: number } | null;

      if (!response.ok || !result?.ok) {
        setMessage(readableError(result?.error || 'CASE_SELL_FAILED'));
        return;
      }

      setMessage(`Скин продан. Новый баланс: ${formatRW(Number(result.balance || 0))} RW.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.opener} style={{ '--accent': caseDef.accent } as CSSProperties}>
      <button type="button" className={styles.back} onClick={onClose}>← К списку кейсов</button>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>Открываем</span>
          <h1 className={styles.heroTitle}>{caseDef.name}</h1>
          <span className={styles.heroSub}>кейс</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.heroCase} src={caseDef.imageUrl} alt={caseDef.name} />

        <div className={`${styles.infoCard} ${styles.infoLeft}`}>
          <div className={styles.infoHead}>🎁 О кейсе</div>
          <strong>{caseDef.items.length} предметов</strong>
          <small>{caseDef.description}</small>
        </div>
        <div className={`${styles.infoCard} ${styles.infoRight}`}>
          <div className={styles.infoHead}>👑 Шансы дропа</div>
          <ul className={styles.chances}>
            {[...caseDef.items]
              .filter((item) => item.isActive)
              .sort((a, b) => b.dropChance - a.dropChance || a.sortOrder - b.sortOrder)
              .slice(0, 4)
              .map((item) => {
                const rarity = item.isFake ? 'mythical' : item.rarity;

                return (
                  <li key={item.id}>
                    <span className={styles.dot} style={{ background: RARITY_META[rarity].color }} />
                    <span>{item.name}</span>
                    <b>{item.dropChance}%</b>
                  </li>
                );
              })}
          </ul>
        </div>
      </section>

      <div className={styles.roulette} ref={viewportRef}>
        <span className={`${styles.marker} ${styles.markerTop}`} />
        <span className={`${styles.marker} ${styles.markerBottom}`} />
        <div className={styles.fadeL} />
        <div className={styles.fadeR} />
        <div
          className={styles.strip}
          style={{ transform: `translateX(${offset}px)`, transition: spinning ? 'transform 6.2s cubic-bezier(0.06,0.7,0.08,1)' : 'none' }}
          onTransitionEnd={() => {
            if (spinning) {
              setSpinning(false);
              setWon(winRef.current);
            }
          }}
        >
          {strip.map((item, index) => (
            <ItemTile key={`${item.id}-${index}`} item={item} />
          ))}
        </div>
      </div>

      {won ? (
        <div className={styles.result} style={{ '--rc': RARITY_META[won.item.isFake ? 'mythical' : won.item.rarity].color } as CSSProperties}>
          <span className={styles.resultTitle}>Поздравляем!</span>
          <span className={styles.resultSub}>ты выиграл</span>
          <div className={styles.resultCard}>
            <ItemTile item={won.item} big />
            <div className={styles.resultMeta}>
              <strong>{won.item.name}</strong>
              <em style={{ color: RARITY_META[won.item.isFake ? 'mythical' : won.item.rarity].color }}>{RARITY_META[won.item.isFake ? 'mythical' : won.item.rarity].label}</em>
              <span>Готов к выводу через Steam trade</span>
            </div>
          </div>
        </div>
      ) : null}

      {won ? (
        <label className={styles.tradeBox}>
          <span>Trade-ссылка Steam</span>
          <input
            className={styles.tradeInput}
            value={tradeUrl}
            onChange={(e) => setTradeUrl(e.target.value)}
            placeholder="https://steamcommunity.com/tradeoffer/new/?partner=..."
          />
        </label>
      ) : null}

      <div className={styles.actions}>
        {won ? (
          <>
          <button type="button" className={styles.btnGhost} onClick={() => void spin()} disabled={spinning || submitting || !systemEnabled || !canOpen}>
            Попробовать ещё
          </button>
            <button type="button" className={styles.btnPrimary} onClick={() => void claim()} disabled={submitting}>
              {submitting ? 'Отправляем…' : 'Забрать предмет'}
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => void sell()} disabled={submitting}>
              Продать за 💰 {formatRW(won.item.sellPrice)}
            </button>
          </>
        ) : (
          <button type="button" className={styles.btnPrimary} onClick={() => void spin()} disabled={spinning || submitting || !systemEnabled || !canOpen}>
            {submitting || spinning ? 'Открываем…' : `Открыть за ${formatRW(caseDef.price)} RW`}
          </button>
        )}
      </div>

      <div className={styles.trust}>
        <span>🎧 Моментальный вывод скинов на баланс</span>
        <span>🛡 Честная игра · 100% Fair Play</span>
      </div>

      {message ? <p className={styles.infoNote}>{message}</p> : null}
      {!systemEnabled ? <p className={styles.demoNote}>Кейсы временно выключены администратором.</p> : null}
      {adminOnlyOpen && !canOpen ? <p className={styles.demoNote}>Тестовый режим: открытие доступно только Steam ID администраторов.</p> : null}
    </div>
  );
}

export default function CasesPage() {
  const [data, setData] = useState<CaseCatalogResponse | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [selected, setSelected] = useState<CaseDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/cases/catalog', { cache: 'no-store' });
        const json = (await response.json().catch(() => null)) as CaseCatalogResponse | null;

        if (ignore) {
          return;
        }

        if (!response.ok || !json?.ok) {
          setError(readableError(json?.error || 'CASES_CATALOG_FAILED'));
          setData(json);
          return;
        }

        setData(json);
      } catch {
        if (!ignore) {
          setError('Не удалось загрузить кейсы.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/session', { cache: 'no-store' });
        const json = (await response.json().catch(() => null)) as SessionPayload | null;
        if (!ignore) {
          setSession(json);
        }
      } catch {
        if (!ignore) {
          setSession(null);
        }
      }
    };

    void loadSession();

    return () => {
      ignore = true;
    };
  }, []);

  const cases = data?.cases ?? [];
  const systemEnabled = data?.settings.casesEnabled !== false;
  const adminOnlyOpen = data?.settings.adminOnlyOpen === true;
  const canOpen = !adminOnlyOpen || session?.isAdmin === true;

  return (
    <main className={styles.page}>
      <Header onHallOfFameOpen={() => { window.location.href = '/'; }} />

      {selected ? (
        <CaseOpener caseDef={selected} systemEnabled={systemEnabled} adminOnlyOpen={adminOnlyOpen} canOpen={canOpen} onClose={() => setSelected(null)} />
      ) : (
        <section className={styles.wrap}>
          <div className={styles.headBar}>
            <h1>Кейсы</h1>
            <p>Открывай кейсы и забирай настоящие Rust-скины. Чем реже предмет - тем ценнее дроп.</p>
          </div>

          {loading ? <p className={styles.infoNote}>Загружаю кейсы…</p> : null}
          {error ? <p className={styles.infoNote}>{error}</p> : null}
          {!systemEnabled && !loading ? <p className={styles.demoNote}>Система кейсов сейчас выключена администратором.</p> : null}
          {adminOnlyOpen && !loading ? <p className={styles.demoNote}>Тестовый режим: открытие кейсов разрешено только администраторам.</p> : null}

          <div className={styles.grid}>
            {cases.map((caseDef) => (
              <article key={caseDef.id} className={styles.card} style={{ '--accent': caseDef.accent } as CSSProperties}>
                <div className={styles.cardGlow} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.cardImg} src={caseDef.imageUrl} alt={caseDef.name} />
                <h3 className={styles.cardName}>{caseDef.name} <span>кейс</span></h3>
                <button type="button" className={styles.cardBtn} onClick={() => setSelected(caseDef)} disabled={!systemEnabled}>
                  {!systemEnabled ? 'Временно выключен' : adminOnlyOpen ? `Тест · ${formatRW(caseDef.price)} RW` : `Открыть · ${formatRW(caseDef.price)} RW`}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
