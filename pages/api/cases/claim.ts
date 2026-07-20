import type { NextApiRequest, NextApiResponse } from 'next';

import { claimCaseOpening, ensureCaseSchema, isDatabaseUnavailableError } from '@/lib/cases/caseDb';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import type { CaseClaimResponse } from '@/types/cases';

export default async function handler(req: NextApiRequest, res: NextApiResponse<CaseClaimResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const steamId = await getSteamIdFromRequest(req, res);
  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  const openingId = Number(req.body?.openingId);
  const tradeUrl = String(req.body?.tradeUrl || '').trim();

  if (!Number.isInteger(openingId) || openingId <= 0) {
    return res.status(400).json({ ok: false, error: 'OPENING_ID_REQUIRED' });
  }

  if (!tradeUrl) {
    return res.status(400).json({ ok: false, error: 'TRADE_URL_REQUIRED' });
  }

  try {
    await ensureCaseSchema();
    const result = await claimCaseOpening({ openingId, userSteamId: steamId, tradeUrl });

    if (!result.ok) {
      return res.status(409).json({ ok: false, error: result.error });
    }

    return res.status(200).json({ ok: true, status: result.status });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' });
    }

    console.error('Case claim failed', error);
    return res.status(500).json({ ok: false, error: 'CASE_CLAIM_FAILED' });
  }
}
