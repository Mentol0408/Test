import type { NextApiRequest, NextApiResponse } from 'next';

import db, { isDatabaseUnavailableError } from '@/lib/db';
import {
  isDiscordRoleConfigured,
  isValidDiscordUserId,
  validateDiscordMember,
} from '@/lib/discord';
import { getSteamIdFromRequest } from '@/lib/paymentServer';

type DiscordLinkResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  configured: boolean;
  discordUserId?: string | null;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiscordLinkResponse>
) {
  const steamId = await getSteamIdFromRequest(req, res);
  const configured = isDiscordRoleConfigured();

  if (!steamId) {
    return res.status(401).json({
      ok: false,
      isAuthenticated: false,
      configured,
      error: 'AUTH_REQUIRED',
    });
  }

  if (req.method === 'GET') {
    try {
      const connection = await db.getDiscordConnection(steamId);

      return res.status(200).json({
        ok: true,
        isAuthenticated: true,
        configured,
        discordUserId: connection?.discordUserId ?? null,
      });
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return res.status(503).json({
          ok: false,
          isAuthenticated: true,
          configured,
          error: 'DATABASE_UNAVAILABLE',
        });
      }

      return res.status(500).json({
        ok: false,
        isAuthenticated: true,
        configured,
        error: 'DISCORD_LINK_READ_FAILED',
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      isAuthenticated: true,
      configured,
      error: 'METHOD_NOT_ALLOWED',
    });
  }

  if (!configured) {
    return res.status(503).json({
      ok: false,
      isAuthenticated: true,
      configured,
      error: 'DISCORD_NOT_CONFIGURED',
    });
  }

  const discordUserId = typeof req.body?.discordUserId === 'string'
    ? req.body.discordUserId.trim()
    : '';

  if (!isValidDiscordUserId(discordUserId)) {
    return res.status(400).json({
      ok: false,
      isAuthenticated: true,
      configured,
      error: 'INVALID_DISCORD_USER_ID',
    });
  }

  const memberValidation = await validateDiscordMember(discordUserId);

  if (!memberValidation.ok) {
    const status = memberValidation.error === 'DISCORD_MEMBER_NOT_FOUND'
      ? 404
      : memberValidation.error === 'INVALID_DISCORD_USER_ID'
        ? 400
        : memberValidation.error === 'DISCORD_NOT_CONFIGURED'
          ? 503
          : 502;

    return res.status(status).json({
      ok: false,
      isAuthenticated: true,
      configured,
      error: memberValidation.error,
    });
  }

  try {
    const connection = await db.upsertDiscordConnection({
      userSteamId: steamId,
      discordUserId,
    });

    return res.status(200).json({
      ok: true,
      isAuthenticated: true,
      configured,
      discordUserId: connection.discordUserId,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        ok: false,
        isAuthenticated: true,
        configured,
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    return res.status(500).json({
      ok: false,
      isAuthenticated: true,
      configured,
      error: 'DISCORD_LINK_SAVE_FAILED',
    });
  }
}