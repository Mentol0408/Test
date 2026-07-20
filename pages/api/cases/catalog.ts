import type { NextApiRequest, NextApiResponse } from 'next';

import { ensureCaseSchema, isDatabaseUnavailableError, listPublicCases, getCaseSettings } from '@/lib/cases/caseDb';
import { CASES_SEED, DEFAULT_CASE_SETTINGS } from '@/lib/cases/seedCases';
import type { CaseCatalogResponse } from '@/types/cases';

export default async function handler(req: NextApiRequest, res: NextApiResponse<CaseCatalogResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      source: 'seed',
      settings: DEFAULT_CASE_SETTINGS,
      cases: [],
      error: 'METHOD_NOT_ALLOWED',
    });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(200).json({
      ok: true,
      databaseConfigured: false,
      source: 'seed',
      settings: DEFAULT_CASE_SETTINGS,
      cases: CASES_SEED.filter((item) => item.isActive),
    });
  }

  try {
    await ensureCaseSchema();

    return res.status(200).json({
      ok: true,
      databaseConfigured: true,
      source: 'database',
      settings: await getCaseSettings(),
      cases: await listPublicCases(),
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        ok: false,
        databaseConfigured: false,
        source: 'seed',
        settings: DEFAULT_CASE_SETTINGS,
        cases: CASES_SEED.filter((item) => item.isActive),
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    console.error('Cases catalog failed', error);

    return res.status(500).json({
      ok: false,
      databaseConfigured: true,
      source: 'seed',
      settings: DEFAULT_CASE_SETTINGS,
      cases: [],
      error: 'CASES_CATALOG_FAILED',
    });
  }
}
