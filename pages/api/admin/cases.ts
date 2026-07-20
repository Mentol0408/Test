import type { NextApiRequest, NextApiResponse } from 'next';

import {
  deleteCaseDefinition,
  deleteCaseItem,
  ensureCaseSchema,
  getCaseSettings,
  isDatabaseUnavailableError,
  listAdminCases,
  loadBotInventorySafe,
  saveCaseDefinition,
  saveCaseItem,
  saveCaseSettings,
} from '@/lib/cases/caseDb';
import { DEFAULT_CASE_SETTINGS } from '@/lib/cases/seedCases';
import { getAdminAccessContext } from '@/lib/admin';
import type { CaseAdminResponse, CaseRarity } from '@/types/cases';

const RARITIES: CaseRarity[] = ['common', 'rare', 'mythical', 'fake'];

function emptyResponse(extra: Partial<CaseAdminResponse>): CaseAdminResponse {
  return {
    ok: false,
    isAuthenticated: false,
    isAdmin: false,
    databaseConfigured: false,
    settings: DEFAULT_CASE_SETTINGS,
    cases: [],
    botConfigured: false,
    botItems: [],
    botError: null,
    ...extra,
  };
}

async function buildResponse(): Promise<CaseAdminResponse> {
  const [settings, cases, bot] = await Promise.all([
    getCaseSettings(),
    listAdminCases(),
    loadBotInventorySafe(),
  ]);

  return {
    ok: true,
    isAuthenticated: true,
    isAdmin: true,
    databaseConfigured: true,
    settings,
    cases,
    botConfigured: bot.botConfigured,
    botItems: bot.botItems,
    botError: bot.botError,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CaseAdminResponse>) {
  const access = await getAdminAccessContext(req, res);

  if (!access.isAuthenticated) {
    return res.status(401).json(emptyResponse({ error: 'AUTH_REQUIRED' }));
  }

  if (!access.isAdmin) {
    return res.status(403).json(emptyResponse({ isAuthenticated: true, error: 'FORBIDDEN' }));
  }

  try {
    await ensureCaseSchema();

    if (req.method === 'GET') {
      return res.status(200).json(await buildResponse());
    }

    if (req.method !== 'POST') {
      return res.status(405).json(emptyResponse({ isAuthenticated: true, isAdmin: true, error: 'METHOD_NOT_ALLOWED' }));
    }

    const action = String(req.body?.action || '');

    if (action === 'saveSettings') {
      await saveCaseSettings({
        casesEnabled: req.body?.settings?.casesEnabled !== false,
        adminOnlyOpen: req.body?.settings?.adminOnlyOpen === true,
      });
      return res.status(200).json(await buildResponse());
    }

    if (action === 'saveCase') {
      const caseDef = req.body?.caseDef;
      const id = String(caseDef?.id || '').trim();
      const name = String(caseDef?.name || '').trim();
      const description = String(caseDef?.description || '').trim();
      const imageUrl = String(caseDef?.imageUrl || '').trim();

      if (!id || !name || !imageUrl) {
        return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_CASE' }));
      }

      await saveCaseDefinition({
        id,
        name,
        description,
        price: Number(caseDef?.price) || 0,
        imageUrl,
        accent: String(caseDef?.accent || '#ffffff'),
        isActive: caseDef?.isActive !== false,
      });

      return res.status(200).json(await buildResponse());
    }

    if (action === 'deleteCase') {
      const caseId = String(req.body?.caseId || '').trim();
      if (!caseId) {
        return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_CASE_ID' }));
      }

      await deleteCaseDefinition(caseId);
      return res.status(200).json(await buildResponse());
    }

    if (action === 'saveItem') {
      const item = req.body?.item;
      const caseId = String(item?.caseId || '').trim();
      const name = String(item?.name || '').trim();
      const rarity = String(item?.rarity || 'common') as CaseRarity;

      if (!caseId || !name || !RARITIES.includes(rarity)) {
        return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_ITEM' }));
      }

      await saveCaseItem({
        id: item?.id == null ? null : Number(item.id),
        caseId,
        name,
        category: null,
        rarity,
        sellPrice: Number(item?.sellPrice) || 0,
        imageUrl: item?.imageUrl ? String(item.imageUrl) : null,
        dropChance: Number(item?.dropChance) || 0,
        isActive: item?.isActive !== false,
        isFake: item?.isFake === true || rarity === 'fake',
        sortOrder: Number(item?.sortOrder) || 0,
      });

      return res.status(200).json(await buildResponse());
    }

    if (action === 'deleteItem') {
      const itemId = Number(req.body?.itemId);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_ITEM_ID' }));
      }

      await deleteCaseItem(itemId);
      return res.status(200).json(await buildResponse());
    }

    return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'UNKNOWN_ACTION' }));
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json(emptyResponse({ isAuthenticated: true, isAdmin: true, error: 'DATABASE_UNAVAILABLE' }));
    }

    console.error('Cases admin failed', error);
    return res.status(500).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'CASES_ADMIN_FAILED' }));
  }
}
