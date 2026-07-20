import { addLog } from '@/lib/db';
import purchaseConfig from '@/lib/purchaseConfig.json';
import { WebRcon } from '@/lib/webrcon';
import type { StoreProductAdmin } from '@/types/store';

type ServerConfig = {
  ip: string;
  port: number;
  pass: string;
};

export type StoreFulfillmentResult = {
  ok: boolean;
  skipped: boolean;
  delivered: number; // сколько команд реально прошло
  total: number; // сколько команд всего
  event: string;
  serverKey: string;
  commands?: string[];
  responses?: string[];
  error?: string;
};

// Признаки того, что RCON-команда выдачи НЕ выполнилась (игрок оффлайн, нет группы и т.п.).
// Такой ответ трактуем как невыданную единицу → деньги вернутся.
function looksLikeDeliveryError(response: string): boolean {
  const r = (response || '').toLowerCase();
  if (!r) return false;
  return [
    'unknown command',
    'not found',
    'no players found',
    'no player',
    'no such',
    'not connected',
    'player not connected',
    'is not online',
    'offline',
  ].some((marker) => r.includes(marker));
}

function interpolateTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((command, [key, value]) => {
    return command.split(`\${${key}}`).join(String(value));
  }, template);
}

// Строит список RCON-команд для выдачи `quantity` единиц товара.
// Если в шаблоне есть ${amount} (предметы/ресурсы) — умножаем количество в одной команде.
// Если ${amount} нет (наборы и т.п.) — повторяем команду quantity раз.
export function buildStoreCommands(product: StoreProductAdmin, steamId: string, quantity = 1): string[] {
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
  const baseAmount = product.amount && product.amount > 0 ? product.amount : 1;
  const templates = String(product.deliveryCommand || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (templates.length === 0) {
    return [];
  }

  return templates.flatMap((template) => {
    if (template.includes('${amount}')) {
      const command = interpolateTemplate(template, {
        steamId,
        amount: baseAmount * qty,
        slug: product.slug,
      }).trim();

      return command ? [command] : [];
    }

    const command = interpolateTemplate(template, {
      steamId,
      amount: baseAmount,
      slug: product.slug,
    }).trim();

    if (!command) {
      return [];
    }

    return Array.from({ length: qty }, () => command);
  });
}

async function safeLog(purchaseId: number, serverKey: string, event: string, meta: unknown) {
  try {
    await addLog({ purchaseId, serverKey, event, meta });
  } catch {
    // Логирование не должно ломать выдачу.
  }
}

// Выдаёт товар магазина на ВЫБРАННЫЙ сервер (в отличие от доната, который шлёт на все).
export async function fulfillStorePurchaseInGame(params: {
  purchaseId: number;
  userSteamId: string;
  product: StoreProductAdmin;
  serverKey: string;
  quantity?: number;
}): Promise<StoreFulfillmentResult> {
  const { purchaseId, userSteamId, product, serverKey, quantity = 1 } = params;
  const commands = buildStoreCommands(product, userSteamId, quantity);

  if (commands.length === 0) {
    const result: StoreFulfillmentResult = {
      ok: true,
      skipped: true,
      delivered: 0,
      total: 0,
      event: 'store_fulfillment_skipped',
      serverKey,
    };

    await safeLog(purchaseId, serverKey, result.event, { product: product.slug, quantity, ...result });

    return result;
  }

  const total = commands.length;
  const servers = purchaseConfig.servers as Record<string, ServerConfig>;
  const server = servers[serverKey];

  if (!server) {
    const result: StoreFulfillmentResult = {
      ok: false,
      skipped: false,
      delivered: 0,
      total,
      event: 'store_fulfillment_failed',
      serverKey,
      commands,
      error: 'SERVER_NOT_CONFIGURED',
    };

    await safeLog(purchaseId, serverKey, result.event, { product: product.slug, quantity, ...result });

    return result;
  }

  const rcon = new WebRcon(server.ip, server.port, server.pass);

  try {
    await rcon.connect(15000);

    const responses: string[] = [];
    const errors: string[] = [];
    let delivered = 0;

    // Каждую команду обрабатываем отдельно — цикл НЕ прерывается на ошибке,
    // чтобы корректно посчитать частичную выдачу (важно для quantity > 1).
    for (const command of commands) {
      try {
        const response = await rcon.send(command, 15000, { assumeSuccessOnSilence: true, silenceMs: 2500 });
        responses.push(response);
        if (looksLikeDeliveryError(response)) {
          errors.push(`${command} -> ${response}`);
        } else {
          delivered += 1;
        }
      } catch (error) {
        errors.push(`${command} -> ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const ok = delivered === total;
    const result: StoreFulfillmentResult = {
      ok,
      skipped: false,
      delivered,
      total,
      event: ok ? 'store_fulfillment_completed' : delivered > 0 ? 'store_fulfillment_partial' : 'store_fulfillment_failed',
      serverKey,
      commands,
      responses,
      error: errors.length ? errors.join(' | ') : undefined,
    };

    await safeLog(purchaseId, serverKey, result.event, { product: product.slug, quantity, ...result });

    return result;
  } catch (error) {
    const result: StoreFulfillmentResult = {
      ok: false,
      skipped: false,
      delivered: 0,
      total,
      event: 'store_fulfillment_failed',
      serverKey,
      commands,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    await safeLog(purchaseId, serverKey, result.event, { product: product.slug, quantity, ...result });

    return result;
  } finally {
    try {
      rcon.end();
    } catch {
      // Игнорируем ошибки закрытия сокета.
    }
  }
}
