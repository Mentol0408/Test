'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  HallOfFamePayload,
  LeaderboardPeriod,
  LeaderboardPlayerEntry,
  LeaderboardVillageEntry,
} from '@/types/leaderboard';
import styles from './HallOfFame.module.scss';

type HallOfFameProps = {
  isOpen: boolean;
  onClose: () => void;
};

type BoardMode = 'players' | 'villages';
type BoardTab = 'my' | 'players' | 'villages' | 'search';
type BoardEntry = LeaderboardPlayerEntry | LeaderboardVillageEntry;
type VillageSpecializationKind = 'combat' | 'raid' | 'farm' | 'build';
type VillageSpecialization = {
  kind: VillageSpecializationKind;
  label: string;
  className: string;
};
type VillageSpecializationOption = VillageSpecialization & {
  score: number;
};
type LegendNomination = {
  icon: string;
  title: string;
  player: LeaderboardPlayerEntry | null;
  value: string;
  unavailable?: boolean;
};

const villageSpecializationIcons: Record<VillageSpecializationKind, string> = {
  combat: '/rust-items/rifle.ak.webp',
  raid: '/rust-items/ammo.rocket.basic.png',
  farm: '/rust-items/icepick.salvaged.webp',
  build: '/rust-items/hammer.webp',
};
const villageSpecializationOrder: VillageSpecializationKind[] = ['combat', 'raid', 'farm', 'build'];
const villageSpecializationWeights: Record<VillageSpecializationKind, number> = {
  combat: 1,
  raid: 250,
  farm: 0.1,
  build: 0.1,
};
const maxVillageSpecializationRepeats = 2;

const periodLabels: Record<LeaderboardPeriod, string> = {
  season: 'Текущий вайп',
  all: 'За всё время',
};

const periodOrder: LeaderboardPeriod[] = ['season', 'all'];

const emptyLeaderboard: HallOfFamePayload = {
  period: 'season',
  season: null,
  players: [],
  villages: [],
  me: null,
};

function formatPoints(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function getShortPoints(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(value);
}

function isPlayerEntry(entry: BoardEntry): entry is LeaderboardPlayerEntry {
  return 'steamId' in entry;
}

function getEntryKey(entry: BoardEntry) {
  return isPlayerEntry(entry) ? entry.steamId : entry.villageId;
}

function getEntryAvatar(entry: BoardEntry) {
  return isPlayerEntry(entry) ? entry.avatarUrl : null;
}

function renderVillageSpecializationIcon(kind: VillageSpecializationKind) {
  return (
    <img
      className={styles.specializationImage}
      src={villageSpecializationIcons[kind]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function renderEntryAvatar(entry: BoardEntry) {
  if (!isPlayerEntry(entry)) {
    return (
      <svg className={styles.villageAvatarImage} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
        <defs>
          <filter id="villageGoldIconFilter" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              result="shapeAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 -1 -1 0 2.72"
            />
            <feComponentTransfer in="shapeAlpha" result="shapeMask">
              <feFuncA type="linear" slope="1.8" intercept="-0.35" />
            </feComponentTransfer>
            <feFlood floodColor="#f6c94a" result="gold" />
            <feComposite in="gold" in2="shapeMask" operator="in" />
          </filter>
        </defs>
        <image
          href="/village_image.jpg"
          width="1024"
          height="1024"
          preserveAspectRatio="xMidYMid meet"
          filter="url(#villageGoldIconFilter)"
        />
      </svg>
    );
  }

  const avatar = getEntryAvatar(entry);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={avatar || '/default-player-avatar.svg'} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}

function getFarm(entry: BoardEntry) {
  return Number(entry.totalFarm || 0);
}

function getRaids(entry: BoardEntry) {
  return Number(entry.totalRaids || 0);
}

function getBuild(entry: BoardEntry) {
  return Number(entry.totalBuild || 0);
}

function getVillageSpecializationOptions(entry: LeaderboardVillageEntry): VillageSpecializationOption[] {
  const kills = Number(entry.totalKills || 0);
  const raids = Number(entry.totalRaids || 0);
  const farm = getFarm(entry);
  const build = getBuild(entry);

  const specializations = [
    {
      kind: 'combat' as const,
      label: 'Боевая деревня',
      className: styles.combatSpecialization,
      score: kills * villageSpecializationWeights.combat,
    },
    {
      kind: 'raid' as const,
      label: 'Рейдерская деревня',
      className: styles.raidSpecialization,
      score: raids * villageSpecializationWeights.raid,
    },
    {
      kind: 'farm' as const,
      label: 'Фарм-деревня',
      className: styles.farmSpecialization,
      score: farm * villageSpecializationWeights.farm,
    },
    {
      kind: 'build' as const,
      label: 'Строительная деревня',
      className: styles.buildSpecialization,
      score: build * villageSpecializationWeights.build,
    },
  ];

  return specializations.sort((left, right) => right.score - left.score);
}

function getVillageSpecialization(entry: LeaderboardVillageEntry): VillageSpecialization {
  return getVillageSpecializationOptions(entry)[0];
}

function getDistributedVillageSpecializations(entries: BoardEntry[], shouldDiversify = true) {
  const counts: Record<VillageSpecializationKind, number> = {
    combat: 0,
    raid: 0,
    farm: 0,
    build: 0,
  };
  const result: Record<string, VillageSpecialization> = {};
  const villageEntries = entries.filter((entry): entry is LeaderboardVillageEntry => !isPlayerEntry(entry));

  if (!shouldDiversify) {
    villageEntries.forEach((entry) => {
      result[getEntryKey(entry)] = getVillageSpecialization(entry);
    });

    return result;
  }

  const assignedKeys = new Set<string>();
  const requiredKinds = villageSpecializationOrder
    .filter((kind) => villageEntries.some((entry) => {
      const option = getVillageSpecializationOptions(entry).find((item) => item.kind === kind);

      return Boolean(option && option.score > 0);
    }))
    .sort((left, right) => {
      const leftCandidates = villageEntries.filter((entry) => {
        const option = getVillageSpecializationOptions(entry).find((item) => item.kind === left);

        return Boolean(option && option.score > 0);
      }).length;
      const rightCandidates = villageEntries.filter((entry) => {
        const option = getVillageSpecializationOptions(entry).find((item) => item.kind === right);

        return Boolean(option && option.score > 0);
      }).length;

      return leftCandidates - rightCandidates;
    });

  requiredKinds.forEach((kind) => {
    const candidate = villageEntries
      .filter((entry) => !assignedKeys.has(getEntryKey(entry)))
      .flatMap((entry) => {
        const options = getVillageSpecializationOptions(entry);
        const option = options.find((item) => item.kind === kind);

        return option && option.score > 0 ? [{ entry, option, isPrimary: options[0]?.kind === kind }] : [];
      })
      .sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;

        return right.option.score - left.option.score;
      })[0];

    if (!candidate) return;

    const key = getEntryKey(candidate.entry);

    assignedKeys.add(key);
    counts[candidate.option.kind] += 1;
    result[key] = candidate.option;
  });

  villageEntries.forEach((entry) => {
    const key = getEntryKey(entry);

    if (assignedKeys.has(key)) return;

    const options = getVillageSpecializationOptions(entry);
    const realOptions = options.filter((option) => option.score > 0);
    const selected = realOptions.find((option) => counts[option.kind] < maxVillageSpecializationRepeats) || realOptions[0] || options[0];

    counts[selected.kind] += 1;
    result[key] = selected;
  });

  return result;
}

function renderVillageSpecializationBadge(entry: LeaderboardVillageEntry, selectedSpecialization?: VillageSpecialization) {
  const specialization = selectedSpecialization || getVillageSpecialization(entry);

  return (
    <span className={`${styles.villageSpecialization} ${specialization.className}`} title={specialization.label} aria-label={specialization.label}>
      {renderVillageSpecializationIcon(specialization.kind)}
    </span>
  );
}

function formatPlaytime(minutesValue: number) {
  const minutes = Number(minutesValue || 0);
  if (minutes <= 0) return '0ч';

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes > 0 ? `${hours}ч ${restMinutes}м` : `${hours}ч`;
}

function getOnline(entry: BoardEntry) {
  return formatPlaytime(Number(entry.totalPlaytimeMinutes || 0));
}

function getKd(entry: BoardEntry) {
  if (!isPlayerEntry(entry)) return getShortPoints(Number(entry.totalKills || 0));

  const kills = Number(entry.totalKills || 0);
  const divisor = Math.max(Number(entry.wipesPlayed || 1), 1);

  return (kills / divisor).toFixed(1);
}

function formatMembersCount(count: number) {
  const membersCount = Math.max(Math.trunc(Number(count || 0)), 0);
  const mod10 = membersCount % 10;
  const mod100 = membersCount % 100;
  const label = mod10 === 1 && mod100 !== 11
    ? 'участник'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? 'участника'
      : 'участников';

  return `${membersCount} ${label}`;
}

function getEntryMeta(entry: BoardEntry) {
  if (isPlayerEntry(entry)) return 'CHILL';

  const leaderName = entry.leaderName || 'неизвестно';

  return `Глава деревни: ${leaderName} • ${formatMembersCount(entry.membersCount)}`;
}

function getEntryTag(entry: BoardEntry) {
  if (isPlayerEntry(entry)) return entry.villageTag || null;

  return entry.villageId.toLowerCase() === entry.name.toLowerCase() ? null : entry.villageId;
}

function getCombatLabel(entry: BoardEntry) {
  return isPlayerEntry(entry) ? 'K/D' : 'Убийства';
}

function renderEntryTitle(entry: BoardEntry) {
  const entryTag = getEntryTag(entry);

  return (
    <>
      <span className={styles.entryName}>{entry.name}</span>
      {entryTag ? <span className={styles.villageTag}>{entryTag}</span> : null}
    </>
  );
}

function getBestPlayer(players: LeaderboardPlayerEntry[], getValue: (player: LeaderboardPlayerEntry) => number) {
  return players.reduce<LeaderboardPlayerEntry | null>((bestPlayer, player) => {
    if (!bestPlayer) return player;

    return getValue(player) > getValue(bestPlayer) ? player : bestPlayer;
  }, null);
}

function createLegendNomination(
  icon: string,
  title: string,
  players: LeaderboardPlayerEntry[],
  getValue: (player: LeaderboardPlayerEntry) => number,
  formatValue: (value: number) => string = getShortPoints,
  fallbackValue?: number,
): LegendNomination {
  const player = getBestPlayer(players, getValue);
  const value = player ? getValue(player) : 0;
  const displayValue = value > 0 ? value : (fallbackValue ?? value);

  return {
    icon,
    title,
    player,
    value: player ? formatValue(displayValue) : '-',
  };
}

function createUnavailableLegendNomination(icon: string, title: string): LegendNomination {
  return {
    icon,
    title,
    player: null,
    value: '-',
    unavailable: true,
  };
}

function normalizeLeaderboardPayload(payload: HallOfFamePayload | null | undefined, period: LeaderboardPeriod): HallOfFamePayload {
  if (!payload) {
    return { ...emptyLeaderboard, period };
  }

  return {
    period: payload.period || period,
    season: payload.season ?? null,
    players: Array.isArray(payload.players) ? payload.players : [],
    villages: Array.isArray(payload.villages) ? payload.villages : [],
    me: payload.me ?? null,
  };
}

export default function HallOfFame({ isOpen, onClose }: HallOfFameProps) {
  const [mode, setMode] = useState<BoardMode>('players');
  const [activeTab, setActiveTab] = useState<BoardTab>('players');
  const [period, setPeriod] = useState<LeaderboardPeriod>('season');
  const [searchQuery, setSearchQuery] = useState('');
  const [leaderboard, setLeaderboard] = useState<HallOfFamePayload>(emptyLeaderboard);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionSteamId, setSessionSteamId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/leaderboard?period=${period}&limit=10`, {
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.ok) {
          setLeaderboard(normalizeLeaderboardPayload(data.leaderboard, period));
        }
        setIsLoading(false);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setLeaderboard({ ...emptyLeaderboard, period });
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, period]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    fetch('/api/session', {
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setSessionSteamId(data?.steamId || null))
      .catch(() => setSessionSteamId(null));

    return () => controller.abort();
  }, [isOpen]);

  const isMyStatsTab = activeTab === 'my';
  const rows = useMemo(() => {
    if (isMyStatsTab) {
      return leaderboard.me ? [leaderboard.me] : [];
    }

    return mode === 'players' ? leaderboard.players : leaderboard.villages;
  }, [isMyStatsTab, leaderboard.me, leaderboard.players, leaderboard.villages, mode]);
  const filteredRows = useMemo(() => {
    if (isMyStatsTab) return rows;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((entry) => {
      const nameMatch = entry.name.toLowerCase().includes(query);
      const leaderMatch = !isPlayerEntry(entry) && entry.leaderName?.toLowerCase().includes(query);
      const tagMatch = getEntryTag(entry)?.toLowerCase().includes(query);

      return nameMatch || Boolean(leaderMatch) || Boolean(tagMatch);
    });
  }, [isMyStatsTab, rows, searchQuery]);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const legendNominations = useMemo(() => {
    const players = leaderboard.players;

    return [
      createLegendNomination('👑', 'Легенда Вайпа', players, (player) => player.totalPoints),
      createLegendNomination('☠️', 'Кровавый Убийца', players, (player) => Number(player.totalKills || 0)),
      createLegendNomination('💰', 'Король Фарма', players, (player) => Number(player.totalFarm || 0)),
      createLegendNomination('💣', 'Рейдер', players, (player) => Number(player.totalRaids || 0), getShortPoints, 14),
      createLegendNomination('📦', 'Пылесос Лута', players, (player) => Number(player.totalLoot || 0), getShortPoints, 320),
      createLegendNomination('🏗', 'Архитектор', players, (player) => Number(player.totalBuild || 0)),
    ];
  }, [leaderboard.players]);
  const podiumEntries = useMemo(() => isMyStatsTab ? [] : rows.slice(0, 3), [isMyStatsTab, rows]);
  const filteredVillageSpecializations = useMemo(() => getDistributedVillageSpecializations(filteredRows, !hasSearchQuery), [filteredRows, hasSearchQuery]);
  const podiumVillageSpecializations = useMemo(() => getDistributedVillageSpecializations(podiumEntries), [podiumEntries]);

  const selectTab = (tab: BoardTab) => {
    setActiveTab(tab);
    setSearchQuery('');

    if (tab === 'players' || tab === 'my') {
      setMode('players');
    }

    if (tab === 'villages') {
      setMode('villages');
    }
  };

  return (
    <section id="hall-of-fame" className={styles.hallOfFame}>
      {isOpen ? (
        <div className={styles.overlay} onClick={onClose}>
          <div className={styles.gameWindow} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Статистика RUST-WAY">
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Закрыть статистику">
              <span />
              <span />
            </button>

            <aside className={styles.heroesPanel}>
              <div className={styles.heroesHeader}>
                <span className={styles.panelLabel}>Герои сервера</span>
                <div className={styles.trophyStage} aria-hidden="true">
                  <span className={styles.trophyCup}>🏆</span>
                </div>
                <strong>Зал легенд</strong>
                <small>Только игроки выбранного периода</small>
              </div>

              <div className={styles.heroList}>
                {legendNominations.map((nomination) => (
                  <button
                    type="button"
                    key={`legend-${nomination.title}`}
                    className={styles.heroItem}
                    onClick={() => {
                      if (nomination.player) {
                        setMode('players');
                        setActiveTab('search');
                        setSearchQuery(nomination.player.name);
                      }
                    }}
                    disabled={!nomination.player}
                  >
                    <span className={styles.heroRank}>{nomination.icon}</span>
                    <span className={styles.heroName}>
                      <b>{nomination.title}</b>
                      <small>{nomination.unavailable ? 'Метрика не передаётся' : nomination.player?.name || (isLoading ? '...' : 'Нет данных')}</small>
                    </span>
                    <span className={`${styles.heroScore} ${nomination.unavailable ? styles.heroScoreMuted : ''}`}>{nomination.value}</span>
                  </button>
                ))}
              </div>
            </aside>

            <main className={styles.statsPanel}>
              <div className={styles.topControls}>
                <div className={styles.modeTabs} aria-label="Тип рейтинга">
                  <button type="button" className={activeTab === 'my' ? styles.active : ''} onClick={() => selectTab('my')}>Моя статистика</button>
                  <button type="button" className={activeTab === 'players' ? styles.active : ''} onClick={() => selectTab('players')}>Топ игроков</button>
                  <button type="button" className={activeTab === 'villages' ? styles.active : ''} onClick={() => selectTab('villages')}>Топ деревень</button>
                  <button type="button" className={activeTab === 'search' ? styles.active : ''} onClick={() => selectTab('search')}>Поиск</button>
                </div>

                <input
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveTab('search');
                  }}
                  placeholder={mode === 'players' ? 'Найти игрока' : 'Найти деревню'}
                />
              </div>

              <div className={styles.periods} aria-label="Период рейтинга">
                {periodOrder.map((periodKey) => (
                  <button key={periodKey} type="button" className={period === periodKey ? styles.active : ''} onClick={() => setPeriod(periodKey)}>
                    {periodLabels[periodKey]}
                  </button>
                ))}
              </div>

              {isMyStatsTab ? (
                <section className={styles.myStatsCard}>
                  {sessionSteamId ? (
                    leaderboard.me ? (
                      <>
                        <div className={styles.myStatsProfile}>
                          <span className={styles.myStatsAvatar}>{renderEntryAvatar(leaderboard.me)}</span>
                          <div>
                            <span>Моя статистика</span>
                            <strong>#{leaderboard.me.rank} {leaderboard.me.name}</strong>
                            <p>{periodLabels[period]}</p>
                          </div>
                        </div>
                        <div className={styles.myStatsMetrics}>
                          <span><b>Очки</b>{formatPoints(leaderboard.me.totalPoints)}</span>
                          <span><b>Лучший вайп</b>{formatPoints(leaderboard.me.bestPoints)}</span>
                          <span><b>Среднее</b>{formatPoints(leaderboard.me.averagePoints)}</span>
                          <span><b>K/D</b>{getKd(leaderboard.me)}</span>
                          <span><b>Farm</b>{formatPoints(getFarm(leaderboard.me))}</span>
                          <span><b>Online</b>{getOnline(leaderboard.me)}</span>
                          <span><b>Вайпы</b>{leaderboard.me.wipesPlayed}</span>
                          <span><b>Топ-3</b>{leaderboard.me.topThree}</span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.myStatsEmpty}>По выбранному периоду твоей статистики пока нет.</div>
                    )
                  ) : (
                    <div className={styles.myStatsEmpty}>Войди через Steam, чтобы увидеть личную статистику.</div>
                  )}
                </section>
              ) : null}

              {podiumEntries.length > 0 ? (
                <section className={styles.podiumGrid} aria-label="Top 3">
                  {podiumEntries.map((entry) => (
                    <button
                      type="button"
                      key={`podium-${getEntryKey(entry)}`}
                      className={`${styles.podiumCard} ${styles[`podiumRank${entry.rank}`] || ''}`}
                      onClick={() => setSearchQuery(entry.name)}
                    >
                      <span className={styles.podiumBadge}>{entry.rank}</span>
                      <span className={styles.podiumAvatar}>
                        {renderEntryAvatar(entry)}
                      </span>
                      {!isPlayerEntry(entry) ? (
                        <span className={styles.podiumSpecialization}>
                          {renderVillageSpecializationBadge(entry, podiumVillageSpecializations[getEntryKey(entry)])}
                        </span>
                      ) : null}
                      <strong className={!isPlayerEntry(entry) ? styles.villageTitle : undefined}>{renderEntryTitle(entry)}</strong>
                      <small>{getEntryMeta(entry)}</small>
                      <div className={styles.podiumStats}>
                        <span><b>{getCombatLabel(entry)}</b>{getKd(entry)}</span>
                        <span><b>Рейды</b>{formatPoints(getRaids(entry))}</span>
                        <span><b>Farm</b>{formatPoints(getFarm(entry))}</span>
                        <span><b>Online</b>{getOnline(entry)}</span>
                        <span><b>Очки</b>{formatPoints(entry.totalPoints)}</span>
                      </div>
                    </button>
                  ))}
                </section>
              ) : null}

              <div className={styles.tableWrap}>
                <div className={`${styles.tableHeader} ${mode === 'villages' ? styles.villageTable : ''}`}>
                  <span>#</span>
                  <span>{mode === 'players' ? 'Никнейм' : 'Деревня'}</span>
                  {mode === 'villages' ? <span>Стиль</span> : null}
                  <span>{mode === 'players' ? 'K/D' : 'Убийства'}</span>
                  <span>Рейды</span>
                  <span>Farm</span>
                  <span>Online</span>
                  <span>Очки</span>
                </div>

                {filteredRows.map((entry) => (
                  <button
                    type="button"
                    key={`${mode}-${getEntryKey(entry)}`}
                    className={`${styles.tableRow} ${mode === 'villages' ? styles.villageTable : ''} ${entry.rank <= 3 ? styles[`rank${entry.rank}`] : ''}`}
                    onClick={() => setSearchQuery(entry.name)}
                  >
                    <span>{entry.rank}</span>
                    <strong>
                      <span className={styles.avatar}>
                        {renderEntryAvatar(entry)}
                      </span>
                      <span className={styles.entryIdentity}>
                        <span className={styles.entryTitleLine}>{renderEntryTitle(entry)}</span>
                        {!isPlayerEntry(entry) ? <small>{getEntryMeta(entry)}</small> : null}
                      </span>
                    </strong>
                    {!isPlayerEntry(entry) ? (
                      <span className={styles.tableSpecialization}>
                        {renderVillageSpecializationBadge(entry, filteredVillageSpecializations[getEntryKey(entry)])}
                      </span>
                    ) : null}
                    <span>{getKd(entry)}</span>
                    <span>{formatPoints(getRaids(entry))}</span>
                    <span>{formatPoints(getFarm(entry))}</span>
                    <span>{getOnline(entry)}</span>
                    <span>{getShortPoints(entry.totalPoints)}</span>
                  </button>
                ))}

                {filteredRows.length === 0 && !isMyStatsTab ? (
                  <div className={styles.emptyState}>{isLoading ? 'Загрузка...' : 'Ничего не найдено.'}</div>
                ) : null}
              </div>
            </main>

            <aside className={styles.statsArt} aria-hidden="true">
              <span>ГЕРОЙ СЕРВЕРА</span>
              <small>RUST-WAY STATS</small>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
