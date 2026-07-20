'use client'

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';

import { ACTIVITY_FREE_COINS_REWARD } from '@/lib/activityReward';
import type {
  AdminBalanceAccount,
  AdminBalanceTransaction,
  AdminDashboardFilters,
  AdminDashboardResponse,
  AdminLog,
  AdminPlayerSearchResult,
  AdminPurchase,
  AdminTopDonor,
} from '@/types/admin';
import type { SupportTicket, SupportTicketStatus } from '@/types/support';
import CasesPanel from './CasesPanel';
import StorePanel from './StorePanel';
import styles from './page.module.scss';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const filterDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta) {
    return '—';
  }

  return JSON.stringify(meta, null, 2);
}

function formatBalanceKind(kind: string) {
  if (kind === 'credit') {
    return 'Пополнение';
  }

  if (kind === 'debit') {
    return 'Списание';
  }

  return kind;
}

function formatSignedCurrency(value: number) {
  const formatted = currencyFormatter.format(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatSignedNumber(value: number) {
  const formatted = formatCount(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatCount(value: number) {
  return numberFormatter.format(Math.max(0, value));
}

function formatProvider(value: string | null | undefined) {
  const provider = value?.trim().toLowerCase();

  if (provider === 'tbank') {
    return 'T-Bank';
  }

  if (provider === 'enot') {
    return 'ENOT';
  }

  if (provider === 'balance') {
    return 'Баланс';
  }

  if (provider === 'activity_reward') {
    return 'Бесплатные коины';
  }

  return value || '—';
}

function getPurchaseStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'paid') {
    return 'Оплачено';
  }

  if (normalized === 'pending') {
    return 'Ожидает';
  }

  if (normalized === 'failed' || normalized === 'provider_error') {
    return 'Ошибка';
  }

  if (normalized === 'expired') {
    return 'Истёк';
  }

  if (normalized === 'refunded') {
    return 'Возврат';
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'Отменено';
  }

  return status || '—';
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function stringifyMeta(meta: Record<string, unknown> | null | undefined) {
  return meta ? JSON.stringify(meta) : '';
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');

  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const csvRows = [
    headers.map(csvEscape).join(';'),
    ...rows.map((row) => row.map(csvEscape).join(';')),
  ];
  const blob = new Blob(['\uFEFF', csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function matchesTableSearch(query: string, values: unknown[]) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => normalizeText(value).includes(normalizedQuery));
}

type DashboardLegendItem = {
  label: string;
  description: string;
  value: number;
  displayValue: string;
  shareLabel: string;
  color: string;
};

type DashboardOverviewMetric = {
  label: string;
  value: string;
  badge: string;
  note: string;
  noteTone?: 'positive' | 'muted' | 'warning';
};

type DashboardBalanceItem = {
  label: string;
  value: string;
  note: string;
};

type AdminFilterFormState = Required<AdminDashboardFilters>;

type AdminTableFilters = {
  search: string;
};

type BalanceCreditFormState = {
  playerQuery: string;
  amount: string;
  reason: string;
};

type BalanceCreditPlayerOption = AdminPlayerSearchResult & {
  label: string;
};

type CopyHandler = (value: string, label: string) => void;

type AdminTicketsResponse = {
  ok: boolean;
  tickets?: SupportTicket[];
  ticket?: SupportTicket | null;
  error?: string;
};

type AdminView = 'dashboard' | 'tickets' | 'store' | 'cases';

const TICKETS_AUTO_REFRESH_INTERVAL_MS = 10_000;

const DEFAULT_FILTERS: AdminFilterFormState = {
  dateFrom: '',
  dateTo: '',
  steamId: '',
  provider: '',
  status: '',
};

const DEFAULT_TABLE_FILTERS: AdminTableFilters = {
  search: '',
};

const DEFAULT_BALANCE_CREDIT_FORM: BalanceCreditFormState = {
  playerQuery: '',
  amount: '',
  reason: '',
};

const providerFilterOptions = [
  { value: '', label: 'Все источники' },
  { value: 'tbank', label: 'T-Bank' },
  { value: 'enot', label: 'ENOT' },
  { value: 'balance', label: 'Баланс' },
  { value: 'activity_reward', label: 'Бесплатные коины' },
];

const statusFilterOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'paid', label: 'Оплачено' },
  { value: 'pending', label: 'Ожидает' },
  { value: 'failed', label: 'Ошибка' },
  { value: 'provider_error', label: 'Ошибка провайдера' },
  { value: 'expired', label: 'Истёк' },
  { value: 'refunded', label: 'Возврат' },
  { value: 'cancelled', label: 'Отменено' },
];

const supportTicketStatusLabels: Record<SupportTicketStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

function formatFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return filterDateFormatter.format(date);
}

function formatFilterPeriod(filters: AdminFilterFormState) {
  if (filters.dateFrom && filters.dateTo) {
    return `${formatFilterDate(filters.dateFrom)} - ${formatFilterDate(filters.dateTo)}`;
  }

  if (filters.dateFrom) {
    return `с ${formatFilterDate(filters.dateFrom)}`;
  }

  if (filters.dateTo) {
    return `до ${formatFilterDate(filters.dateTo)}`;
  }

  return 'всё время';
}

function getPercent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function createRewardDonutBackground(totalClaims: number, todayClaims: number) {
  const total = Math.max(0, totalClaims);
  const today = Math.min(Math.max(0, todayClaims), total);

  if (total <= 0) {
    return 'conic-gradient(rgba(255, 255, 255, 0.22) 0deg 360deg)';
  }

  const todayAngle = (today / total) * 360;

  return `conic-gradient(rgba(73, 192, 103, 0.95) 0deg ${todayAngle}deg, rgba(72, 114, 255, 0.86) ${todayAngle}deg 360deg)`;
}

function getMetricNoteClass(tone: DashboardOverviewMetric['noteTone'] | undefined, stylesMap: Record<string, string>) {
  if (tone === 'warning') {
    return stylesMap.overviewMetricNoteWarning;
  }

  if (tone === 'muted') {
    return stylesMap.overviewMetricNoteMuted;
  }

  return stylesMap.overviewMetricNotePositive;
}

function formatSteamIdShort(value: string) {
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getPlayerDisplayName(playerName: string | null | undefined, steamId: string | null | undefined) {
  return playerName?.trim() || steamId || '—';
}

function DashboardOverviewCard(props: {
  metrics: DashboardOverviewMetric[];
  providerLegend: DashboardLegendItem[];
  topDonors: AdminTopDonor[];
  balanceStats: DashboardBalanceItem[];
  paidRevenue: number;
  paidPurchases: number;
  totalPurchases: number;
  totalBalanceAllTime: number;
  balanceToday: number;
  freeRewardClaimsTotal: number;
  freeRewardClaimsToday: number;
  freeRewardCoinsIssued: number;
  freeRewardCoinsPerClaim: number;
}) {
  const {
    metrics,
    providerLegend,
    topDonors,
    balanceStats,
    paidRevenue,
    paidPurchases,
    totalPurchases,
    totalBalanceAllTime,
    balanceToday,
    freeRewardClaimsTotal,
    freeRewardClaimsToday,
    freeRewardCoinsIssued,
    freeRewardCoinsPerClaim,
  } = props;
  const donutStyle: CSSProperties = {
    backgroundImage: createRewardDonutBackground(freeRewardClaimsTotal, freeRewardClaimsToday),
  };
  const topProvider = providerLegend.reduce<DashboardLegendItem | null>((current, item) => {
    if (!current || item.value > current.value) {
      return item;
    }

    return current;
  }, null);
  const topProviderLabel = topProvider && topProvider.value > 0 ? topProvider.label : 'нет оплат';

  return (
    <article className={styles.overviewCard}>
      <div className={styles.overviewHeader}>
        <div>
          <p className={styles.overviewEyebrow}>Финансовая сводка</p>
          <h3>Рубли, коины и источники оплат</h3>
          <span>Разделение по реальным платежам, внутреннему балансу и бесплатным коинам.</span>
        </div>
        <div className={styles.overviewRevenueBadge}>
          <span>Оплачено рублями</span>
          <strong>{currencyFormatter.format(paidRevenue)}</strong>
          <small>{formatCount(paidPurchases)} из {formatCount(totalPurchases)} покупок</small>
        </div>
      </div>

      <div className={styles.overviewMetrics}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.overviewMetric}>
            <span className={styles.overviewMetricBadge}>{metric.badge}</span>
            <span className={styles.overviewMetricLabel}>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small className={`${styles.overviewMetricNote} ${getMetricNoteClass(metric.noteTone, styles)}`}>
              {metric.note}
            </small>
          </div>
        ))}
      </div>

      <div className={styles.overviewBody}>
        <div className={styles.overviewContent}>
          <section className={styles.overviewPanel}>
            <div className={styles.overviewPanelHeader}>
              <div>
                <h3>Откуда пришли ₽</h3>
                <p>Банк, платёжная система и покупки с внутреннего баланса.</p>
              </div>
              <span>Лидер: {topProviderLabel}</span>
            </div>

            <ul className={styles.overviewLegend}>
              {providerLegend.map((item) => (
                <li key={item.label}>
                  <span className={styles.overviewLegendDot} style={{ backgroundColor: item.color }} />
                  <span className={styles.overviewLegendText}>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className={styles.overviewLegendValue}>
                    <b>{item.displayValue}</b>
                    <em>{item.shareLabel}</em>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.overviewTopDonors}>
            <div className={styles.overviewTopDonorsHeader}>
              <h3>Топ донатеров по ₽</h3>
              <span>сумма реальных оплат</span>
            </div>
            {topDonors.length > 0 ? (
              <ol className={styles.overviewTopDonorList}>
                {topDonors.map((donor) => (
                  <li key={donor.userId} className={styles.overviewTopDonorItem}>
                    <span className={styles.overviewTopDonorUser} title={donor.userId}>
                      {getPlayerDisplayName(donor.userName, donor.userId)}
                    </span>
                    <span className={styles.overviewTopDonorMeta}>{formatCount(donor.purchasesCount)} покуп.</span>
                    <strong title="Сумма в рублях">{currencyFormatter.format(donor.totalAmount)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.overviewTopDonorsEmpty}>Нет оплаченных покупок по текущему фильтру.</p>
            )}
          </section>
        </div>

        <aside className={styles.overviewSide}>
          <section className={styles.overviewChartSection}>
            <div className={styles.overviewChartLabels}>
              <span className={styles.overviewChartLabelPrimary}>Бесплатные коины</span>
              <span className={styles.overviewChartLabelSecondary}>+{formatCount(freeRewardCoinsPerClaim)} коинов за выдачу</span>
            </div>

            <div className={styles.overviewDonut} style={donutStyle}>
              <div className={styles.overviewDonutInner}>
                <div className={`${styles.overviewDonutMetric} ${styles.overviewDonutMetricMuted}`}>
                  <span>Общий баланс</span>
                  <strong className={styles.overviewDonutAmount}>
                    <span>{formatCount(totalBalanceAllTime)}</span>
                    <em>₽</em>
                  </strong>
                </div>
                <div className={styles.overviewDonutMetric}>
                  <span>Сегодня закинули</span>
                  <strong className={`${styles.overviewDonutAmount} ${styles.overviewDonutPositive}`}>
                    <span>{formatSignedNumber(balanceToday)}</span>
                    <em>₽</em>
                  </strong>
                </div>
                <div className={`${styles.overviewDonutMetric} ${styles.overviewDonutMetricFreeCoins}`}>
                  <span>Бесплатные монеты</span>
                  <strong className={styles.overviewDonutAmount}>
                    <span>{formatCount(freeRewardClaimsTotal)}</span>
                    <em>шт.</em>
                  </strong>
                  <div className={styles.overviewDonutToday}>
                    <span>Сегодня</span>
                    <strong className={`${styles.overviewDonutAmount} ${styles.overviewDonutTodayValue}`}>
                      <span>{formatCount(freeRewardClaimsToday)}</span>
                      <em>шт.</em>
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.overviewBalancePanel}>
            <div className={styles.overviewPanelHeader}>
              <div>
                <h3>Баланс игроков</h3>
                <p>Все суммы баланса указаны в рублях.</p>
              </div>
            </div>

            <div className={styles.overviewBalanceGrid}>
              {balanceStats.map((item) => (
                <div key={item.label} className={styles.overviewBalanceItem}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}

function buildDashboardUrl(filters: AdminFilterFormState) {
  const params = new URLSearchParams();

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
  }

  if (filters.steamId) {
    params.set('steamId', filters.steamId);
  }

  if (filters.provider) {
    params.set('provider', filters.provider);
  }

  if (filters.status) {
    params.set('status', filters.status);
  }

  const query = params.toString();

  return query ? `/api/admin/dashboard?${query}` : '/api/admin/dashboard';
}

function PlayerCell({ name, steamId, onCopy }: { name?: string | null; steamId?: string | null; onCopy?: CopyHandler }) {
  const displayName = getPlayerDisplayName(name, steamId);

  return (
    <div className={styles.playerCell} title={steamId || displayName}>
      <strong>{displayName}</strong>
      {steamId ? (
        <span>
          {displayName !== steamId ? formatSteamIdShort(steamId) : 'Steam ID'}
          {onCopy ? <CopyButton value={steamId} label="Steam ID" onCopy={onCopy} /> : null}
        </span>
      ) : null}
    </div>
  );
}

function CopyButton({ value, label, onCopy }: { value: string | number; label: string; onCopy: CopyHandler }) {
  return (
    <button
      type="button"
      className={styles.copyButton}
      onClick={() => onCopy(String(value), label)}
      title={`Скопировать ${label}`}
    >
      копия
    </button>
  );
}

function MetaCell({ meta }: { meta: Record<string, unknown> | null | undefined }) {
  const value = formatMeta(meta);

  if (value === '—') {
    return <span className={styles.mutedCell}>—</span>;
  }

  return (
    <details className={styles.metaDetails}>
      <summary>Подробнее</summary>
      <pre className={styles.meta}>{value}</pre>
    </details>
  );
}

function getPurchaseStatusClass(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'paid' || normalized === 'completed' || normalized === 'success') {
    return styles.statusSuccess;
  }

  if (normalized === 'pending' || normalized === 'created') {
    return styles.statusPending;
  }

  if (normalized === 'failed' || normalized === 'provider_error' || normalized === 'expired') {
    return styles.statusDanger;
  }

  return styles.statusMuted;
}

function getBalanceKindClass(kind: string) {
  return kind === 'credit' ? styles.statusSuccess : styles.statusPending;
}

function hasActiveFilters(filters: AdminFilterFormState) {
  return Boolean(filters.dateFrom || filters.dateTo || filters.steamId || filters.provider || filters.status);
}

function PurchasesTable({ purchases, search, onCopy }: { purchases: AdminPurchase[]; search: string; onCopy: CopyHandler }) {
  const filteredPurchases = purchases.filter((purchase) =>
    matchesTableSearch(search, [
      purchase.id,
      purchase.userId,
      purchase.userName,
      purchase.itemType,
      purchase.amount,
      formatProvider(purchase.provider),
      getPurchaseStatusLabel(purchase.status),
      purchase.createdAt,
      stringifyMeta(purchase.meta),
    ])
  );

  if (purchases.length === 0) {
    return <p className={styles.emptyState}>Покупок пока нет.</p>;
  }

  if (filteredPurchases.length === 0) {
    return <p className={styles.emptyState}>Поиск ничего не нашёл в покупках.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Игрок</th>
            <th>Товар</th>
            <th>Сумма</th>
            <th>Провайдер</th>
            <th>Статус</th>
            <th>Создано</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {filteredPurchases.map((purchase) => (
            <tr key={purchase.id}>
              <td>{purchase.id} <CopyButton value={purchase.id} label="Purchase ID" onCopy={onCopy} /></td>
              <td><PlayerCell name={purchase.userName} steamId={purchase.userId} onCopy={onCopy} /></td>
              <td>{purchase.itemType}</td>
              <td>{currencyFormatter.format(purchase.amount)}</td>
              <td>{formatProvider(purchase.provider)}</td>
              <td>
                <span className={`${styles.status} ${getPurchaseStatusClass(purchase.status)}`}>
                  {getPurchaseStatusLabel(purchase.status)}
                </span>
              </td>
              <td>{formatDate(purchase.createdAt)}</td>
              <td><MetaCell meta={purchase.meta} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsTable({ logs, search, onCopy }: { logs: AdminLog[]; search: string; onCopy: CopyHandler }) {
  const filteredLogs = logs.filter((log) =>
    matchesTableSearch(search, [
      log.id,
      log.purchaseId,
      log.event,
      log.serverKey,
      log.createdAt,
      stringifyMeta(log.meta),
    ])
  );

  if (logs.length === 0) {
    return <p className={styles.emptyState}>Логи покупок пока пусты.</p>;
  }

  if (filteredLogs.length === 0) {
    return <p className={styles.emptyState}>Поиск ничего не нашёл в журнале.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Purchase ID</th>
            <th>Событие</th>
            <th>Источник</th>
            <th>Дата</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((log) => (
            <tr key={log.id}>
              <td>{log.id} <CopyButton value={log.id} label="Log ID" onCopy={onCopy} /></td>
              <td>
                {log.purchaseId ?? '—'}
                {log.purchaseId ? <CopyButton value={log.purchaseId} label="Purchase ID" onCopy={onCopy} /> : null}
              </td>
              <td>{log.event}</td>
              <td>{log.serverKey}</td>
              <td>{formatDate(log.createdAt)}</td>
              <td><MetaCell meta={log.meta} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceAccountsTable({ accounts, search, onCopy }: { accounts: AdminBalanceAccount[]; search: string; onCopy: CopyHandler }) {
  const filteredAccounts = accounts.filter((account) =>
    matchesTableSearch(search, [
      account.userSteamId,
      account.userName,
      account.balance,
      account.updatedAt,
    ])
  );

  if (accounts.length === 0) {
    return <p className={styles.emptyState}>Пользователей с положительным балансом пока нет.</p>;
  }

  if (filteredAccounts.length === 0) {
    return <p className={styles.emptyState}>Поиск ничего не нашёл в балансах.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Игрок</th>
            <th>Баланс</th>
            <th>Обновлён</th>
          </tr>
        </thead>
        <tbody>
          {filteredAccounts.map((account) => (
            <tr key={account.userSteamId}>
              <td><PlayerCell name={account.userName} steamId={account.userSteamId} onCopy={onCopy} /></td>
              <td>{currencyFormatter.format(account.balance)}</td>
              <td>{formatDate(account.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceTransactionsTable({ transactions, search, onCopy }: { transactions: AdminBalanceTransaction[]; search: string; onCopy: CopyHandler }) {
  const filteredTransactions = transactions.filter((transaction) =>
    matchesTableSearch(search, [
      transaction.id,
      transaction.userSteamId,
      transaction.userName,
      transaction.purchaseId,
      formatBalanceKind(transaction.kind),
      transaction.amount,
      transaction.createdAt,
      stringifyMeta(transaction.meta),
    ])
  );

  if (transactions.length === 0) {
    return <p className={styles.emptyState}>Операций по балансу пока нет.</p>;
  }

  if (filteredTransactions.length === 0) {
    return <p className={styles.emptyState}>Поиск ничего не нашёл в операциях баланса.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Игрок</th>
            <th>Purchase ID</th>
            <th>Операция</th>
            <th>Сумма</th>
            <th>Дата</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.id} <CopyButton value={transaction.id} label="ID операции" onCopy={onCopy} /></td>
              <td><PlayerCell name={transaction.userName} steamId={transaction.userSteamId} onCopy={onCopy} /></td>
              <td>
                {transaction.purchaseId ?? '—'}
                {transaction.purchaseId ? <CopyButton value={transaction.purchaseId} label="Purchase ID" onCopy={onCopy} /> : null}
              </td>
              <td>
                <span className={`${styles.status} ${getBalanceKindClass(transaction.kind)}`}>
                  {formatBalanceKind(transaction.kind)}
                </span>
              </td>
              <td className={transaction.amount >= 0 ? styles.amountPositive : styles.amountNegative}>
                {formatSignedCurrency(transaction.amount)}
              </td>
              <td>{formatDate(transaction.createdAt)}</td>
              <td><MetaCell meta={transaction.meta} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getTicketStatusClass(status: SupportTicketStatus) {
  if (status === 'open') {
    return styles.ticketStatusOpen;
  }

  if (status === 'in_progress') {
    return styles.ticketStatusInProgress;
  }

  if (status === 'resolved') {
    return styles.ticketStatusResolved;
  }

  return styles.ticketStatusClosed;
}

function AdminTicketsPanel(props: {
  tickets: SupportTicket[];
  selectedTicketId: number | null;
  replyText: string;
  statusMessage: string;
  isSubmitting: boolean;
  onSelectTicket: (ticketId: number) => void;
  onReplyChange: (value: string) => void;
  onSendReply: () => void;
  onChangeStatus: (status: SupportTicketStatus) => void;
}) {
  const {
    tickets,
    selectedTicketId,
    replyText,
    statusMessage,
    isSubmitting,
    onSelectTicket,
    onReplyChange,
    onSendReply,
    onChangeStatus,
  } = props;
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) || tickets[0] || null;
  const selectedTicketPlayerName = selectedTicket ? getPlayerDisplayName(selectedTicket.userName, selectedTicket.userSteamId) : '';

  return (
    <div className={styles.ticketPanel}>
      <div className={styles.ticketList}>
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            id={`ticket-${ticket.id}`}
            type="button"
            className={`${styles.ticketListItem} ${selectedTicket?.id === ticket.id ? styles.ticketListItemActive : ''}`}
            onClick={() => onSelectTicket(ticket.id)}
          >
            <span className={styles.ticketListTitle}>#{ticket.id} {ticket.subject}</span>
            <span className={styles.ticketListMeta} title={ticket.userSteamId}>
              {getPlayerDisplayName(ticket.userName, ticket.userSteamId)} · {formatDate(ticket.lastMessageAt)}
            </span>
            <span className={`${styles.ticketStatus} ${getTicketStatusClass(ticket.status)}`}>
              {supportTicketStatusLabels[ticket.status]}
            </span>
          </button>
        ))}
        {tickets.length === 0 ? <p className={styles.emptyState}>Тикетов пока нет.</p> : null}
      </div>

      {selectedTicket ? (
        <article className={styles.ticketDetails}>
          <div className={styles.ticketDetailsHeader}>
            <div>
              <h3>#{selectedTicket.id} {selectedTicket.subject}</h3>
              <p title={selectedTicket.userSteamId}>Игрок: {selectedTicketPlayerName} · создан: {formatDate(selectedTicket.createdAt)}</p>
            </div>
            <span className={`${styles.ticketStatus} ${getTicketStatusClass(selectedTicket.status)}`}>
              {supportTicketStatusLabels[selectedTicket.status]}
            </span>
          </div>

          <div className={styles.ticketMessages}>
            {selectedTicket.messages.map((message) => (
              <div key={message.id} className={`${styles.ticketMessage} ${styles[`ticketMessage_${message.authorRole}`] || ''}`}>
                <div className={styles.ticketMessageMeta}>
                  <strong>
                    {message.authorRole === 'admin'
                      ? 'Админ'
                      : message.authorRole === 'system'
                        ? 'Система'
                        : getPlayerDisplayName(message.authorName, message.authorSteamId)}
                  </strong>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p>{message.message}</p>
              </div>
            ))}
          </div>

          <div className={styles.ticketStatusActions}>
            {(['open', 'in_progress', 'resolved', 'closed'] as SupportTicketStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={styles.secondaryButton}
                onClick={() => onChangeStatus(status)}
                disabled={isSubmitting || selectedTicket.status === status}
              >
                {supportTicketStatusLabels[status]}
              </button>
            ))}
          </div>

          {selectedTicket.status !== 'closed' ? (
            <div className={styles.ticketReplyBox}>
              <textarea
                value={replyText}
                onChange={(event) => onReplyChange(event.target.value)}
                placeholder="Ответ админа игроку"
                maxLength={3000}
              />
              <button className={styles.primaryButton} type="button" onClick={onSendReply} disabled={isSubmitting || replyText.trim().length < 2}>
                Ответить
              </button>
            </div>
          ) : null}

          {statusMessage ? <p className={styles.ticketNotice}>{statusMessage}</p> : null}
        </article>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminFilterFormState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdminFilterFormState>(DEFAULT_FILTERS);
  const [tableFilters, setTableFilters] = useState<AdminTableFilters>(DEFAULT_TABLE_FILTERS);
  const [copyMessage, setCopyMessage] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [balanceCreditForm, setBalanceCreditForm] = useState<BalanceCreditFormState>(DEFAULT_BALANCE_CREDIT_FORM);
  const [balanceCreditMessage, setBalanceCreditMessage] = useState('');
  const [balanceCreditSubmitting, setBalanceCreditSubmitting] = useState(false);
  const [balanceCreditPlayers, setBalanceCreditPlayers] = useState<BalanceCreditPlayerOption[]>([]);
  const [balanceCreditSearchLoading, setBalanceCreditSearchLoading] = useState(false);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) {
      setTicketsLoading(true);
      setTicketMessage('');
    }

    try {
      const response = await fetch('/api/admin/tickets', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await response.json().catch(() => null)) as AdminTicketsResponse | null;

      if (!response.ok || !json?.ok) {
        setTicketMessage(json?.error || 'Не удалось загрузить тикеты.');
        return;
      }

      const nextTickets = json.tickets || [];
      setTickets(nextTickets);
      setSelectedTicketId((current) => {
        if (current && nextTickets.some((ticket) => ticket.id === current)) {
          return current;
        }

        return nextTickets[0]?.id ?? null;
      });
    } catch {
      if (!silent) {
        setTicketMessage('Не удалось загрузить тикеты.');
      }
    } finally {
      if (!silent) {
        setTicketsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(buildDashboardUrl(appliedFilters), {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as AdminDashboardResponse | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !json) {
          setError(json?.error || 'Не удалось загрузить админ-панель.');
          return;
        }

        setData(json);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Не удалось загрузить админ-панель.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, refreshIndex]);

  useEffect(() => {
    if (data?.isAuthenticated && data.isAdmin) {
      void loadTickets();
    }
  }, [data?.isAuthenticated, data?.isAdmin, loadTickets]);

  useEffect(() => {
    if (!data?.isAuthenticated || !data.isAdmin) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadTickets(true);
    }, TICKETS_AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [data?.isAuthenticated, data?.isAdmin, loadTickets]);

  function replaceTicket(ticket: SupportTicket) {
    setTickets((current) => current.map((item) => item.id === ticket.id ? ticket : item));
    setSelectedTicketId(ticket.id);
  }

  async function handleSendTicketReply() {
    const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

    if (!selectedTicket || ticketReply.trim().length < 2) {
      return;
    }

    setTicketSubmitting(true);
    setTicketMessage('');

    try {
      const response = await fetch(`/api/admin/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: ticketReply }),
      });
      const json = (await response.json().catch(() => null)) as AdminTicketsResponse | null;

      if (!response.ok || !json?.ok || !json.ticket) {
        setTicketMessage(json?.error || 'Не удалось отправить ответ.');
        return;
      }

      replaceTicket(json.ticket);
      setTicketReply('');
      setTicketMessage('Ответ отправлен.');
    } catch {
      setTicketMessage('Не удалось отправить ответ.');
    } finally {
      setTicketSubmitting(false);
    }
  }

  async function handleChangeTicketStatus(status: SupportTicketStatus) {
    const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

    if (!selectedTicket) {
      return;
    }

    setTicketSubmitting(true);
    setTicketMessage('');

    try {
      const response = await fetch(`/api/admin/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json().catch(() => null)) as AdminTicketsResponse | null;

      if (!response.ok || !json?.ok || !json.ticket) {
        setTicketMessage(json?.error || 'Не удалось изменить статус.');
        return;
      }

      replaceTicket(json.ticket);
      setTicketMessage('Статус обновлён.');
    } catch {
      setTicketMessage('Не удалось изменить статус.');
    } finally {
      setTicketSubmitting(false);
    }
  }

  function handleFiltersSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextFilters: AdminFilterFormState = {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      steamId: filters.steamId.replace(/\D/g, '').slice(0, 32),
      provider: filters.provider,
      status: filters.status,
    };

    if (nextFilters.dateFrom && nextFilters.dateTo && nextFilters.dateFrom > nextFilters.dateTo) {
      [nextFilters.dateFrom, nextFilters.dateTo] = [nextFilters.dateTo, nextFilters.dateFrom];
    }

    setLoading(true);
    setError(null);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }

  function handleFiltersReset() {
    setLoading(true);
    setError(null);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  function handleRefreshDashboard() {
    setLoading(true);
    setError(null);
    setRefreshIndex((current) => current + 1);
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} скопирован`);
    } catch {
      setCopyMessage(`Не удалось скопировать ${label}`);
    }

    window.setTimeout(() => setCopyMessage(''), 1800);
  }

  const knownPlayers = (() => {
    const players = new Map<string, { steamId: string; name: string }>();
    const addPlayer = (steamId?: string | null, name?: string | null) => {
      if (!steamId) return;

      players.set(steamId, {
        steamId,
        name: getPlayerDisplayName(name, steamId),
      });
    };

    data?.balanceAccounts?.forEach((account) => addPlayer(account.userSteamId, account.userName));
    data?.balanceTransactions?.forEach((transaction) => addPlayer(transaction.userSteamId, transaction.userName));
    data?.purchases?.forEach((purchase) => addPlayer(purchase.userId, purchase.userName));
    data?.topDonors?.forEach((donor) => addPlayer(donor.userId, donor.userName));

    return Array.from(players.values()).sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  })();

  useEffect(() => {
    const query = balanceCreditForm.playerQuery.trim();

    if (query.length < 2) {
      setBalanceCreditPlayers([]);
      setBalanceCreditSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setBalanceCreditSearchLoading(true);

      try {
        const response = await fetch(`/api/admin/player-search?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as { ok?: boolean; players?: AdminPlayerSearchResult[] } | null;

        if (!response.ok || !json?.ok) {
          setBalanceCreditPlayers([]);
          return;
        }

        setBalanceCreditPlayers((json.players || []).map((player) => ({
          ...player,
          label: `${getPlayerDisplayName(player.name, player.steamId)} · ${formatSteamIdShort(player.steamId)} · ${currencyFormatter.format(player.balance)}`,
        })));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setBalanceCreditPlayers([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setBalanceCreditSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [balanceCreditForm.playerQuery]);

  function resolveBalanceCreditSteamId() {
    const query = balanceCreditForm.playerQuery.trim();
    const onlyDigits = query.replace(/\D/g, '');

    if (/^7656119\d{10}$/.test(onlyDigits)) {
      return onlyDigits;
    }

    const normalizedQuery = normalizeText(query);
    const searchExactMatch = balanceCreditPlayers.find((player) =>
      normalizeText(player.name || '') === normalizedQuery
      || normalizeText(player.label) === normalizedQuery
      || player.steamId === onlyDigits
    );

    if (searchExactMatch) {
      return searchExactMatch.steamId;
    }

    const searchPartialMatch = balanceCreditPlayers.find((player) =>
      normalizeText(player.name || '').includes(normalizedQuery)
      || normalizeText(player.label).includes(normalizedQuery)
    );

    if (searchPartialMatch) {
      return searchPartialMatch.steamId;
    }

    const exactMatch = knownPlayers.find((player) =>
      normalizeText(player.name) === normalizedQuery || player.steamId === onlyDigits
    );

    if (exactMatch) {
      return exactMatch.steamId;
    }

    const partialMatch = knownPlayers.find((player) => normalizeText(player.name).includes(normalizedQuery));

    return partialMatch?.steamId || '';
  }

  async function handleBalanceCreditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userSteamId = resolveBalanceCreditSteamId();
    const amount = Number(balanceCreditForm.amount);

    if (!userSteamId) {
      setBalanceCreditMessage('Игрок не найден. Введите Steam ID 7656119... или выберите ник из списка.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setBalanceCreditMessage('Укажите сумму больше нуля.');
      return;
    }

    setBalanceCreditSubmitting(true);
    setBalanceCreditMessage('');

    try {
      const response = await fetch('/api/admin/balance-credit', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userSteamId,
          amount,
          reason: balanceCreditForm.reason,
        }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        setBalanceCreditMessage(json?.error || 'Не удалось начислить баланс.');
        return;
      }

      setBalanceCreditMessage(`Начислено ${currencyFormatter.format(amount)}. Новый баланс: ${currencyFormatter.format(json.balance || 0)}.`);
      setBalanceCreditForm(DEFAULT_BALANCE_CREDIT_FORM);
      handleRefreshDashboard();
    } catch {
      setBalanceCreditMessage('Не удалось начислить баланс.');
    } finally {
      setBalanceCreditSubmitting(false);
    }
  }

  function exportPurchasesCsv() {
    downloadCsv('admin-purchases.csv', ['ID', 'Игрок', 'Steam ID', 'Товар', 'Сумма ₽', 'Провайдер', 'Статус', 'Создано', 'Meta'], (data?.purchases || []).map((purchase) => [
      purchase.id,
      getPlayerDisplayName(purchase.userName, purchase.userId),
      purchase.userId || '',
      purchase.itemType,
      purchase.amount,
      formatProvider(purchase.provider),
      getPurchaseStatusLabel(purchase.status),
      purchase.createdAt,
      stringifyMeta(purchase.meta),
    ]));
  }

  function exportBalancesCsv() {
    downloadCsv('admin-balances.csv', ['Игрок', 'Steam ID', 'Баланс ₽', 'Обновлён'], (data?.balanceAccounts || []).map((account) => [
      getPlayerDisplayName(account.userName, account.userSteamId),
      account.userSteamId,
      account.balance,
      account.updatedAt,
    ]));
  }

  function exportBalanceTransactionsCsv() {
    downloadCsv('admin-balance-transactions.csv', ['ID', 'Игрок', 'Steam ID', 'Purchase ID', 'Операция', 'Сумма ₽', 'Дата', 'Meta'], (data?.balanceTransactions || []).map((transaction) => [
      transaction.id,
      getPlayerDisplayName(transaction.userName, transaction.userSteamId),
      transaction.userSteamId,
      transaction.purchaseId || '',
      formatBalanceKind(transaction.kind),
      transaction.amount,
      transaction.createdAt,
      stringifyMeta(transaction.meta),
    ]));
  }

  function exportLogsCsv() {
    downloadCsv('admin-logs.csv', ['ID', 'Purchase ID', 'Событие', 'Источник', 'Дата', 'Meta'], (data?.logs || []).map((log) => [
      log.id,
      log.purchaseId || '',
      log.event,
      log.serverKey,
      log.createdAt,
      stringifyMeta(log.meta),
    ]));
  }

  const summary = data?.summary;
  const filtersApplied = hasActiveFilters(appliedFilters);
  const totalPurchases = summary?.totalPurchases ?? 0;
  const paidPurchases = summary?.paidPurchases ?? 0;
  const failedPurchases = summary?.failedPurchases ?? 0;
  const totalRevenue = summary?.totalRevenue ?? 0;
  const paidRevenue = summary?.paidRevenue ?? 0;
  const tbankPaidRevenue = summary?.tbankPaidRevenue ?? 0;
  const enotPaidRevenue = summary?.enotPaidRevenue ?? 0;
  const balancePaidRevenue = summary?.balancePaidRevenue ?? 0;
  const balanceToday = summary?.balanceToday ?? 0;
  const uniqueBuyers = summary?.uniqueBuyers ?? 0;
  const totalLogs = summary?.totalLogs ?? 0;
  const totalBalanceHolders = summary?.totalBalanceHolders ?? 0;
  const totalOutstandingBalance = summary?.totalOutstandingBalance ?? 0;
  const totalBalanceTransactions = summary?.totalBalanceTransactions ?? 0;
  const creditedBalance = summary?.creditedBalance ?? 0;
  const debitedBalance = summary?.debitedBalance ?? 0;
  const freeRewardClaims = summary?.freeRewardClaims ?? 0;
  const freeRewardClaimsTotal = summary?.freeRewardClaimsTotal ?? freeRewardClaims;
  const freeRewardClaimsToday = summary?.freeRewardClaimsToday ?? 0;
  const topDonors = data?.topDonors ?? [];
  const freeRewardCoinsIssued = freeRewardClaims * ACTIVITY_FREE_COINS_REWARD.coinsAmount;
  const freeRewardCoinsIssuedTotal = freeRewardClaimsTotal * ACTIVITY_FREE_COINS_REWARD.coinsAmount;
  const bankPaidRevenue = tbankPaidRevenue + enotPaidRevenue;
  const paidShare = getPercent(paidPurchases, totalPurchases);
  const failureShare = getPercent(failedPurchases, totalPurchases);
  const rewardShare = getPercent(freeRewardClaims, totalPurchases);
  const balanceSpendShare = getPercent(debitedBalance, creditedBalance);
  const getProviderShareLabel = (value: number) => {
    const share = clampPercent(getPercent(value, paidRevenue));

    return `${share}% от оплаченных ₽`;
  };
  const dashboardBadges = [
    `Период: ${formatFilterPeriod(appliedFilters)}`,
    appliedFilters.steamId ? `Steam ID: ${appliedFilters.steamId}` : 'Steam ID: все игроки',
    filtersApplied ? 'Показан отфильтрованный срез' : 'Показан общий срез по проекту',
  ];
  const overviewMetrics: DashboardOverviewMetric[] = [
    {
      badge: '₽',
      label: 'Рубли от оплат',
      value: currencyFormatter.format(paidRevenue),
      note: `${formatCount(paidPurchases)} успешных покупок из ${formatCount(totalPurchases)}`,
      noteTone: 'positive',
    },
    {
      badge: 'Банк',
      label: 'Банк и платёжки',
      value: currencyFormatter.format(bankPaidRevenue),
      note: `T-Bank + ENOT, без оплат с внутреннего баланса`,
      noteTone: 'muted',
    },
    {
      badge: 'Коины',
      label: 'Бесплатные коины',
      value: formatCount(freeRewardCoinsIssued),
      note: `${formatCount(freeRewardClaims)} выдач по ${formatCount(ACTIVITY_FREE_COINS_REWARD.coinsAmount)} коинов`,
      noteTone: 'positive',
    },
    {
      badge: 'Статус',
      label: 'Проблемные оплаты',
      value: formatCount(failedPurchases),
      note: `${failureShare}% от всех записей`,
      noteTone: failedPurchases > 0 ? 'warning' : 'muted',
    },
  ];
  const providerLegend: DashboardLegendItem[] = [
    {
      label: 'T-Bank',
      description: 'банк, реальные рубли',
      value: tbankPaidRevenue,
      displayValue: currencyFormatter.format(tbankPaidRevenue),
      shareLabel: getProviderShareLabel(tbankPaidRevenue),
      color: '#5f89ff',
    },
    {
      label: 'ENOT',
      description: 'платёжная система, реальные рубли',
      value: enotPaidRevenue,
      displayValue: currencyFormatter.format(enotPaidRevenue),
      shareLabel: getProviderShareLabel(enotPaidRevenue),
      color: '#ff9248',
    },
    {
      label: 'С баланса',
      description: 'покупки за внутренний баланс игрока',
      value: balancePaidRevenue,
      displayValue: currencyFormatter.format(balancePaidRevenue),
      shareLabel: getProviderShareLabel(balancePaidRevenue),
      color: '#89e8ff',
    },
  ];
  const balanceStats: DashboardBalanceItem[] = [
    {
      label: 'Пополнено',
      value: currencyFormatter.format(creditedBalance),
      note: 'реальные ₽ зачислены на баланс',
    },
    {
      label: 'Списано',
      value: currencyFormatter.format(debitedBalance),
      note: `${balanceSpendShare}% от всех пополнений потрачено`,
    },
    {
      label: 'Остаток',
      value: currencyFormatter.format(totalOutstandingBalance),
      note: `${formatCount(totalBalanceHolders)} игроков с балансом`,
    },
    {
      label: 'Сегодня',
      value: currencyFormatter.format(balanceToday),
      note: 'пополнения баланса за текущие сутки',
    },
  ];
  const summaryCards = [
    {
      label: 'Всего покупок',
      value: formatCount(totalPurchases),
      note: 'включая бесплатные выдачи и нулевые покупки',
    },
    {
      label: 'Оплачено',
      value: formatCount(paidPurchases),
      note: `${paidShare}% успешных записей`,
    },
    {
      label: 'Проблемных',
      value: formatCount(failedPurchases),
      note: `${failureShare}% от всех покупок`,
    },
    {
      label: 'Оборот',
      value: currencyFormatter.format(totalRevenue),
      note: 'сумма по всем purchase-записям',
    },
    {
      label: 'Оплаченный оборот',
      value: currencyFormatter.format(paidRevenue),
      note: 'реально оплаченные покупки',
    },
    {
      label: 'Уникальных покупателей',
      value: formatCount(uniqueBuyers),
      note: 'по текущему фильтру',
    },
    {
      label: 'Событий в журнале',
      value: formatCount(totalLogs),
      note: 'создания платежей, webhook и смены статусов',
    },
    {
      label: 'Аккаунтов с балансом',
      value: formatCount(totalBalanceHolders),
      note: 'у кого сейчас баланс выше нуля',
    },
    {
      label: 'Средств на балансах',
      value: currencyFormatter.format(totalOutstandingBalance),
      note: 'остаток денег у игроков',
    },
    {
      label: 'Операций баланса',
      value: formatCount(totalBalanceTransactions),
      note: 'пополнения и списания',
    },
    {
      label: 'Пополнено',
      value: currencyFormatter.format(creditedBalance),
      note: 'всего зачислено на баланс',
    },
    {
      label: 'Списано',
      value: currencyFormatter.format(debitedBalance),
      note: `игроки уже потратили ${balanceSpendShare}% от пополнений`,
    },
    {
      label: 'Бесплатных 25 монет',
      value: formatCount(freeRewardClaims),
      note: `${rewardShare}% от всех записей, выдано ${formatCount(freeRewardCoinsIssued)} монет`,
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Rust Way Admin</p>
            <h1 className={styles.title}>Админ-панель проекта</h1>
            <p className={styles.description}>
              Доступ определяется по Steam ID. Здесь можно смотреть покупки, балансы пользователей, операции списания и журнал событий оплаты.
            </p>
          </div>
          <div className={styles.actions}>
            <div className={styles.actionButtons}>
              <Link className={styles.linkButton} href="/">
                На главную
              </Link>
              <button
                className={`${styles.linkButton} ${adminView === 'dashboard' ? styles.linkButtonActive : ''}`}
                type="button"
                onClick={() => setAdminView('dashboard')}
              >
                Дашборд
              </button>
              <button
                className={`${styles.linkButton} ${adminView === 'tickets' ? styles.linkButtonActive : ''}`}
                type="button"
                onClick={() => setAdminView('tickets')}
              >
                Тикеты
              </button>
              <button
                className={`${styles.linkButton} ${adminView === 'cases' ? styles.linkButtonActive : ''}`}
                type="button"
                onClick={() => setAdminView('cases')}
              >
                Кейсы
              </button>
              <button
                className={`${styles.linkButton} ${adminView === 'store' ? styles.linkButtonActive : ''}`}
                type="button"
                onClick={() => setAdminView('store')}
              >
                Магазин
              </button>
              <button className={styles.secondaryButton} type="button" onClick={handleRefreshDashboard} disabled={loading}>
                Обновить
              </button>
            </div>
            {data?.steamId ? <div className={styles.steamBadge}>Steam ID: {data.steamId}</div> : null}
            {copyMessage ? <div className={styles.copyNotice}>{copyMessage}</div> : null}
          </div>
        </div>

        {loading ? (
          <section className={styles.stateCard}>
            <h2>Загрузка</h2>
            <p>Подтягиваю сводку по покупкам, балансам и логам.</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className={styles.stateCard}>
            <h2>Ошибка</h2>
            <p>{error}</p>
          </section>
        ) : null}

        {!loading && !error && data && !data.isAuthenticated ? (
          <section className={styles.stateCard}>
            <h2>Нужна авторизация</h2>
            <p>Войдите через Steam, чтобы продолжить.</p>
            <Link className={styles.primaryButton} href="/api/steam/login">
              Войти через Steam
            </Link>
          </section>
        ) : null}

        {!loading && !error && data?.isAuthenticated && !data.isAdmin ? (
          <section className={styles.stateCard}>
            <h2>Доступ запрещён</h2>
            <p>
              Текущий Steam ID не входит в список администраторов. Разрешённые ID задаются через переменную окружения ADMIN_STEAM_IDS.
            </p>
          </section>
        ) : null}

        {!loading && !error && data?.isAuthenticated && data.isAdmin ? (
          <>
            {!data.databaseConfigured ? (
              <section className={styles.warningCard}>
                <h2>База данных недоступна</h2>
                <p>
                  Postgres сейчас не подключён или недоступен. Админка уже защищена по Steam ID, а таблицы с покупками и логами появятся, когда база станет доступна.
                </p>
              </section>
            ) : null}

            {adminView === 'cases' ? (
              <CasesPanel />
            ) : adminView === 'store' ? (
              <StorePanel />
            ) : adminView === 'tickets' ? (
              <section className={styles.panelSection}>
                <div className={styles.sectionHeader}>
                  <h2>Тикеты игроков</h2>
                  <p>{ticketsLoading ? 'Загружаю обращения игроков.' : 'Ответы администратора и смена статуса тикета.'}</p>
                </div>
                <AdminTicketsPanel
                  tickets={tickets}
                  selectedTicketId={selectedTicketId}
                  replyText={ticketReply}
                  statusMessage={ticketMessage}
                  isSubmitting={ticketSubmitting || ticketsLoading}
                  onSelectTicket={(ticketId) => {
                    setSelectedTicketId(ticketId);
                    setTicketMessage('');
                  }}
                  onReplyChange={setTicketReply}
                  onSendReply={() => void handleSendTicketReply()}
                  onChangeStatus={(status) => void handleChangeTicketStatus(status)}
                />
              </section>
            ) : (
              <>
            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <h2>Фильтры</h2>
                <p>Выбери период, игрока, источник оплаты и статус транзакций.</p>
              </div>

              <form className={styles.filterForm} onSubmit={handleFiltersSubmit}>
                <label className={styles.filterField}>
                  <span>Дата от</span>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                  />
                </label>

                <label className={styles.filterField}>
                  <span>Дата до</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                  />
                </label>

                <label className={`${styles.filterField} ${styles.filterFieldWide}`}>
                  <span>Поиск по Steam ID</span>
                  <input
                    type="search"
                    inputMode="numeric"
                    placeholder="7656119..."
                    value={filters.steamId}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        steamId: event.target.value.replace(/\D/g, '').slice(0, 32),
                      }))
                    }
                  />
                </label>

                <label className={styles.filterField}>
                  <span>Источник оплаты</span>
                  <select
                    value={filters.provider}
                    onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}
                  >
                    {providerFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.filterField}>
                  <span>Статус</span>
                  <select
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <div className={styles.filterActions}>
                  <button className={styles.primaryButton} type="submit">
                    Применить
                  </button>
                  <button className={styles.secondaryButton} type="button" onClick={handleFiltersReset}>
                    Сбросить
                  </button>
                </div>
              </form>

              <p className={styles.filterMeta}>
                {filtersApplied
                  ? 'Сводка и таблицы уже отфильтрованы по выбранному периоду, Steam ID, источнику и статусу. Плитка “Баланс сегодня” всегда показывает пополнения за текущие сутки.'
                  : 'По дате фильтруются покупки, логи и операции по балансу. Steam ID, источник и статус применяются к связанным платежам.'}
              </p>
            </section>

            <section className={styles.panelSection}>
              <div className={styles.sectionHeader}>
                <h2>Начислить баланс игроку</h2>
                <p>Найди игрока по нику из загруженных таблиц или введи Steam ID вручную.</p>
              </div>

              <form className={styles.filterForm} onSubmit={handleBalanceCreditSubmit}>
                <label className={`${styles.filterField} ${styles.filterFieldWide}`}>
                  <span>Игрок или Steam ID</span>
                  <input
                    type="search"
                    list="admin-known-players"
                    placeholder="Ник или 7656119..."
                    value={balanceCreditForm.playerQuery}
                    onChange={(event) => setBalanceCreditForm((current) => ({ ...current, playerQuery: event.target.value }))}
                  />
                  <datalist id="admin-known-players">
                    {balanceCreditPlayers.map((player) => (
                      <option key={`search-${player.steamId}`} value={player.name || player.steamId}>
                        {player.steamId}
                      </option>
                    ))}
                    {knownPlayers.map((player) => (
                      <option key={`known-${player.steamId}`} value={player.name}>
                        {player.steamId}
                      </option>
                    ))}
                  </datalist>
                </label>

                <label className={styles.filterField}>
                  <span>Сумма</span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    placeholder="100"
                    value={balanceCreditForm.amount}
                    onChange={(event) => setBalanceCreditForm((current) => ({ ...current, amount: event.target.value }))}
                  />
                </label>

                <label className={styles.filterField}>
                  <span>Причина</span>
                  <input
                    type="text"
                    maxLength={240}
                    placeholder="Бонус, компенсация..."
                    value={balanceCreditForm.reason}
                    onChange={(event) => setBalanceCreditForm((current) => ({ ...current, reason: event.target.value }))}
                  />
                </label>

                <div className={styles.filterActions}>
                  <button className={styles.primaryButton} type="submit" disabled={balanceCreditSubmitting}>
                    {balanceCreditSubmitting ? 'Начисляю...' : 'Начислить'}
                  </button>
                </div>
              </form>

              {balanceCreditPlayers.length > 0 ? (
                <div className={styles.filterActions}>
                  {balanceCreditPlayers.slice(0, 5).map((player) => (
                    <button
                      key={player.steamId}
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => setBalanceCreditForm((current) => ({ ...current, playerQuery: player.name || player.steamId }))}
                    >
                      {player.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {balanceCreditSearchLoading ? <p className={styles.filterMeta}>РС‰Сѓ РёРіСЂРѕРєР°...</p> : null}
              {balanceCreditMessage ? <p className={styles.filterMeta}>{balanceCreditMessage}</p> : null}
            </section>

            <section className={styles.dashboardSection}>
              <div className={styles.sectionHeader}>
                <h2>Операционный дашборд</h2>
                <p>Быстрый обзор денег, продаж и бесплатных наград на одном экране.</p>
              </div>

              <div className={styles.dashboardBadges}>
                {dashboardBadges.map((badge) => (
                  <span key={badge} className={styles.dashboardBadge}>
                    {badge}
                  </span>
                ))}
              </div>

              <DashboardOverviewCard
                metrics={overviewMetrics}
                providerLegend={providerLegend}
                topDonors={topDonors}
                balanceStats={balanceStats}
                paidRevenue={paidRevenue}
                paidPurchases={paidPurchases}
                totalPurchases={totalPurchases}
                totalBalanceAllTime={creditedBalance}
                balanceToday={balanceToday}
                freeRewardClaimsTotal={freeRewardClaimsTotal}
                freeRewardClaimsToday={freeRewardClaimsToday}
                freeRewardCoinsIssued={freeRewardCoinsIssuedTotal}
                freeRewardCoinsPerClaim={ACTIVITY_FREE_COINS_REWARD.coinsAmount}
              />
            </section>

            <section className={styles.dashboardSection}>
              <div className={styles.sectionHeader}>
                <h2>Ключевые показатели</h2>
                <p>Компактная сводка по покупкам, балансу и общей активности.</p>
              </div>

              <div className={styles.summaryGrid}>
                {summaryCards.map((item) => (
                  <article key={item.label} className={styles.summaryCard}>
                    <p className={styles.cardLabel}>{item.label}</p>
                    <strong>{item.value}</strong>
                    <p className={styles.summaryNote}>{item.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <div className={styles.adminTablesGrid}>
              <section className={`${styles.panelSection} ${styles.adminDataPanel} ${styles.adminDataPanelWide}`}>
                <div className={styles.sectionHeader}>
                  <h2>Управление таблицами</h2>
                  <p>Поиск работает по никам, Steam ID, purchase ID, суммам, статусам и meta внутри уже загруженного среза.</p>
                </div>

                <div className={styles.tableToolbar}>
                  <label className={`${styles.filterField} ${styles.tableSearchField}`}>
                    <span>Поиск по таблицам</span>
                    <input
                      type="search"
                      placeholder="Ник, Steam ID, purchase ID, статус..."
                      value={tableFilters.search}
                      onChange={(event) => setTableFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                  </label>

                  <div className={styles.exportActions}>
                    <button className={styles.secondaryButton} type="button" onClick={exportPurchasesCsv}>Покупки CSV</button>
                    <button className={styles.secondaryButton} type="button" onClick={exportBalancesCsv}>Балансы CSV</button>
                    <button className={styles.secondaryButton} type="button" onClick={exportBalanceTransactionsCsv}>Операции CSV</button>
                    <button className={styles.secondaryButton} type="button" onClick={exportLogsCsv}>Логи CSV</button>
                  </div>
                </div>
              </section>

              <section className={`${styles.panelSection} ${styles.adminDataPanel} ${styles.adminDataPanelWide}`}>
                <div className={styles.sectionHeader}>
                  <h2>Последние покупки</h2>
                  <p>Последние транзакции в компактной таблице с внутренним скроллом.</p>
                </div>
                <PurchasesTable purchases={data.purchases || []} search={tableFilters.search} onCopy={handleCopy} />
              </section>

              <section className={`${styles.panelSection} ${styles.adminDataPanel}`}>
                <div className={styles.sectionHeader}>
                  <h2>Балансы пользователей</h2>
                  <p>Текущие положительные остатки игроков.</p>
                </div>
                <BalanceAccountsTable accounts={data.balanceAccounts || []} search={tableFilters.search} onCopy={handleCopy} />
              </section>

              <section className={`${styles.panelSection} ${styles.adminDataPanel}`}>
                <div className={styles.sectionHeader}>
                  <h2>Операции по балансу</h2>
                  <p>Пополнения и списания с привязкой к purchase ID.</p>
                </div>
                <BalanceTransactionsTable transactions={data.balanceTransactions || []} search={tableFilters.search} onCopy={handleCopy} />
              </section>

              <section className={`${styles.panelSection} ${styles.adminDataPanel} ${styles.adminDataPanelWide}`}>
                <div className={styles.sectionHeader}>
                  <h2>Журнал событий</h2>
                  <p>Webhook, создание платежей и смена статусов без растягивания страницы.</p>
                </div>
                <LogsTable logs={data.logs || []} search={tableFilters.search} onCopy={handleCopy} />
              </section>
            </div>

              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
