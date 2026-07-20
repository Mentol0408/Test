import type { NextApiRequest, NextApiResponse } from 'next';

import { getAdminAccessContext } from '@/lib/admin';
import db, { isDatabaseUnavailableError } from '@/lib/db';

type BalanceCreditResponse = {
  ok: boolean;
  error?: string;
  balance?: number;
};

function normalizeSteamId(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 32);
}

function normalizeAmount(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.trunc(amount);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<BalanceCreditResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const access = await getAdminAccessContext(req, res);

  if (!access.isAuthenticated) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  if (!access.isAdmin || !access.steamId) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  const userSteamId = normalizeSteamId(req.body?.userSteamId ?? req.body?.steamId);
  const amount = normalizeAmount(req.body?.amount);
  const reason = String(req.body?.reason || '').trim().slice(0, 240);

  if (!/^7656119\d{10}$/.test(userSteamId)) {
    return res.status(400).json({ ok: false, error: 'Valid Steam ID is required' });
  }

  if (amount <= 0 || amount > 1_000_000) {
    return res.status(400).json({ ok: false, error: 'Amount must be between 1 and 1000000' });
  }

  try {
    const result = await db.creditUserBalanceManually({
      userSteamId,
      amount,
      adminSteamId: access.steamId,
      reason: reason || null,
    });

    return res.status(200).json({ ok: true, balance: result.balance });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'Database is unavailable' });
    }

    console.error('admin balance credit error', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
