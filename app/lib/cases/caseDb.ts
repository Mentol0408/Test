import db, {
  ensureDatabaseReady,
  isDatabaseUnavailableError,
  query,
} from '@/lib/db';
import { isAdminSteamId } from '@/lib/admin';
import { CASES_SEED, DEFAULT_CASE_SETTINGS } from '@/lib/cases/seedCases';
import { getCaseBotConfig, listBotInventory, sendSpecificBotItem } from '@/lib/cases/caseBot';
import type {
  BotInventoryItem,
  CaseDefinition,
  CaseDefinitionInput,
  CaseItem,
  CaseItemInput,
  CaseRarity,
  CaseSettings,
} from '@/types/cases';

let schemaReady: Promise<void> | null = null;

function normalizeRarity(value: string): CaseRarity {
  if (value === 'epic' || value === 'legendary') {
    return 'mythical';
  }

  if (value === 'fake') {
    return 'fake';
  }

  if (value === 'mythical') {
    return 'mythical';
  }

  return value === 'rare' ? 'rare' : 'common';
}

function mapCaseItem(row: Record<string, unknown>): CaseItem {
  const rarity = normalizeRarity(String(row.rarity || 'common'));
  const isFake = row.is_fake === true || rarity === 'fake';

  return {
    id: Number(row.id),
    caseId: String(row.case_id),
    name: String(row.name || ''),
    category: row.category == null || String(row.category).trim() === '' ? null : String(row.category),
    rarity: isFake ? 'fake' : rarity,
    sellPrice: Number(row.sell_price || 0),
    imageUrl: row.image_url == null ? null : String(row.image_url),
    dropChance: Number(row.drop_chance || 0),
    isActive: row.is_active !== false,
    isFake,
    sortOrder: Number(row.sort_order || 0),
  };
}

function mapCaseDefinition(row: Record<string, unknown>, items: CaseItem[]): CaseDefinition {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    price: Number(row.price || 0),
    imageUrl: String(row.image_url || ''),
    accent: String(row.accent || '#ffffff'),
    isActive: row.is_active !== false,
    items,
  };
}

async function seedCasesIfEmpty() {
  const countResult = await query('SELECT COUNT(*)::int AS count FROM case_definitions');

  if (Number(countResult.rows[0]?.count || 0) > 0) {
    return;
  }

  await query(
    `INSERT INTO case_settings (singleton, cases_enabled, admin_only_open)
     VALUES (true, $1, $2)
     ON CONFLICT (singleton) DO NOTHING`,
    [DEFAULT_CASE_SETTINGS.casesEnabled, DEFAULT_CASE_SETTINGS.adminOnlyOpen]
  );

  for (const caseDef of CASES_SEED) {
    await query(
      `INSERT INTO case_definitions
        (id, name, description, price, image_url, accent, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        caseDef.id,
        caseDef.name,
        caseDef.description,
        caseDef.price,
        caseDef.imageUrl,
        caseDef.accent,
        caseDef.isActive,
      ]
    );

    for (const item of caseDef.items) {
      await query(
        `INSERT INTO case_items
          (case_id, name, category, rarity, sell_price, image_url, drop_chance, is_active, is_fake, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          caseDef.id,
          item.name,
          item.category || '',
          item.isFake ? 'fake' : normalizeRarity(item.rarity),
          item.sellPrice,
          item.imageUrl,
          item.dropChance,
          item.isActive,
          item.isFake,
          item.sortOrder,
        ]
      );
    }
  }
}

export function ensureCaseSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureDatabaseReady();
      await seedCasesIfEmpty();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

export { isDatabaseUnavailableError };

export async function getCaseSettings(): Promise<CaseSettings> {
  const result = await query(
    `SELECT cases_enabled, admin_only_open
     FROM case_settings
     WHERE singleton = true
     LIMIT 1`
  );

  const row = result.rows[0];
  if (!row) {
    return { ...DEFAULT_CASE_SETTINGS };
  }

  return {
    casesEnabled: row.cases_enabled !== false,
    adminOnlyOpen: row.admin_only_open === true,
  };
}

async function listCasesBase(onlyActive: boolean) {
  const [caseRows, itemRows] = await Promise.all([
    query(
      `SELECT *
       FROM case_definitions
       ${onlyActive ? 'WHERE is_active = true' : ''}
       ORDER BY price ASC, id ASC`
    ),
    query(
      `SELECT *
       FROM case_items
       ${onlyActive ? 'WHERE is_active = true' : ''}
       ORDER BY case_id ASC, sort_order ASC, id ASC`
    ),
  ]);

  const itemsByCase = new Map<string, CaseItem[]>();

  for (const row of itemRows.rows) {
    const item = mapCaseItem(row);
    const list = itemsByCase.get(item.caseId) || [];
    list.push(item);
    itemsByCase.set(item.caseId, list);
  }

  return caseRows.rows.map((row) => mapCaseDefinition(row, itemsByCase.get(String(row.id)) || []));
}

export async function listPublicCases() {
  return listCasesBase(true);
}

export async function listAdminCases() {
  return listCasesBase(false);
}

export async function saveCaseSettings(input: CaseSettings) {
  await query(
    `INSERT INTO case_settings (singleton, cases_enabled, admin_only_open, updated_at)
     VALUES (true, $1, $2, now())
     ON CONFLICT (singleton) DO UPDATE SET
       cases_enabled = EXCLUDED.cases_enabled,
       admin_only_open = EXCLUDED.admin_only_open,
       updated_at = now()`,
    [input.casesEnabled, input.adminOnlyOpen]
  );
}

export async function saveCaseDefinition(input: CaseDefinitionInput) {
  await query(
    `INSERT INTO case_definitions
      (id, name, description, price, image_url, accent, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       price = EXCLUDED.price,
       image_url = EXCLUDED.image_url,
       accent = EXCLUDED.accent,
       is_active = EXCLUDED.is_active,
       updated_at = now()`,
    [
      input.id.trim(),
      input.name.trim(),
      input.description.trim(),
      Math.max(0, Math.round(Number(input.price) || 0)),
      input.imageUrl.trim(),
      input.accent.trim() || '#ffffff',
      input.isActive !== false,
    ]
  );
}

export async function deleteCaseDefinition(caseId: string) {
  await query('DELETE FROM case_definitions WHERE id = $1', [caseId]);
}

export async function saveCaseItem(input: CaseItemInput) {
  const normalizedRarity = input.isFake === true || input.rarity === 'fake' ? 'fake' : normalizeRarity(input.rarity);
  const values = [
    input.caseId.trim(),
    input.name.trim(),
    input.category?.trim() || '',
    normalizedRarity,
    Math.max(0, Math.round(Number(input.sellPrice) || 0)),
    input.imageUrl?.trim() || null,
    Math.max(0, Number(input.dropChance) || 0),
    input.isActive !== false,
    normalizedRarity === 'fake' || input.isFake === true,
    Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
  ];

  if (input.id) {
    await query(
      `UPDATE case_items
       SET case_id = $2,
           name = $3,
           category = $4,
           rarity = $5,
           sell_price = $6,
           image_url = $7,
           drop_chance = $8,
           is_active = $9,
           is_fake = $10,
           sort_order = $11,
           updated_at = now()
       WHERE id = $1`,
      [input.id, ...values]
    );
    return;
  }

  await query(
    `INSERT INTO case_items
      (case_id, name, category, rarity, sell_price, image_url, drop_chance, is_active, is_fake, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    values
  );
}

export async function deleteCaseItem(itemId: number) {
  await query('DELETE FROM case_items WHERE id = $1', [itemId]);
}

type OpeningRow = {
  id: number;
  case_id: string;
  user_steamid: string;
  status: string;
  purchase_id: number;
  won_snapshot: Record<string, unknown>;
};

async function getOpening(openingId: number): Promise<OpeningRow | null> {
  const result = await query(
    `SELECT id, case_id, user_steamid, status, purchase_id, won_snapshot
     FROM case_openings
     WHERE id = $1
     LIMIT 1`,
    [openingId]
  );

  return (result.rows[0] as OpeningRow | undefined) || null;
}

function chooseWinningItem(caseDef: CaseDefinition, botItems: BotInventoryItem[] | null) {
  const inventory = new Map(botItems?.map((item) => [item.name, item]) || []);
  const available = caseDef.items.filter((item) => item.isActive && !item.isFake && (!botItems || (inventory.get(item.name)?.count || 0) > 0));

  if (available.length === 0) {
    return null;
  }

  const sorted = [...available].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const totalWeight = sorted.reduce((sum, item) => sum + Math.max(0, Number(item.dropChance) || 0), 0);

  if (totalWeight <= 0) {
    return sorted[0] || null;
  }

  let cursor = Math.random() * totalWeight;

  for (const item of sorted) {
    cursor -= Math.max(0, Number(item.dropChance) || 0);
    if (cursor <= 0) {
      return item;
    }
  }

  return sorted[sorted.length - 1] || sorted[0] || null;
}

export async function loadBotInventorySafe() {
  const config = getCaseBotConfig();

  if (!config.configured) {
    return {
      botConfigured: false,
      botItems: [] as BotInventoryItem[],
      botError: null as string | null,
    };
  }

  try {
    return {
      botConfigured: true,
      botItems: await listBotInventory(),
      botError: null,
    };
  } catch (error) {
    return {
      botConfigured: true,
      botItems: [] as BotInventoryItem[],
      botError: error instanceof Error ? error.message : 'BOT_UNAVAILABLE',
    };
  }
}

export async function openCaseForUser(userSteamId: string, caseId: string) {
  const settings = await getCaseSettings();
  if (!settings.casesEnabled) {
    return { ok: false as const, error: 'CASES_DISABLED' };
  }

  if (settings.adminOnlyOpen && !isAdminSteamId(userSteamId)) {
    return { ok: false as const, error: 'ADMIN_ONLY_CASE_OPEN' };
  }

  const cases = await listAdminCases();
  const caseDef = cases.find((item) => item.id === caseId && item.isActive);
  if (!caseDef) {
    return { ok: false as const, error: 'CASE_NOT_FOUND' };
  }

  const inventoryResult = await loadBotInventorySafe();
  const inventoryForRoll =
    inventoryResult.botConfigured && !inventoryResult.botError
      ? inventoryResult.botItems
      : null;
  const winningItem = chooseWinningItem(caseDef, inventoryForRoll);

  if (!winningItem) {
    return { ok: false as const, error: 'CASE_EMPTY' };
  }

  const purchaseResult = await db.createPurchaseWithBalance({
    userSteamId,
    itemType: `case:${caseId}`,
    amount: caseDef.price,
    meta: {
      provider: 'balance',
      feature: 'case_open',
      caseId,
      winningItem: {
        id: winningItem.id,
        name: winningItem.name,
        rarity: winningItem.rarity,
        isFake: winningItem.isFake,
      },
    },
  });

  if (!purchaseResult.ok || !purchaseResult.purchase) {
    return {
      ok: false as const,
      error: 'INSUFFICIENT_BALANCE',
      balance: purchaseResult.balance,
    };
  }

  try {
    const result = await query(
      `INSERT INTO case_openings
        (case_id, case_item_id, user_steamid, purchase_id, status, won_snapshot, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,now(),now())
       RETURNING id`,
      [
        caseId,
        winningItem.id,
        userSteamId,
        purchaseResult.purchase.id,
        'opened',
        JSON.stringify(winningItem),
      ]
    );

    await db.addLog({
      purchaseId: purchaseResult.purchase.id,
      serverKey: 'donate',
      event: 'case_opened',
      meta: {
        caseId,
        openingId: Number(result.rows[0]?.id || 0),
        winningItem,
      },
    });

    return {
      ok: true as const,
      openingId: Number(result.rows[0]?.id || 0),
      winningItem,
      balance: purchaseResult.balance,
    };
  } catch (error) {
    await db.revertBalancePurchase({
      userSteamId,
      purchaseId: purchaseResult.purchase.id,
      meta: { feature: 'case_open_revert', caseId },
    });
    throw error;
  }
}

export async function claimCaseOpening(params: {
  openingId: number;
  userSteamId: string;
  tradeUrl: string;
}) {
  const opening = await getOpening(params.openingId);

  if (!opening || opening.user_steamid !== params.userSteamId) {
    return { ok: false as const, error: 'OPENING_NOT_FOUND' };
  }

  if (opening.status !== 'opened') {
    return { ok: false as const, error: 'OPENING_ALREADY_RESOLVED' };
  }

  const snapshot = opening.won_snapshot || {};
  const itemName = String(snapshot.name || '').trim();
  if (!itemName) {
    return { ok: false as const, error: 'ITEM_NAME_MISSING' };
  }

  try {
    await sendSpecificBotItem(params.tradeUrl.trim(), itemName);

    await query(
      `UPDATE case_openings
       SET status = 'claimed',
           trade_url = $2,
           error_message = NULL,
           resolved_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [params.openingId, params.tradeUrl.trim()]
    );

    await db.addLog({
      purchaseId: opening.purchase_id,
      serverKey: 'donate',
      event: 'case_item_claimed',
      meta: { openingId: params.openingId, itemName },
    });

    return { ok: true as const, status: 'claimed' as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BOT_SEND_FAILED';

    await query(
      `UPDATE case_openings
       SET error_message = $2,
           updated_at = now()
       WHERE id = $1`,
      [params.openingId, message]
    );

    return { ok: false as const, error: message };
  }
}

export async function sellCaseOpening(params: {
  openingId: number;
  userSteamId: string;
}) {
  const opening = await getOpening(params.openingId);

  if (!opening || opening.user_steamid !== params.userSteamId) {
    return { ok: false as const, error: 'OPENING_NOT_FOUND' };
  }

  if (opening.status !== 'opened') {
    return { ok: false as const, error: 'OPENING_ALREADY_RESOLVED' };
  }

  const snapshot = opening.won_snapshot || {};
  const sellPrice = Math.max(0, Number(snapshot.sellPrice || 0));

  await query(
    `INSERT INTO balance_transactions (user_steamid, purchase_id, kind, amount, meta)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [
      params.userSteamId,
      null,
      'credit',
      sellPrice,
      JSON.stringify({
        provider: 'cases_sell',
        openingId: params.openingId,
        caseId: opening.case_id,
        item: snapshot.name || null,
      }),
    ]
  );

  const balanceResult = await query(
    `INSERT INTO user_balances (user_steamid, balance, updated_at)
     VALUES ($1,$2,now())
     ON CONFLICT (user_steamid) DO UPDATE SET
       balance = user_balances.balance + EXCLUDED.balance,
       updated_at = now()
     RETURNING balance`,
    [params.userSteamId, sellPrice]
  );

  await query(
    `UPDATE case_openings
     SET status = 'sold',
         sold_for = $2,
         resolved_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [params.openingId, sellPrice]
  );

  await db.addLog({
    purchaseId: opening.purchase_id,
    serverKey: 'donate',
    event: 'case_item_sold',
    meta: { openingId: params.openingId, sellPrice, item: snapshot.name || null },
  });

  return {
    ok: true as const,
    status: 'sold' as const,
    balance: Number(balanceResult.rows[0]?.balance || 0),
  };
}
