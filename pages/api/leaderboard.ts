import type { NextApiRequest, NextApiResponse } from 'next';
import db, { ensureDatabaseReady, isDatabaseUnavailableError, type LeaderboardWipeResultsInput } from '@/lib/db';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import { getSteamPlayerProfiles } from '@/lib/steamProfiles';
import type { HallOfFamePayload } from '@/types/leaderboard';

type LeaderboardResponse = {
  ok: boolean;
  error?: string;
  leaderboard?: HallOfFamePayload;
  wipeId?: number;
  playersCount?: number;
  villagesCount?: number;
};

type RawRecord = Record<string, unknown>;

type RawPlayer = RawRecord & {
  steamId?: unknown;
  steam_id?: unknown;
  id?: unknown;
  playerId?: unknown;
  player_id?: unknown;
  name?: unknown;
  nickname?: unknown;
  playerName?: unknown;
  player_name?: unknown;
  avatarUrl?: unknown;
  avatar_url?: unknown;
  points?: unknown;
  score?: unknown;
  totalPoints?: unknown;
  total_points?: unknown;
  rank?: unknown;
  place?: unknown;
  position?: unknown;
  kills?: unknown;
  frags?: unknown;
  raids?: unknown;
  farm?: unknown;
  farming?: unknown;
  loot?: unknown;
  looting?: unknown;
  build?: unknown;
  building?: unknown;
  playtimeMinutes?: unknown;
  playtime_minutes?: unknown;
  onlineMinutes?: unknown;
  online_minutes?: unknown;
  meta?: unknown;
};

type RawVillage = RawRecord & {
  villageId?: unknown;
  village_id?: unknown;
  villageTag?: unknown;
  village_tag?: unknown;
  tag?: unknown;
  id?: unknown;
  clanId?: unknown;
  clan_id?: unknown;
  teamId?: unknown;
  team_id?: unknown;
  name?: unknown;
  title?: unknown;
  displayName?: unknown;
  display_name?: unknown;
  villageName?: unknown;
  village_name?: unknown;
  leader?: unknown;
  leaderSteamId?: unknown;
  leader_steam_id?: unknown;
  leaderName?: unknown;
  leader_name?: unknown;
  deputy?: unknown;
  deputySteamId?: unknown;
  deputy_steam_id?: unknown;
  deputyName?: unknown;
  deputy_name?: unknown;
  imageUrl?: unknown;
  image_url?: unknown;
  avatarUrl?: unknown;
  avatar_url?: unknown;
  points?: unknown;
  score?: unknown;
  totalPoints?: unknown;
  total_points?: unknown;
  rank?: unknown;
  place?: unknown;
  position?: unknown;
  membersCount?: unknown;
  members_count?: unknown;
  memberCount?: unknown;
  member_count?: unknown;
  playersCount?: unknown;
  players_count?: unknown;
  count?: unknown;
  members?: unknown;
  players?: unknown;
  meta?: unknown;
};

function toText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  if (typeof value === 'bigint') {
    return String(value);
  }

  return '';
}

function toOptionalText(value: unknown) {
  const text = toText(value);
  return text || null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function getRawValue(raw: RawRecord, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function toRawRecords(value: unknown): RawRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is RawRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const raw = value as RawRecord;
  const nested = getRawValue(raw, ['items', 'data', 'rows', 'list', 'entries', 'top', 'ranking', 'leaderboard', 'players', 'villages', 'teams', 'clans']);

  if (Array.isArray(nested)) {
    return toRawRecords(nested);
  }

  if (getRawValue(raw, ['steamId', 'steam_id', 'playerId', 'player_id', 'villageId', 'village_id', 'villageTag', 'village_tag', 'tag', 'clanId', 'clan_id', 'teamId', 'team_id'])) {
    return [raw];
  }

  return Object.entries(raw).map(([key, item]) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return { id: key, ...(item as RawRecord) };
    }

    return {
      id: key,
      name: key,
      points: typeof item === 'number' || typeof item === 'string' ? item : 0,
    };
  });
}

function normalizePlayers(players: unknown) {
  return toRawRecords(players)
    .map((raw: RawPlayer) => {
      const steamId = toText(getRawValue(raw, ['steamId', 'steam_id', 'playerId', 'player_id', 'id']));
      const name = toText(getRawValue(raw, ['name', 'nickname', 'playerName', 'player_name'])) || steamId;
      const points = toNumber(getRawValue(raw, ['points', 'score', 'totalPoints', 'total_points']));

      if (!steamId || !name || points <= 0) {
        return null;
      }

      return {
        steamId,
        name,
        avatarUrl: toOptionalText(raw.avatarUrl ?? raw.avatar_url),
        points,
        rank: toNumber(getRawValue(raw, ['rank', 'place', 'position'])) || null,
        kills: toNumber(getRawValue(raw, ['kills', 'frags'])) || null,
        raids: toNumber(raw.raids) || null,
        farm: toNumber(getRawValue(raw, ['farm', 'farming'])) || null,
        loot: toNumber(raw.loot ?? raw.looting) || null,
        build: toNumber(raw.build ?? raw.building) || null,
        playtimeMinutes: toNumber(getRawValue(raw, ['playtimeMinutes', 'playtime_minutes', 'onlineMinutes', 'online_minutes'])) || null,
        meta: raw.meta ?? null,
      };
    })
    .filter(Boolean) as LeaderboardWipeResultsInput['players'];
}

function normalizeVillages(villages: unknown) {
  return toRawRecords(villages)
    .map((raw: RawVillage) => {
      const villageId = toText(getRawValue(raw, ['villageId', 'village_id', 'villageTag', 'village_tag', 'tag', 'clanId', 'clan_id', 'teamId', 'team_id', 'id']));
      const name = toText(getRawValue(raw, ['name', 'title', 'displayName', 'display_name', 'villageName', 'village_name'])) || villageId;
      const points = toNumber(getRawValue(raw, ['points', 'score', 'totalPoints', 'total_points']));

      if (!villageId || !name) {
        return null;
      }

      const rawMembers = toRawRecords(getRawValue(raw, ['members', 'players']));
      const members = rawMembers
        .map((member) => {
          const steamId = toText(getRawValue(member, ['steamId', 'steam_id', 'playerId', 'player_id', 'userId', 'user_id', 'id']));

          if (!steamId) {
            return null;
          }

          return {
            steamId,
            name: toOptionalText(getRawValue(member, ['name', 'nickname', 'playerName', 'player_name'])),
            role: toOptionalText(member.role),
            kills: toNumber(getRawValue(member, ['kills', 'frags'])) || null,
            raids: toNumber(member.raids) || null,
            farm: toNumber(getRawValue(member, ['farm', 'farming'])) || null,
            build: toNumber(getRawValue(member, ['build', 'building'])) || null,
            meta: member.meta ?? null,
          };
        })
        .filter(Boolean);

      const rawImageUrl = toOptionalText(getRawValue(raw, ['imageUrl', 'image_url', 'avatarUrl', 'avatar_url']));
      const imageUrl = rawImageUrl && /^https?:\/\//i.test(rawImageUrl) ? rawImageUrl : null;

      return {
        villageId,
        name,
        leaderSteamId: toOptionalText(raw.leaderSteamId ?? raw.leader_steam_id),
        leaderName: toOptionalText(getRawValue(raw, ['leaderName', 'leader_name', 'leader'])),
        deputySteamId: toOptionalText(raw.deputySteamId ?? raw.deputy_steam_id),
        deputyName: toOptionalText(getRawValue(raw, ['deputyName', 'deputy_name', 'deputy'])),
        imageUrl,
        points,
        rank: toNumber(getRawValue(raw, ['rank', 'place', 'position'])) || null,
        kills: toNumber(getRawValue(raw, ['kills', 'frags'])) || null,
        raids: toNumber(raw.raids) || null,
        farm: toNumber(getRawValue(raw, ['farm', 'farming'])) || null,
        playtimeMinutes: toNumber(getRawValue(raw, ['playtimeMinutes', 'playtime_minutes', 'onlineMinutes', 'online_minutes'])) || null,
        membersCount: toNumber(getRawValue(raw, ['membersCount', 'members_count', 'memberCount', 'member_count', 'playersCount', 'players_count', 'count'])) || members.length,
        members,
        meta: raw.meta ?? null,
      };
    })
    .filter(Boolean) as LeaderboardWipeResultsInput['villages'];
}

function getSharedLeaderboardApiKeys() {
  return [
    process.env.SERVER_apiKey,
    process.env.SERVER_API_KEY,
    process.env.NEXT_PUBLIC_apiKey,
    process.env.NEXT_PUBLIC_API_KEY,
    process.env.LEADERBOARD_API_KEY,
  ].filter(Boolean).map(String);
}

function getLeaderboardApiKeys(serverKey: string) {
  const serverSpecificKeys: Record<string, Array<string | undefined>> = {
    chill: [
      process.env.SERVER_CHILL_API_KEY,
      process.env.CHILL_SERVER_API_KEY,
      process.env.NEXT_PUBLIC_CHILL_API_KEY,
      process.env.LEADERBOARD_CHILL_API_KEY,
    ],
    hard: [
      process.env.SERVER_HARD_API_KEY,
      process.env.HARD_SERVER_API_KEY,
      process.env.NEXT_PUBLIC_HARD_API_KEY,
      process.env.LEADERBOARD_HARD_API_KEY,
    ],
    vanilla: [
      process.env.SERVER_VANILLA_API_KEY,
      process.env.VANILLA_SERVER_API_KEY,
      process.env.NEXT_PUBLIC_VANILLA_API_KEY,
      process.env.LEADERBOARD_VANILLA_API_KEY,
    ],
  };

  return Array.from(new Set([
    ...getSharedLeaderboardApiKeys(),
    ...(serverSpecificKeys[serverKey] || []).filter(Boolean).map(String),
  ]));
}

async function enrichLeaderboardAvatars(leaderboard: HallOfFamePayload): Promise<HallOfFamePayload> {
  const steamIds = new Set<string>();

  leaderboard.players.forEach((player) => {
    if (!player.avatarUrl) {
      steamIds.add(player.steamId);
    }
  });

  if (leaderboard.me && !leaderboard.me.avatarUrl) {
    steamIds.add(leaderboard.me.steamId);
  }

  if (steamIds.size === 0) {
    return leaderboard;
  }

  const profiles = await getSteamPlayerProfiles(Array.from(steamIds));

  return {
    ...leaderboard,
    players: leaderboard.players.map((player) => ({
      ...player,
      avatarUrl: player.avatarUrl || profiles[player.steamId]?.avatar || null,
    })),
    me: leaderboard.me
      ? {
        ...leaderboard.me,
        avatarUrl: leaderboard.me.avatarUrl || profiles[leaderboard.me.steamId]?.avatar || null,
      }
      : null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<LeaderboardResponse>) {
  if (req.method === 'GET') {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ ok: true, leaderboard: { period: 'all', season: null, players: [], villages: [] } });
    }

    try {
      await ensureDatabaseReady();
      const steamId = await getSteamIdFromRequest(req, res);
      const [leaderboard, me] = await Promise.all([
        db.getHallOfFame(req.query.period, req.query.limit),
        steamId ? db.getPlayerHallOfFameStats({ steamId, period: req.query.period }) : Promise.resolve(null),
      ]);

      const enrichedLeaderboard = await enrichLeaderboardAvatars({ ...leaderboard, me });

      return res.status(200).json({ ok: true, leaderboard: enrichedLeaderboard });
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        return res.status(200).json({ ok: true, leaderboard: { period: 'all', season: null, players: [], villages: [] } });
      }

      console.error('leaderboard GET error', error);
      return res.status(500).json({ ok: false, error: String(error) });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const providedKey = body.apiKey || req.headers['x-api-key'];
  const leaderboardBody = body.leaderboard && typeof body.leaderboard === 'object' ? body.leaderboard as RawRecord : {};

  const serverKey = toText(body.serverKey ?? body.server ?? body.server_key);
  const wipeKey = toText(body.wipeKey ?? body.wipeId ?? body.wipe_key ?? body.wipe_id);
  const players = normalizePlayers(
    getRawValue(body, ['players', 'playerStats', 'player_stats', 'playerLeaderboard', 'player_leaderboard', 'users'])
    ?? getRawValue(leaderboardBody, ['players', 'playerStats', 'player_stats', 'playerLeaderboard', 'player_leaderboard', 'users'])
  );
  const villages = normalizeVillages(
    getRawValue(body, ['villages', 'villageStats', 'village_stats', 'villageLeaderboard', 'village_leaderboard', 'topVillages', 'top_villages', 'teams', 'clans'])
    ?? getRawValue(leaderboardBody, ['villages', 'villageStats', 'village_stats', 'villageLeaderboard', 'village_leaderboard', 'topVillages', 'top_villages', 'teams', 'clans'])
  );

  if (!serverKey || !wipeKey) {
    return res.status(400).json({ ok: false, error: 'serverKey and wipeKey are required' });
  }

  const allowedKeys = getLeaderboardApiKeys(serverKey);

  if (allowedKeys.length === 0) {
    return res.status(500).json({ ok: false, error: 'Leaderboard API key is not configured' });
  }

  if (!providedKey || !allowedKeys.includes(String(providedKey))) {
    return res.status(401).json({ ok: false, error: 'Invalid apiKey' });
  }

  if (players.length === 0 && villages.length === 0) {
    return res.status(400).json({ ok: false, error: 'players or villages are required' });
  }

  try {
    await ensureDatabaseReady();
    const saved = await db.saveLeaderboardWipeResults({
      serverKey,
      wipeKey,
      season: toOptionalText(body.season),
      wipeStartedAt: toOptionalText(body.wipeStartedAt ?? body.wipe_started_at),
      wipeEndedAt: toOptionalText(body.wipeEndedAt ?? body.wipe_ended_at),
      players,
      villages,
      meta: body.meta ?? null,
    });

    console.info('leaderboard POST saved', {
      wipeId: saved.wipeId,
      playersCount: saved.playersCount,
      villagesCount: saved.villagesCount,
    });

    return res.status(200).json({
      ok: true,
      wipeId: saved.wipeId,
      playersCount: saved.playersCount,
      villagesCount: saved.villagesCount,
    });
  } catch (error) {
    console.error('leaderboard POST error', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
}
