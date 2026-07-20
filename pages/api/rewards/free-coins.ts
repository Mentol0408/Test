import type { NextApiRequest, NextApiResponse } from 'next';

import db, { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import type { FreeCoinsClaimResponse } from '@/types/balance';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FreeCoinsClaimResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const steamId = await getSteamIdFromRequest(req, res);

  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  try {
    const claim = await db.claimFreeCoinsReward({ userSteamId: steamId, serverKey: 'donate' });

    if (!claim.ok) {
      return res.status(409).json({
        ok: false,
        error: claim.reason === 'already_claimed' ? 'REWARD_ALREADY_CLAIMED' : 'REWARD_REQUIREMENT_NOT_MET',
        reward: claim.reward,
      });
    }

    if (!claim.purchase) {
      return res.status(500).json({ ok: false, error: 'FREE_COINS_CLAIM_FAILED' });
    }

    return res.status(200).json({
      ok: true,
      purchaseId: claim.purchase.id,
      reward: claim.reward,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' });
    }

    return res.status(500).json({ ok: false, error: 'FREE_COINS_CLAIM_FAILED' });
  }
}
