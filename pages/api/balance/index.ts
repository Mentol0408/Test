import type { NextApiRequest, NextApiResponse } from 'next';

import { ACTIVITY_FREE_COINS_REWARD } from '@/lib/activityReward';
import db, { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import type { BalanceSummaryResponse } from '@/types/balance';

const EMPTY_FREE_COINS_REWARD = {
  trackedMinutes: 0,
  requiredMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
  remainingMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
  activeDays: 0,
  windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
  coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
  canClaim: false,
  claimedRecently: false,
  lastClaimAt: null,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BalanceSummaryResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      isAuthenticated: false,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      error: 'Method not allowed',
    });
  }

  const steamId = await getSteamIdFromRequest(req, res);

  if (!steamId) {
    return res.status(200).json({
      ok: true,
      isAuthenticated: false,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      balance: 0,
      transactions: [],
      freeCoinsReward: EMPTY_FREE_COINS_REWARD,
    });
  }

  try {
    const [balance, transactions, freeCoinsReward] = await Promise.all([
      db.getUserBalance(steamId),
      db.getUserBalanceTransactions(steamId, 8),
      db.getFreeCoinsRewardStatus(steamId),
    ]);

    return res.status(200).json({
      ok: true,
      isAuthenticated: true,
      databaseConfigured: true,
      balance,
      transactions,
      freeCoinsReward,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(200).json({
        ok: true,
        isAuthenticated: true,
        databaseConfigured: false,
        balance: 0,
        transactions: [],
        freeCoinsReward: EMPTY_FREE_COINS_REWARD,
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    return res.status(500).json({
      ok: false,
      isAuthenticated: true,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      error: 'BALANCE_LOAD_FAILED',
    });
  }
}