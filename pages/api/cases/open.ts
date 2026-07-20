import type { NextApiRequest, NextApiResponse } from 'next';

import { ensureCaseSchema, isDatabaseUnavailableError, openCaseForUser } from '@/lib/cases/caseDb';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import type { CaseOpenResponse } from '@/types/cases';

export default async function handler(req: NextApiRequest, res: NextApiResponse<CaseOpenResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const steamId = await getSteamIdFromRequest(req, res);
  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  const caseId = String(req.body?.caseId || '').trim();
  if (!caseId) {
    return res.status(400).json({ ok: false, error: 'CASE_ID_REQUIRED' });
  }

  try {
    await ensureCaseSchema();
    const result = await openCaseForUser(steamId, caseId);

    if (!result.ok) {
      return res.status(result.error === 'INSUFFICIENT_BALANCE' ? 400 : 409).json({
        ok: false,
        balance: 'balance' in result ? result.balance : undefined,
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      balance: result.balance,
      openingId: result.openingId,
      winningItem: result.winningItem,
      caseId,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' });
    }

    console.error('Case open failed', error);
    return res.status(500).json({ ok: false, error: 'CASE_OPEN_FAILED' });
  }
}
