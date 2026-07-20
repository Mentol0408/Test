import type { NextApiRequest, NextApiResponse } from 'next';

import { getAdminAccessContext } from '@/lib/admin';
import db, { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamPlayerProfiles } from '@/lib/steamProfiles';
import type { AdminPlayerSearchResult } from '@/types/admin';

type AdminPlayerSearchResponse = {
  ok: boolean;
  players?: AdminPlayerSearchResult[];
  error?: string;
};

function getQueryText(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').trim().slice(0, 80);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminPlayerSearchResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const access = await getAdminAccessContext(req, res);

  if (!access.isAuthenticated) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  if (!access.isAdmin) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  const query = getQueryText(req.query.q);

  if (query.length < 2) {
    return res.status(200).json({ ok: true, players: [] });
  }

  try {
    const players = await db.searchAdminPlayers({ query, limit: 12 });
    const profiles = await getSteamPlayerProfiles(players.map((player) => player.steamId));
    const enrichedPlayers = players.map((player) => ({
      ...player,
      name: player.name || profiles[player.steamId]?.name || null,
    }));

    return res.status(200).json({ ok: true, players: enrichedPlayers });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'Database is unavailable' });
    }

    console.error('admin player search error', error);
    return res.status(500).json({ ok: false, error: 'Failed to search players' });
  }
}
