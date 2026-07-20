import type { NextApiRequest, NextApiResponse } from 'next';

import db from '@/lib/db';
import { getAdminAccessContext } from '@/lib/admin';
import { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamPlayerProfiles } from '@/lib/steamProfiles';
import type { AdminDashboardPayload, AdminDashboardResponse, AdminSummary } from '@/types/admin';

const EMPTY_SUMMARY: AdminSummary = {
  totalPurchases: 0,
  paidPurchases: 0,
  failedPurchases: 0,
  totalRevenue: 0,
  paidRevenue: 0,
  tbankPaidRevenue: 0,
  enotPaidRevenue: 0,
  balancePaidRevenue: 0,
  balanceToday: 0,
  freeRewardClaims: 0,
  freeRewardClaimsTotal: 0,
  freeRewardClaimsToday: 0,
  uniqueBuyers: 0,
  totalLogs: 0,
  totalBalanceHolders: 0,
  totalOutstandingBalance: 0,
  totalBalanceTransactions: 0,
  creditedBalance: 0,
  debitedBalance: 0,
};

function getSingleQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeDateQuery(value: string | string[] | undefined) {
  const candidate = getSingleQueryValue(value)?.trim();

  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return undefined;
  }

  return candidate;
}

function normalizeSteamIdQuery(value: string | string[] | undefined) {
  const candidate = getSingleQueryValue(value)?.trim();

  if (!candidate) {
    return undefined;
  }

  const normalized = candidate.replace(/[^\d]/g, '').slice(0, 32);

  return normalized || undefined;
}

function normalizeTokenQuery(value: string | string[] | undefined) {
  const candidate = getSingleQueryValue(value)?.trim().toLowerCase();

  if (!candidate || !/^[a-z0-9_-]{1,48}$/.test(candidate)) {
    return undefined;
  }

  return candidate;
}

async function enrichDashboardWithPlayerNames(dashboard: AdminDashboardPayload) {
  const steamIds = new Set<string>();

  dashboard.topDonors.forEach((donor) => steamIds.add(donor.userId));
  dashboard.purchases.forEach((purchase) => {
    if (purchase.userId) {
      steamIds.add(purchase.userId);
    }
  });
  dashboard.balanceAccounts.forEach((account) => steamIds.add(account.userSteamId));
  dashboard.balanceTransactions.forEach((transaction) => steamIds.add(transaction.userSteamId));

  const profiles = await getSteamPlayerProfiles(Array.from(steamIds));

  return {
    ...dashboard,
    topDonors: dashboard.topDonors.map((donor) => ({
      ...donor,
      userName: profiles[donor.userId]?.name || null,
    })),
    purchases: dashboard.purchases.map((purchase) => ({
      ...purchase,
      userName: purchase.userId ? profiles[purchase.userId]?.name || null : null,
    })),
    balanceAccounts: dashboard.balanceAccounts.map((account) => ({
      ...account,
      userName: profiles[account.userSteamId]?.name || null,
    })),
    balanceTransactions: dashboard.balanceTransactions.map((transaction) => ({
      ...transaction,
      userName: profiles[transaction.userSteamId]?.name || null,
    })),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminDashboardResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
      isAuthenticated: false,
      isAdmin: false,
      steamId: null,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
    });
  }

  res.setHeader('Cache-Control', 'no-store');

  let dateFrom = normalizeDateQuery(req.query.dateFrom);
  let dateTo = normalizeDateQuery(req.query.dateTo);
  const steamId = normalizeSteamIdQuery(req.query.steamId);
  const provider = normalizeTokenQuery(req.query.provider);
  const status = normalizeTokenQuery(req.query.status);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  const access = await getAdminAccessContext(req, res);
  const baseResponse = {
    ok: true,
    isAuthenticated: access.isAuthenticated,
    isAdmin: access.isAdmin,
    steamId: access.steamId,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };

  if (!access.isAuthenticated || !access.isAdmin) {
    return res.status(200).json(baseResponse);
  }

  if (!process.env.DATABASE_URL) {
    return res.status(200).json({
      ...baseResponse,
      summary: EMPTY_SUMMARY,
      topDonors: [],
      purchases: [],
      logs: [],
      balanceAccounts: [],
      balanceTransactions: [],
      databaseConfigured: false,
    });
  }

  try {
    const dashboard = await db.getAdminDashboardData({
      purchasesLimit: 50,
      logsLimit: 100,
      dateFrom,
      dateTo,
      steamId,
      provider,
      status,
    });
    const enrichedDashboard = await enrichDashboardWithPlayerNames(dashboard);

    return res.status(200).json({
      ...baseResponse,
      ...enrichedDashboard,
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load admin dashboard', error);
    }

    return res.status(200).json({
      ...baseResponse,
      summary: EMPTY_SUMMARY,
      topDonors: [],
      purchases: [],
      logs: [],
      balanceAccounts: [],
      balanceTransactions: [],
      databaseConfigured: false,
      databaseError: 'DATABASE_UNAVAILABLE',
    });
  }
}