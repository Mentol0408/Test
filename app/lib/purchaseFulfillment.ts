import db from '@/lib/db';
import { assignVipDiscordRole } from '@/lib/discord';
import { COINS_PAYMENT } from '@/lib/paymentConfig';
import purchaseConfig from '@/lib/purchaseConfig.json';
import { WebRcon } from '@/lib/webrcon';

type PurchaseMeta = Record<string, unknown> | null;

type PurchaseToFulfill = {
  purchaseId: number;
  userSteamId: string;
  itemType: string;
  amount: number;
  meta?: unknown;
};

type ServerConfig = {
  ip: string;
  port: number;
  pass: string;
};

export type FulfillmentServerResult = {
  server: string;
  success: boolean;
  response?: string;
  error?: string;
};

export type PurchaseFulfillmentResult = {
  ok: boolean;
  partial: boolean;
  skipped: boolean;
  event: string;
  results: FulfillmentServerResult[];
  command?: string;
  coinsAmount?: number;
  vipDays?: number;
  discordRole?: {
    attempted: boolean;
    assigned: boolean;
    discordUserId?: string;
    error?: string;
    status?: number;
  };
  error?: string;
};

const VIP_DAYS = 6;

function getPurchaseMeta(meta: unknown): PurchaseMeta {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }

  return meta as Record<string, unknown>;
}

function getNumericMetaValue(meta: PurchaseMeta, key: string) {
  const value = meta?.[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function interpolateTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((command, [key, value]) => {
    return command.split(`\${${key}}`).join(String(value));
  }, template);
}

function buildCommand(purchase: PurchaseToFulfill, meta: PurchaseMeta) {
  if (purchase.itemType === 'vip') {
    const template = process.env.VIP_COMMAND?.trim() || 'addgroup ${steamId} premium ${days}d';

    return {
      command: interpolateTemplate(template, {
        steamId: purchase.userSteamId,
        days: VIP_DAYS,
      }),
      vipDays: VIP_DAYS,
    };
  }

  if (purchase.itemType === 'coins') {
    const coinsAmount =
      getNumericMetaValue(meta, 'coinsAmount') ?? Math.max(Math.floor(purchase.amount * COINS_PAYMENT.pricePerCoin), 0);
    const template = process.env.COINS_COMMAND?.trim() || 'iq.eco give ${steamId} ${amount}';

    return {
      command: interpolateTemplate(template, {
        steamId: purchase.userSteamId,
        amount: coinsAmount,
        coins: coinsAmount,
      }),
      coinsAmount,
    };
  }

  return null;
}

export async function fulfillPurchaseInGame(
  purchase: PurchaseToFulfill
): Promise<PurchaseFulfillmentResult> {
  const meta = getPurchaseMeta(purchase.meta);
  const commandData = buildCommand(purchase, meta);

  if (!commandData) {
    return {
      ok: true,
      partial: false,
      skipped: true,
      event: 'purchase_fulfillment_skipped',
      results: [],
    };
  }

  const servers = Object.entries(purchaseConfig.servers as Record<string, ServerConfig>);

  if (servers.length === 0) {
    const result = {
      ok: false,
      partial: false,
      skipped: false,
      event: 'purchase_fulfillment_failed',
      results: [] as FulfillmentServerResult[],
      command: commandData.command,
      ...(typeof commandData.coinsAmount === 'number' ? { coinsAmount: commandData.coinsAmount } : {}),
      ...(typeof commandData.vipDays === 'number' ? { vipDays: commandData.vipDays } : {}),
      error: 'NO_SERVERS_CONFIGURED',
    };

    await db.addLog({
      purchaseId: purchase.purchaseId,
      serverKey: 'donate',
      event: result.event,
      meta: result,
    });

    return result;
  }

  const results: FulfillmentServerResult[] = [];

  for (const [serverKey, server] of servers) {
    const rcon = new WebRcon(server.ip, server.port, server.pass);

    try {
      await rcon.connect(15000);
      const response = await rcon.send(commandData.command, 15000);
      results.push({ server: serverKey, success: true, response });
    } catch (error) {
      results.push({
        server: serverKey,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      try {
        rcon.end();
      } catch {
        // Ignore socket closing errors.
      }
    }
  }

  const successCount = results.filter((result) => result.success).length;
  const partial = successCount > 0 && successCount < results.length;
  // Match landing-main delivery semantics: one successful RCON execution is enough to keep the purchase delivered.
  const ok = results.length > 0 && successCount > 0;
  const event = ok
    ? partial
      ? 'purchase_fulfillment_partial'
      : 'purchase_fulfillment_completed'
    : 'purchase_fulfillment_failed';

  let discordRole: PurchaseFulfillmentResult['discordRole'];

  if (ok && purchase.itemType === 'vip') {
    try {
      const discordConnection = await db.getDiscordConnection(purchase.userSteamId);

      if (!discordConnection) {
        discordRole = {
          attempted: false,
          assigned: false,
          error: 'DISCORD_NOT_LINKED',
        };
      } else {
        const discordResult = await assignVipDiscordRole(discordConnection.discordUserId);
        discordRole = discordResult.ok
          ? {
              attempted: true,
              assigned: true,
              discordUserId: discordConnection.discordUserId,
            }
          : {
              attempted: true,
              assigned: false,
              discordUserId: discordConnection.discordUserId,
              error: discordResult.error,
              status: discordResult.status,
            };
      }
    } catch (error) {
      discordRole = {
        attempted: true,
        assigned: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  const payload: PurchaseFulfillmentResult = {
    ok,
    partial,
    skipped: false,
    event,
    results,
    command: commandData.command,
    ...(typeof commandData.coinsAmount === 'number' ? { coinsAmount: commandData.coinsAmount } : {}),
    ...(typeof commandData.vipDays === 'number' ? { vipDays: commandData.vipDays } : {}),
    ...(discordRole ? { discordRole } : {}),
    ...(ok ? {} : { error: partial ? 'DELIVERY_PARTIAL' : 'DELIVERY_FAILED' }),
  };

  if (purchase.itemType === 'vip' && discordRole) {
    await db.addLog({
      purchaseId: purchase.purchaseId,
      serverKey: 'discord',
      event: discordRole.assigned ? 'discord_vip_role_assigned' : discordRole.attempted ? 'discord_vip_role_assignment_failed' : 'discord_vip_role_skipped',
      meta: {
        itemType: purchase.itemType,
        discordRole,
      },
    });
  }

  await db.addLog({
    purchaseId: purchase.purchaseId,
    serverKey: 'donate',
    event,
    meta: {
      itemType: purchase.itemType,
      ...payload,
    },
  });

  return payload;
}