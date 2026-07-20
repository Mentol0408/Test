import type { NextApiRequest, NextApiResponse } from 'next';

import { getSteamIdFromRequest } from '@/lib/paymentServer';

export function getAdminSteamIds() {
  return (process.env.ADMIN_STEAM_IDS || '')
    .split(',')
    .map((steamId) => steamId.trim())
    .filter(Boolean);
}

export function isAdminSteamId(steamId?: string | null) {
  if (!steamId) {
    return false;
  }

  return getAdminSteamIds().includes(steamId);
}

export async function getAdminAccessContext(req: NextApiRequest, res: NextApiResponse) {
  const steamId = await getSteamIdFromRequest(req, res);

  return {
    steamId,
    isAuthenticated: Boolean(steamId),
    isAdmin: isAdminSteamId(steamId),
  };
}