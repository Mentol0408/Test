import type { BotInventoryItem } from '@/types/cases';

/**
 * Steam trade-bot integration boundary for the cases feature.
 *
 * The production bot (with its Steam credentials / API keys) is provisioned
 * outside the repository, so this module ships as a safe, disabled stub:
 *   - when it is not configured, case opening still works and rolls a winner
 *     from the full item list (the "botConfigured: false" path in caseDb.ts);
 *   - claiming a physical skin fails with a clear error until a real
 *     implementation is dropped in.
 *
 * To enable live inventory + trade sending, replace the bodies below with the
 * real Steam bot client and set the environment variables checked in
 * getCaseBotConfig().
 */

export type CaseBotConfig = {
  configured: boolean;
};

/** Reports whether the trade bot is provisioned. Disabled unless env is set. */
export function getCaseBotConfig(): CaseBotConfig {
  const configured = Boolean(
    process.env.CASE_BOT_API_KEY?.trim() && process.env.CASE_BOT_STEAM_ID?.trim(),
  );
  return { configured };
}

/** Live bot inventory. Empty until a real bot client is wired in. */
export async function listBotInventory(): Promise<BotInventoryItem[]> {
  return [];
}

/** Sends a specific item to the given trade URL. Throws until configured. */
export async function sendSpecificBotItem(tradeUrl: string, itemName: string): Promise<void> {
  void tradeUrl;
  void itemName;
  throw new Error('CASE_BOT_NOT_CONFIGURED');
}
