import type { NextApiRequest, NextApiResponse } from 'next';

import db, { isDatabaseUnavailableError } from '@/lib/db';
import { assignVipDiscordRole, isDiscordRoleConfigured } from '@/lib/discord';
import { getSteamIdFromRequest } from '@/lib/paymentServer';

type AssignVipRoleResponse = {
  ok: boolean;
  configured: boolean;
  discordUserId?: string | null;
  purchaseId?: number | null;
  error?: string;
};

const VIP_DAYS = 6;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssignVipRoleResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      configured: isDiscordRoleConfigured(),
      error: 'METHOD_NOT_ALLOWED',
    });
  }

  const steamId = await getSteamIdFromRequest(req, res);
  const configured = isDiscordRoleConfigured();

  if (!steamId) {
    return res.status(401).json({
      ok: false,
      configured,
      error: 'AUTH_REQUIRED',
    });
  }

  if (!configured) {
    return res.status(503).json({
      ok: false,
      configured,
      error: 'DISCORD_NOT_CONFIGURED',
    });
  }

  try {
    const [connection, recentVipPurchase] = await Promise.all([
      db.getDiscordConnection(steamId),
      db.getRecentVipPurchase(steamId, VIP_DAYS),
    ]);

    if (!connection) {
      return res.status(400).json({
        ok: false,
        configured,
        error: 'DISCORD_NOT_LINKED',
      });
    }

    if (!recentVipPurchase) {
      return res.status(404).json({
        ok: false,
        configured,
        discordUserId: connection.discordUserId,
        error: 'VIP_NOT_FOUND',
      });
    }

    const result = await assignVipDiscordRole(connection.discordUserId);

    await db.addLog({
      purchaseId: recentVipPurchase.id,
      serverKey: 'discord',
      event: result.ok ? 'discord_vip_role_assigned_manual' : 'discord_vip_role_assignment_failed_manual',
      meta: {
        discordUserId: connection.discordUserId,
        result,
      },
    });

    if (!result.ok) {
      const status = result.error === 'DISCORD_MEMBER_NOT_FOUND'
        ? 404
        : result.error === 'INVALID_DISCORD_USER_ID'
          ? 400
          : result.error === 'DISCORD_NOT_CONFIGURED'
            ? 503
            : 502;

      return res.status(status).json({
        ok: false,
        configured,
        discordUserId: connection.discordUserId,
        purchaseId: recentVipPurchase.id,
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      configured,
      discordUserId: connection.discordUserId,
      purchaseId: recentVipPurchase.id,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        ok: false,
        configured,
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    return res.status(500).json({
      ok: false,
      configured,
      error: 'DISCORD_ROLE_ASSIGNMENT_FAILED',
    });
  }
}