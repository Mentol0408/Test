import { Pool, type PoolClient } from 'pg';

import { ACTIVITY_FREE_COINS_REWARD } from '@/lib/activityReward';
import type { AdminDashboardFilters, AdminDashboardPayload } from '@/types/admin';
import type { HallOfFamePayload, LeaderboardPeriod } from '@/types/leaderboard';
import type { SupportTicket, SupportTicketMessage, SupportTicketMessageAuthorRole, SupportTicketStatus } from '@/types/support';

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;
const DEFAULT_SERVER_STATUS_TTL_SECONDS = 5 * 60;

const DATABASE_UNAVAILABLE_CODES = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'EACCES',
    '57P01',
    '57P03',
]);

const DATABASE_UNAVAILABLE_TEXT = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'EACCES',
    'database_url is not configured',
];

function getPool() {
    if (!pool) {
        throw new Error('DATABASE_URL is not configured');
    }

    return pool;
}

function getServerStatusTtlSeconds() {
    const parsedValue = Number.parseInt(process.env.SERVER_STATUS_TTL_SECONDS || '', 10);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
        return parsedValue;
    }

    return DEFAULT_SERVER_STATUS_TTL_SECONDS;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as {
        code?: unknown;
        errors?: unknown;
        cause?: unknown;
        message?: unknown;
        stack?: unknown;
        errno?: unknown;
    };

    if (typeof candidate.code === 'string' && DATABASE_UNAVAILABLE_CODES.has(candidate.code)) {
        return true;
    }

    if (typeof candidate.errno === 'string' && DATABASE_UNAVAILABLE_CODES.has(candidate.errno)) {
        return true;
    }

    if (typeof candidate.message === 'string') {
        const normalizedMessage = candidate.message.toLowerCase();

        if (DATABASE_UNAVAILABLE_TEXT.some((token) => normalizedMessage.includes(token.toLowerCase()))) {
            return true;
        }
    }

    if (typeof candidate.stack === 'string') {
        const normalizedStack = candidate.stack.toLowerCase();

        if (DATABASE_UNAVAILABLE_TEXT.some((token) => normalizedStack.includes(token.toLowerCase()))) {
            return true;
        }
    }

    if (Array.isArray(candidate.errors) && candidate.errors.some((nestedError) => isDatabaseUnavailableError(nestedError))) {
        return true;
    }

    if (candidate.cause) {
        return isDatabaseUnavailableError(candidate.cause);
    }

    return false;
}

async function init() {
    if (!pool) {
        return;
    }

    await pool.query(
        `CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        server_key TEXT,
        item_type TEXT,
        amount INTEGER,
        status TEXT,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS purchase_logs (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
        server_key TEXT,
        event TEXT,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS server_stats (
        id SERIAL PRIMARY KEY,
        server_key TEXT UNIQUE,
        server_id INTEGER,
        map_size INTEGER,
        last_wipe BIGINT,
        next_wipe BIGINT,
        opened_cases INTEGER,
        online INTEGER,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query('ALTER TABLE server_stats ADD COLUMN IF NOT EXISTS team_limit INTEGER');

    await pool.query(
        `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_steamid TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS user_balances (
        user_steamid TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS balance_transactions (
        id SERIAL PRIMARY KEY,
        user_steamid TEXT NOT NULL,
        purchase_id INTEGER UNIQUE REFERENCES purchases(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        amount INTEGER NOT NULL,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS user_playtime_daily (
        user_steamid TEXT NOT NULL,
        server_key TEXT NOT NULL,
        activity_date DATE NOT NULL,
        tracked_minutes INTEGER NOT NULL DEFAULT 0,
        meta JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (user_steamid, server_key, activity_date)
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS reward_claims (
        id SERIAL PRIMARY KEY,
        user_steamid TEXT NOT NULL,
        reward_kind TEXT NOT NULL,
        claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE (user_steamid, reward_kind, claim_date)
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS discord_connections (
        user_steamid TEXT PRIMARY KEY,
        discord_user_id TEXT NOT NULL UNIQUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_steamid TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        closed_at TIMESTAMP WITH TIME ZONE
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        author_steamid TEXT NOT NULL,
        author_role TEXT NOT NULL,
        message TEXT NOT NULL,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )`
    );

    await pool.query('CREATE INDEX IF NOT EXISTS support_tickets_user_steamid_idx ON support_tickets (user_steamid)');
    await pool.query('CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status)');
    await pool.query('CREATE INDEX IF NOT EXISTS support_tickets_last_message_at_idx ON support_tickets (last_message_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_idx ON support_ticket_messages (ticket_id)');

    await pool.query(
        `CREATE TABLE IF NOT EXISTS leaderboard_wipes (
        id SERIAL PRIMARY KEY,
        server_key TEXT NOT NULL,
        wipe_key TEXT NOT NULL,
        season TEXT,
        wipe_started_at TIMESTAMP WITH TIME ZONE,
        wipe_ended_at TIMESTAMP WITH TIME ZONE,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE (server_key, wipe_key)
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS leaderboard_players (
        id SERIAL PRIMARY KEY,
        wipe_id INTEGER NOT NULL REFERENCES leaderboard_wipes(id) ON DELETE CASCADE,
        steam_id TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        rank INTEGER,
        kills INTEGER,
        raids INTEGER,
        farm INTEGER,
        playtime_minutes INTEGER,
        meta JSONB,
        UNIQUE (wipe_id, steam_id)
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS leaderboard_villages (
        id SERIAL PRIMARY KEY,
        wipe_id INTEGER NOT NULL REFERENCES leaderboard_wipes(id) ON DELETE CASCADE,
        village_id TEXT NOT NULL,
        name TEXT NOT NULL,
        leader_steam_id TEXT,
        leader_name TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        rank INTEGER,
        members_count INTEGER,
        meta JSONB,
        UNIQUE (wipe_id, village_id)
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS leaderboard_village_members (
        id SERIAL PRIMARY KEY,
        wipe_id INTEGER NOT NULL REFERENCES leaderboard_wipes(id) ON DELETE CASCADE,
        village_id TEXT NOT NULL,
        steam_id TEXT NOT NULL,
        player_name TEXT,
        role TEXT,
        meta JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE (wipe_id, village_id, steam_id)
        )`
    );

    await pool.query('ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()');
    await pool.query('ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS meta JSONB');
    await pool.query('ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS wipe_started_at TIMESTAMP WITH TIME ZONE');
    await pool.query('ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS wipe_ended_at TIMESTAMP WITH TIME ZONE');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS raids INTEGER');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS farm INTEGER');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS playtime_minutes INTEGER');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS loot INTEGER');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS build INTEGER');
    await pool.query('ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS meta JSONB');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS leader_steam_id TEXT');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS leader_name TEXT');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS members_count INTEGER');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS meta JSONB');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS image_url TEXT');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS deputy_steam_id TEXT');
    await pool.query('ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS deputy_name TEXT');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS wipe_id INTEGER REFERENCES leaderboard_wipes(id) ON DELETE CASCADE');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS village_id TEXT');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS player_name TEXT');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS kills INTEGER');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS raids INTEGER');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS farm INTEGER');
    await pool.query('ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS build INTEGER');
    await pool.query('ALTER TABLE leaderboard_village_members ALTER COLUMN wipe_id DROP NOT NULL');
    await pool.query('ALTER TABLE leaderboard_village_members ALTER COLUMN village_id DROP NOT NULL');
    await pool.query(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'leaderboard_village_members'
                  AND column_name = 'village_row_id'
            ) THEN
                ALTER TABLE leaderboard_village_members ALTER COLUMN village_row_id DROP NOT NULL;

                UPDATE leaderboard_village_members lvm
                SET
                    wipe_id = COALESCE(lvm.wipe_id, lv.wipe_id),
                    village_id = COALESCE(lvm.village_id, lv.village_id)
                FROM leaderboard_villages lv
                WHERE lv.id = lvm.village_row_id
                  AND (lvm.wipe_id IS NULL OR lvm.village_id IS NULL);
            END IF;

            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'leaderboard_village_members'
                  AND column_name = 'name'
            ) THEN
                UPDATE leaderboard_village_members
                SET player_name = COALESCE(player_name, name)
                WHERE player_name IS NULL;
            END IF;
        END $$;
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS leaderboard_wipes_period_idx ON leaderboard_wipes (season, wipe_ended_at DESC, created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS leaderboard_players_wipe_id_idx ON leaderboard_players (wipe_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS leaderboard_villages_wipe_id_idx ON leaderboard_villages (wipe_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS leaderboard_village_members_wipe_id_idx ON leaderboard_village_members (wipe_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS leaderboard_village_members_steam_id_idx ON leaderboard_village_members (steam_id)');
}

const databaseInitPromise = init();

databaseInitPromise.catch((error) => {
    if (!isDatabaseUnavailableError(error)) {
        console.error('Failed to initialize database', error);
    }
});

export async function ensureDatabaseReady() {
    await databaseInitPromise;
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await getPool().connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function createPurchase(params: {
    userId?: string | null;
    serverKey: string;
    itemType: string;
    amount?: number;
    meta?: unknown;
}) {
    const { userId, serverKey, itemType, amount = 0, meta = null } = params;
    const res = await getPool().query(
        'INSERT INTO purchases (user_id, server_key, item_type, amount, status, meta) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at',
        [userId || null, serverKey, itemType, amount, 'pending', meta]
    );
    return res.rows[0];
}

export async function addLog(params: {
    purchaseId?: number | null;
    serverKey: string;
    event: string;
    meta?: unknown;
}) {
    const { purchaseId = null, serverKey, event, meta = null } = params;
    const res = await getPool().query(
        'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
        [purchaseId, serverKey, event, meta]
    );
    return res.rows[0];
}

export async function updatePurchaseStatus(purchaseId: number, status: string, meta?: unknown) {
    await getPool().query('UPDATE purchases SET status=$1, meta = COALESCE($3::jsonb, meta) WHERE id=$2', [status, purchaseId, meta == null ? null : JSON.stringify(meta)]);
}

export async function addServerStats(params: {
    serverKey: string;
    serverId: number;
    mapSize?: number;
    teamLimit?: number;
    lastWipe?: number;
    nextWipe?: number;
    openedCases?: number;
    online?: number;
    meta?: unknown;
}) {
    const { serverKey, serverId, mapSize = null, teamLimit = null, lastWipe = null, nextWipe = null, openedCases = null, online = null, meta = null } = params;
    const res = await getPool().query(
        `INSERT INTO server_stats (server_key, server_id, map_size, team_limit, last_wipe, next_wipe, opened_cases, online, meta) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
         ON CONFLICT (server_key) DO UPDATE SET 
            server_id = $2,
            map_size = $3,
            team_limit = $4,
            last_wipe = $5,
            next_wipe = $6,
            opened_cases = $7,
            online = $8,
            meta = $9,
            created_at = now()
         RETURNING id, created_at`,
        [serverKey, serverId, mapSize, teamLimit, lastWipe, nextWipe, openedCases, online, meta]
    );
    return res.rows[0];
}

export async function getAggregatedStats() {
    const ttlSeconds = getServerStatusTtlSeconds();
    const perServer = await getPool().query(
        `SELECT server_key, server_id, map_size, team_limit, last_wipe, next_wipe, opened_cases,
                CASE
                    WHEN created_at >= now() - ($1::integer * INTERVAL '1 second') THEN COALESCE(online, 0)
                    ELSE 0
                END AS online
         FROM server_stats
         ORDER BY server_key`,
        [ttlSeconds]
    );
    return { perServer: perServer.rows };
}

export async function query(text: string, params?: unknown[]) {
    return getPool().query(text, params);
}

export async function getPurchaseById(purchaseId: number) {
    const result = await getPool().query(
        `SELECT id, user_id, server_key, item_type, amount, status, meta, created_at
         FROM purchases
         WHERE id=$1`,
        [purchaseId]
    );

    const row = result.rows[0];

    if (!row) {
        return null;
    }

    return {
        id: Number(row.id),
        userId: row.user_id || null,
        serverKey: row.server_key,
        itemType: row.item_type,
        amount: Number(row.amount || 0),
        status: row.status,
        meta: row.meta || null,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
}

export async function getUserBalance(userSteamId: string) {
    const result = await getPool().query(
        'SELECT balance FROM user_balances WHERE user_steamid=$1',
        [userSteamId]
    );

    return Number(result.rows[0]?.balance || 0);
}

export async function getUserBalanceTransactions(userSteamId: string, limit = 10) {
    const result = await getPool().query(
        `SELECT id, purchase_id, kind, amount, meta, created_at
         FROM balance_transactions
         WHERE user_steamid=$1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userSteamId, Math.min(Math.max(limit, 1), 50)]
    );

    return result.rows.map((row) => ({
        id: Number(row.id),
        purchaseId: row.purchase_id == null ? null : Number(row.purchase_id),
        kind: String(row.kind),
        amount: Number(row.amount || 0),
        meta: row.meta || null,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
}

export async function getDiscordConnection(userSteamId: string) {
    const result = await getPool().query(
        `SELECT user_steamid, discord_user_id, updated_at
         FROM discord_connections
         WHERE user_steamid = $1
         LIMIT 1`,
        [userSteamId]
    );

    const row = result.rows[0];

    if (!row) {
        return null;
    }

    return {
        userSteamId: String(row.user_steamid),
        discordUserId: String(row.discord_user_id),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
}

export async function upsertDiscordConnection(params: {
    userSteamId: string;
    discordUserId: string;
}) {
    const { userSteamId, discordUserId } = params;

    const result = await getPool().query(
        `INSERT INTO discord_connections (user_steamid, discord_user_id, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_steamid) DO UPDATE SET
            discord_user_id = EXCLUDED.discord_user_id,
            updated_at = now()
         RETURNING user_steamid, discord_user_id, updated_at`,
        [userSteamId, discordUserId]
    );

    const row = result.rows[0];

    return {
        userSteamId: String(row.user_steamid),
        discordUserId: String(row.discord_user_id),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
}

export async function getRecentVipPurchase(userSteamId: string, vipDays = 6) {
    const result = await getPool().query(
        `SELECT id, created_at
         FROM purchases
         WHERE user_id = $1
           AND item_type = 'vip'
           AND status = 'paid'
           AND created_at >= now() - ($2::int * INTERVAL '1 day')
         ORDER BY created_at DESC
         LIMIT 1`,
        [userSteamId, vipDays]
    );

    const row = result.rows[0];

    if (!row) {
        return null;
    }

    return {
        id: Number(row.id),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
}

export async function upsertUserPlaytimeDaily(entries: Array<{
    userSteamId: string;
    serverKey: string;
    trackedMinutes: number;
    activityDate?: string;
    meta?: unknown;
}>) {
    if (entries.length === 0) {
        return { updated: 0 };
    }

    return withTransaction(async (client) => {
        let updated = 0;

        for (const entry of entries) {
            const activityDate = entry.activityDate || new Date().toISOString().slice(0, 10);

            await client.query(
                `INSERT INTO user_playtime_daily (user_steamid, server_key, activity_date, tracked_minutes, meta, updated_at)
                 VALUES ($1,$2,$3,$4,$5,now())
                 ON CONFLICT (user_steamid, server_key, activity_date) DO UPDATE SET
                    tracked_minutes = GREATEST(user_playtime_daily.tracked_minutes, EXCLUDED.tracked_minutes),
                    meta = COALESCE(EXCLUDED.meta, user_playtime_daily.meta),
                    updated_at = now()`,
                [entry.userSteamId, entry.serverKey, activityDate, entry.trackedMinutes, entry.meta ?? null]
            );

            updated += 1;
        }

        return { updated };
    });
}

export async function getFreeCoinsRewardStatus(userSteamId: string) {
    const windowOffset = ACTIVITY_FREE_COINS_REWARD.windowDays - 1;

    const [progressResult, claimResult] = await Promise.all([
        getPool().query(
            `SELECT
                COALESCE(SUM(tracked_minutes), 0)::int AS tracked_minutes,
                COUNT(DISTINCT activity_date)::int AS active_days
             FROM user_playtime_daily
             WHERE user_steamid = $1
               AND activity_date >= CURRENT_DATE - $2::int`,
            [userSteamId, windowOffset]
        ),
        getPool().query(
            `SELECT created_at
             FROM reward_claims
             WHERE user_steamid = $1
               AND reward_kind = $2
               AND claim_date >= CURRENT_DATE - $3::int
             ORDER BY created_at DESC
             LIMIT 1`,
            [userSteamId, ACTIVITY_FREE_COINS_REWARD.kind, windowOffset]
        ),
    ]);

    const trackedMinutes = Number(progressResult.rows[0]?.tracked_minutes || 0);
    const activeDays = Number(progressResult.rows[0]?.active_days || 0);
    const claimRow = claimResult.rows[0] || null;
    const claimedRecently = Boolean(claimRow);

    return {
        trackedMinutes,
        requiredMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
        remainingMinutes: Math.max(ACTIVITY_FREE_COINS_REWARD.requiredMinutes - trackedMinutes, 0),
        activeDays,
        windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
        coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
        canClaim: trackedMinutes >= ACTIVITY_FREE_COINS_REWARD.requiredMinutes && !claimedRecently,
        claimedRecently,
        lastClaimAt: claimRow?.created_at instanceof Date ? claimRow.created_at.toISOString() : (claimRow?.created_at ? String(claimRow.created_at) : null),
    };
}

export async function claimFreeCoinsReward(params: {
    userSteamId: string;
    serverKey?: string;
}) {
    const { userSteamId, serverKey = 'donate' } = params;

    return withTransaction(async (client) => {
        const windowOffset = ACTIVITY_FREE_COINS_REWARD.windowDays - 1;

        const progressResult = await client.query(
            `SELECT
                COALESCE(SUM(tracked_minutes), 0)::int AS tracked_minutes,
                COUNT(DISTINCT activity_date)::int AS active_days
             FROM user_playtime_daily
             WHERE user_steamid = $1
               AND activity_date >= CURRENT_DATE - $2::int`,
            [userSteamId, windowOffset]
        );

        const trackedMinutes = Number(progressResult.rows[0]?.tracked_minutes || 0);
        const activeDays = Number(progressResult.rows[0]?.active_days || 0);

        const existingClaimResult = await client.query(
            `SELECT created_at
             FROM reward_claims
             WHERE user_steamid = $1
               AND reward_kind = $2
               AND claim_date >= CURRENT_DATE - $3::int
             ORDER BY created_at DESC
             LIMIT 1`,
            [userSteamId, ACTIVITY_FREE_COINS_REWARD.kind, windowOffset]
        );

        if (existingClaimResult.rows[0]) {
            return {
                ok: false,
                reason: 'already_claimed' as const,
                reward: {
                    trackedMinutes,
                    requiredMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
                    remainingMinutes: Math.max(ACTIVITY_FREE_COINS_REWARD.requiredMinutes - trackedMinutes, 0),
                    activeDays,
                    windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                    canClaim: false,
                    claimedRecently: true,
                    lastClaimAt: existingClaimResult.rows[0].created_at instanceof Date ? existingClaimResult.rows[0].created_at.toISOString() : String(existingClaimResult.rows[0].created_at),
                },
            };
        }

        if (trackedMinutes < ACTIVITY_FREE_COINS_REWARD.requiredMinutes) {
            return {
                ok: false,
                reason: 'requirement_not_met' as const,
                reward: {
                    trackedMinutes,
                    requiredMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
                    remainingMinutes: Math.max(ACTIVITY_FREE_COINS_REWARD.requiredMinutes - trackedMinutes, 0),
                    activeDays,
                    windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                    canClaim: false,
                    claimedRecently: false,
                    lastClaimAt: null,
                },
            };
        }

        const claimResult = await client.query(
            `INSERT INTO reward_claims (user_steamid, reward_kind, meta)
             VALUES ($1,$2,$3)
             ON CONFLICT (user_steamid, reward_kind, claim_date) DO NOTHING
             RETURNING id, created_at`,
            [
                userSteamId,
                ACTIVITY_FREE_COINS_REWARD.kind,
                {
                    trackedMinutes,
                    activeDays,
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                    windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
                },
            ]
        );

        const insertedClaim = claimResult.rows[0];

        if (!insertedClaim) {
            return {
                ok: false,
                reason: 'already_claimed' as const,
                reward: {
                    trackedMinutes,
                    requiredMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
                    remainingMinutes: 0,
                    activeDays,
                    windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                    canClaim: false,
                    claimedRecently: true,
                    lastClaimAt: null,
                },
            };
        }

        const purchaseResult = await client.query(
            `INSERT INTO purchases (user_id, server_key, item_type, amount, status, meta)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING id, created_at`,
            [
                userSteamId,
                serverKey,
                'coins',
                0,
                'paid',
                {
                    provider: 'activity_reward',
                    paymentType: 'coins',
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                    rewardKind: ACTIVITY_FREE_COINS_REWARD.kind,
                    freeReward: true,
                },
            ]
        );

        const purchase = purchaseResult.rows[0];

        await client.query(
            'UPDATE reward_claims SET purchase_id = $2 WHERE id = $1',
            [insertedClaim.id, purchase.id]
        );

        await client.query(
            'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4)',
            [
                purchase.id,
                serverKey,
                'activity_reward_claimed',
                {
                    rewardKind: ACTIVITY_FREE_COINS_REWARD.kind,
                    trackedMinutes,
                    activeDays,
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                },
            ]
        );

        await client.query(
            `INSERT INTO balance_transactions (user_steamid, purchase_id, kind, amount, meta)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (purchase_id) DO NOTHING`,
            [
                userSteamId,
                purchase.id,
                'credit',
                ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                {
                    provider: 'activity_reward',
                    rewardKind: ACTIVITY_FREE_COINS_REWARD.kind,
                    freeReward: true,
                },
            ]
        );

        await client.query(
            `INSERT INTO user_balances (user_steamid, balance, updated_at)
             VALUES ($1,$2,now())
             ON CONFLICT (user_steamid) DO UPDATE SET
                balance = user_balances.balance + EXCLUDED.balance,
                updated_at = now()`,
            [userSteamId, ACTIVITY_FREE_COINS_REWARD.coinsAmount]
        );

        await client.query(
            'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4)',
            [
                purchase.id,
                serverKey,
                'balance_topup_applied',
                {
                    provider: 'activity_reward',
                    rewardKind: ACTIVITY_FREE_COINS_REWARD.kind,
                    coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                    freeReward: true,
                },
            ]
        );

        return {
            ok: true,
            purchase: {
                id: Number(purchase.id),
                createdAt: purchase.created_at instanceof Date ? purchase.created_at.toISOString() : String(purchase.created_at),
            },
            reward: {
                trackedMinutes,
                requiredMinutes: ACTIVITY_FREE_COINS_REWARD.requiredMinutes,
                remainingMinutes: 0,
                activeDays,
                windowDays: ACTIVITY_FREE_COINS_REWARD.windowDays,
                coinsAmount: ACTIVITY_FREE_COINS_REWARD.coinsAmount,
                canClaim: false,
                claimedRecently: true,
                lastClaimAt: insertedClaim.created_at instanceof Date ? insertedClaim.created_at.toISOString() : String(insertedClaim.created_at),
            },
        };
    });
}

export async function applyBalanceTopup(params: {
    userSteamId: string;
    purchaseId: number;
    amount: number;
    meta?: unknown;
}) {
    const { userSteamId, purchaseId, amount, meta = null } = params;

    return withTransaction(async (client) => {
        const insertedTransaction = await client.query(
            `INSERT INTO balance_transactions (user_steamid, purchase_id, kind, amount, meta)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (purchase_id) DO NOTHING
             RETURNING id`,
            [userSteamId, purchaseId, 'credit', amount, meta]
        );

        if (insertedTransaction.rows.length === 0) {
            const existingBalance = await client.query(
                'SELECT balance FROM user_balances WHERE user_steamid=$1',
                [userSteamId]
            );

            return {
                applied: false,
                balance: Number(existingBalance.rows[0]?.balance || 0),
            };
        }

        const balanceResult = await client.query(
            `INSERT INTO user_balances (user_steamid, balance, updated_at)
             VALUES ($1,$2,now())
             ON CONFLICT (user_steamid) DO UPDATE SET
                balance = user_balances.balance + EXCLUDED.balance,
                updated_at = now()
             RETURNING balance`,
            [userSteamId, amount]
        );

        await client.query(
            'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4)',
            [purchaseId, 'donate', 'balance_topup_applied', meta]
        );

        return {
            applied: true,
            balance: Number(balanceResult.rows[0]?.balance || 0),
        };
    });
}

export async function creditUserBalanceManually(params: {
    userSteamId: string;
    amount: number;
    adminSteamId: string;
    reason?: string | null;
}) {
    const { userSteamId, amount, adminSteamId, reason = null } = params;
    const meta = {
        provider: 'admin',
        adminSteamId,
        reason,
    };

    return withTransaction(async (client) => {
        await client.query(
            `INSERT INTO balance_transactions (user_steamid, purchase_id, kind, amount, meta)
             VALUES ($1,$2,$3,$4,$5)`,
            [userSteamId, null, 'credit', amount, meta]
        );

        const balanceResult = await client.query(
            `INSERT INTO user_balances (user_steamid, balance, updated_at)
             VALUES ($1,$2,now())
             ON CONFLICT (user_steamid) DO UPDATE SET
                balance = user_balances.balance + EXCLUDED.balance,
                updated_at = now()
             RETURNING balance`,
            [userSteamId, amount]
        );

        await client.query(
            'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4)',
            [null, 'admin', 'manual_balance_credit', meta]
        );

        return {
            balance: Number(balanceResult.rows[0]?.balance || 0),
        };
    });
}

export async function searchAdminPlayers(params: {
    query: string;
    limit?: number;
}) {
    const query = params.query.trim();
    const limit = Math.min(Math.max(params.limit ?? 12, 1), 25);

    if (query.length < 2) {
        return [];
    }

    const steamDigits = query.replace(/\D/g, '').slice(0, 32);
    const textQuery = `%${query.toLowerCase()}%`;
    const steamQuery = steamDigits ? `%${steamDigits}%` : null;

    const result = await getPool().query(
        `WITH player_sources AS (
            SELECT p.user_id AS steam_id, NULL::text AS name, 1 AS source_rank, MAX(p.created_at) AS last_seen_at
            FROM purchases p
            WHERE p.user_id IS NOT NULL
              AND ($2::text IS NOT NULL AND p.user_id LIKE $2)
            GROUP BY p.user_id

            UNION ALL

            SELECT ub.user_steamid AS steam_id, NULL::text AS name, 2 AS source_rank, MAX(ub.updated_at) AS last_seen_at
            FROM user_balances ub
            WHERE $2::text IS NOT NULL AND ub.user_steamid LIKE $2
            GROUP BY ub.user_steamid

            UNION ALL

            SELECT bt.user_steamid AS steam_id, NULL::text AS name, 3 AS source_rank, MAX(bt.created_at) AS last_seen_at
            FROM balance_transactions bt
            WHERE $2::text IS NOT NULL AND bt.user_steamid LIKE $2
            GROUP BY bt.user_steamid

            UNION ALL

            SELECT lp.steam_id, lp.name, 4 AS source_rank, MAX(COALESCE(lw.wipe_ended_at, lw.updated_at, lw.created_at)) AS last_seen_at
            FROM leaderboard_players lp
            LEFT JOIN leaderboard_wipes lw ON lw.id = lp.wipe_id
            WHERE LOWER(lp.name) LIKE $1
               OR ($2::text IS NOT NULL AND lp.steam_id LIKE $2)
            GROUP BY lp.steam_id, lp.name

            UNION ALL

            SELECT lvm.steam_id, lvm.player_name AS name, 5 AS source_rank, MAX(COALESCE(lw.wipe_ended_at, lw.updated_at, lw.created_at)) AS last_seen_at
            FROM leaderboard_village_members lvm
            LEFT JOIN leaderboard_wipes lw ON lw.id = lvm.wipe_id
            WHERE (lvm.player_name IS NOT NULL AND LOWER(lvm.player_name) LIKE $1)
               OR ($2::text IS NOT NULL AND lvm.steam_id LIKE $2)
            GROUP BY lvm.steam_id, lvm.player_name
        ),
        ranked_players AS (
            SELECT
                steam_id,
                (ARRAY_AGG(name ORDER BY CASE WHEN name IS NULL OR name = '' THEN 1 ELSE 0 END, last_seen_at DESC NULLS LAST))[1] AS name,
                MIN(source_rank) AS source_rank,
                MAX(last_seen_at) AS last_seen_at
            FROM player_sources
            WHERE steam_id IS NOT NULL AND steam_id <> ''
            GROUP BY steam_id
        )
        SELECT
            rp.steam_id,
            rp.name,
            COALESCE(ub.balance, 0)::int AS balance,
            CASE rp.source_rank
                WHEN 1 THEN 'purchases'
                WHEN 2 THEN 'balance'
                WHEN 3 THEN 'balance_transactions'
                WHEN 4 THEN 'leaderboard'
                ELSE 'village_members'
            END AS source
        FROM ranked_players rp
        LEFT JOIN user_balances ub ON ub.user_steamid = rp.steam_id
        ORDER BY
            CASE WHEN rp.steam_id = $3 THEN 0 ELSE 1 END,
            rp.last_seen_at DESC NULLS LAST,
            rp.steam_id ASC
        LIMIT $4`,
        [textQuery, steamQuery, steamDigits || null, limit]
    );

    return result.rows.map((row) => ({
        steamId: String(row.steam_id),
        name: row.name ? String(row.name) : null,
        balance: Number(row.balance || 0),
        source: String(row.source || 'database'),
    }));
}

export async function createPurchaseWithBalance(params: {
    userSteamId: string;
    itemType: string;
    amount: number;
    meta?: unknown;
}) {
    const { userSteamId, itemType, amount, meta = null } = params;

    return withTransaction(async (client) => {
        const currentBalanceResult = await client.query(
            'SELECT balance FROM user_balances WHERE user_steamid=$1 FOR UPDATE',
            [userSteamId]
        );

        const currentBalance = Number(currentBalanceResult.rows[0]?.balance || 0);

        if (currentBalance < amount) {
            return {
                ok: false,
                balance: currentBalance,
                purchase: null,
            };
        }

        const purchaseResult = await client.query(
            'INSERT INTO purchases (user_id, server_key, item_type, amount, status, meta) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at',
            [userSteamId, 'donate', itemType, amount, 'paid', meta]
        );

        const purchase = purchaseResult.rows[0];

        const updatedBalanceResult = await client.query(
            'UPDATE user_balances SET balance = balance - $2, updated_at = now() WHERE user_steamid=$1 RETURNING balance',
            [userSteamId, amount]
        );

        await client.query(
            'INSERT INTO balance_transactions (user_steamid, purchase_id, kind, amount, meta) VALUES ($1,$2,$3,$4,$5)',
            [userSteamId, purchase.id, 'debit', -amount, meta]
        );

        await client.query(
            'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4)',
            [purchase.id, 'donate', 'balance_purchase_completed', meta]
        );

        return {
            ok: true,
            balance: Number(updatedBalanceResult.rows[0]?.balance || 0),
            purchase: {
                id: Number(purchase.id),
                created_at: purchase.created_at instanceof Date ? purchase.created_at.toISOString() : String(purchase.created_at),
            },
        };
    });
}

export async function revertBalancePurchase(params: {
    userSteamId: string;
    purchaseId: number;
    meta?: unknown;
}) {
    const { userSteamId, purchaseId, meta = null } = params

    return withTransaction(async (client) => {
        const debitResult = await client.query(
            `SELECT id, amount
             FROM balance_transactions
             WHERE purchase_id=$1 AND user_steamid=$2 AND kind='debit'
             FOR UPDATE`,
            [purchaseId, userSteamId]
        )

        if (debitResult.rows.length === 0) {
            const existingBalance = await client.query(
                'SELECT balance FROM user_balances WHERE user_steamid=$1',
                [userSteamId]
            )

            return {
                reverted: false,
                balance: Number(existingBalance.rows[0]?.balance || 0),
            }
        }

        const refundAmount = Math.abs(Number(debitResult.rows[0]?.amount || 0))

        await client.query('DELETE FROM balance_transactions WHERE id=$1', [debitResult.rows[0].id])

        const balanceResult = await client.query(
            `INSERT INTO user_balances (user_steamid, balance, updated_at)
             VALUES ($1,$2,now())
             ON CONFLICT (user_steamid) DO UPDATE SET
                balance = user_balances.balance + EXCLUDED.balance,
                updated_at = now()
             RETURNING balance`,
            [userSteamId, refundAmount]
        )

        await client.query('UPDATE purchases SET status=$1 WHERE id=$2', ['failed', purchaseId])

        await client.query(
            'INSERT INTO purchase_logs (purchase_id, server_key, event, meta) VALUES ($1,$2,$3,$4)',
            [purchaseId, 'donate', 'balance_purchase_reverted', meta]
        )

        return {
            reverted: true,
            balance: Number(balanceResult.rows[0]?.balance || 0),
        }
    })
}

export type LeaderboardWipeResultsInput = {
    serverKey: string;
    wipeKey: string;
    season?: string | null;
    wipeStartedAt?: string | null;
    wipeEndedAt?: string | null;
    players: Array<{
        steamId: string;
        name: string;
        avatarUrl?: string | null;
        points: number;
        rank?: number | null;
        kills?: number | null;
        raids?: number | null;
        farm?: number | null;
        loot?: number | null;
        build?: number | null;
        playtimeMinutes?: number | null;
        meta?: unknown;
    }>;
    villages: Array<{
        villageId: string;
        name: string;
        leaderSteamId?: string | null;
        leaderName?: string | null;
        deputySteamId?: string | null;
        deputyName?: string | null;
        imageUrl?: string | null;
        points: number;
        rank?: number | null;
        membersCount?: number | null;
        members?: Array<{
            steamId: string;
            name?: string | null;
            role?: string | null;
            kills?: number | null;
            raids?: number | null;
            farm?: number | null;
            build?: number | null;
            meta?: unknown;
        }>;
        meta?: unknown;
    }>;
    meta?: unknown;
};

const supportTicketStatuses = new Set<SupportTicketStatus>(['open', 'in_progress', 'resolved', 'closed']);

function toIsoString(value: unknown) {
    return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeLeaderboardPeriod(value: unknown): LeaderboardPeriod {
    return value === 'season' ? 'season' : 'all';
}

function normalizeLeaderboardLimit(value: unknown) {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
        return 10;
    }

    return Math.min(Math.max(Math.trunc(parsedValue), 1), 50);
}

function getLeaderboardWipeFilter(period: LeaderboardPeriod, alias = 'w') {
    if (period === 'season') {
        return `${alias}.season = (
            SELECT season
            FROM leaderboard_wipes
            WHERE season IS NOT NULL AND season <> ''
            ORDER BY COALESCE(wipe_ended_at, created_at) DESC, id DESC
            LIMIT 1
        )`;
    }

    return 'TRUE';
}

export async function getHallOfFame(periodValue?: unknown, limitValue?: unknown): Promise<HallOfFamePayload> {
    const period = normalizeLeaderboardPeriod(periodValue);
    const limit = normalizeLeaderboardLimit(limitValue);
    const wipeFilter = getLeaderboardWipeFilter(period);
    const villageMembershipFilter = getLeaderboardWipeFilter(period, 'vw');
    const currentPool = getPool();

    const [seasonResult, playersResult, villagesResult] = await Promise.all([
        currentPool.query(
            `SELECT season
             FROM leaderboard_wipes
             WHERE season IS NOT NULL AND season <> ''
             ORDER BY COALESCE(wipe_ended_at, created_at) DESC, id DESC
             LIMIT 1`
        ),
        currentPool.query(
            `WITH latest_player_villages AS (
                SELECT DISTINCT ON (lvm.steam_id)
                    lvm.steam_id,
                    lv.village_id AS village_tag
                FROM leaderboard_village_members lvm
                INNER JOIN leaderboard_villages lv ON lv.wipe_id = lvm.wipe_id AND lv.village_id = lvm.village_id
                INNER JOIN leaderboard_wipes vw ON vw.id = lv.wipe_id
                WHERE ${villageMembershipFilter}
                ORDER BY lvm.steam_id, COALESCE(vw.wipe_ended_at, vw.created_at) DESC, lv.id DESC
             ),
             player_totals AS (
                SELECT
                    lp.steam_id,
                    (ARRAY_AGG(lp.name ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS name,
                    (ARRAY_AGG(lp.avatar_url ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS avatar_url,
                    MAX(lpv.village_tag) AS village_tag,
                    SUM(lp.points)::int AS total_points,
                    COUNT(*)::int AS wipes_played,
                    COUNT(*) FILTER (WHERE lp.rank = 1)::int AS wins,
                    COUNT(*) FILTER (WHERE lp.rank BETWEEN 1 AND 3)::int AS top_three,
                    MAX(lp.points)::int AS best_points,
                    ROUND(AVG(lp.points))::int AS average_points,
                    COALESCE(SUM(lp.kills), 0)::int AS total_kills,
                    COALESCE(SUM(lp.raids), 0)::int AS total_raids,
                    COALESCE(SUM(lp.farm), 0)::int AS total_farm,
                    COALESCE(SUM(lp.loot), 0)::int AS total_loot,
                    COALESCE(SUM(lp.build), 0)::int AS total_build,
                    COALESCE(SUM(lp.playtime_minutes), 0)::int AS total_playtime_minutes,
                    MAX(COALESCE(w.wipe_ended_at, w.created_at)) AS last_wipe_at
                 FROM leaderboard_players lp
                 INNER JOIN leaderboard_wipes w ON w.id = lp.wipe_id
                 LEFT JOIN latest_player_villages lpv ON lpv.steam_id = lp.steam_id
                 WHERE ${wipeFilter}
                 GROUP BY lp.steam_id
             )
             SELECT
                ROW_NUMBER() OVER (ORDER BY total_points DESC, best_points DESC, steam_id ASC)::int AS rank,
                *
             FROM player_totals
             ORDER BY total_points DESC, best_points DESC, steam_id ASC
             LIMIT $1`,
            [limit]
        ),
        currentPool.query(
            `WITH player_totals AS (
                SELECT
                    lp.steam_id,
                    COALESCE(SUM(lp.kills), 0)::int AS total_kills,
                    COALESCE(SUM(lp.farm), 0)::int AS total_farm,
                    COALESCE(SUM(lp.build), 0)::int AS total_build,
                    COALESCE(SUM(lp.playtime_minutes), 0)::int AS total_playtime_minutes
                FROM leaderboard_players lp
                INNER JOIN leaderboard_wipes pw ON pw.id = lp.wipe_id
                WHERE ${getLeaderboardWipeFilter(period, 'pw')}
                GROUP BY lp.steam_id
             ),
             village_player_totals AS (
                SELECT
                    lvm.wipe_id,
                    lvm.village_id,
                    COALESCE(SUM(pt.total_kills), 0)::int AS total_kills,
                    COALESCE(SUM(pt.total_farm), 0)::int AS total_farm,
                    COALESCE(SUM(pt.total_build), 0)::int AS total_build,
                    COALESCE(SUM(pt.total_playtime_minutes), 0)::int AS total_playtime_minutes
                FROM leaderboard_village_members lvm
                INNER JOIN leaderboard_wipes w ON w.id = lvm.wipe_id
                LEFT JOIN player_totals pt ON pt.steam_id = lvm.steam_id
                WHERE ${wipeFilter}
                GROUP BY lvm.wipe_id, lvm.village_id
             ),
             village_totals AS (
                SELECT
                    lv.village_id,
                    (ARRAY_AGG(lv.name ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS name,
                    (ARRAY_AGG(lv.leader_steam_id ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS leader_steam_id,
                    (ARRAY_AGG(lv.leader_name ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS leader_name,
                    (ARRAY_AGG(lv.deputy_steam_id ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS deputy_steam_id,
                    (ARRAY_AGG(lv.deputy_name ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS deputy_name,
                    (ARRAY_AGG(lv.image_url ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC) FILTER (WHERE lv.image_url IS NOT NULL))[1] AS image_url,
                    SUM(lv.points)::int AS total_points,
                    COUNT(*)::int AS wipes_played,
                    COUNT(*) FILTER (WHERE lv.rank = 1)::int AS wins,
                    COUNT(*) FILTER (WHERE lv.rank BETWEEN 1 AND 3)::int AS top_three,
                    MAX(lv.points)::int AS best_points,
                    ROUND(AVG(lv.points))::int AS average_points,
                    MAX(COALESCE(lv.members_count, 0))::int AS members_count,
                    COALESCE(SUM(vpt.total_kills), 0)::int AS total_kills,
                    COALESCE(SUM(
                        CASE
                            WHEN jsonb_typeof(lv.meta->'raids') = 'number' THEN (lv.meta->>'raids')::int
                            ELSE 0
                        END
                    ), 0)::int AS total_raids,
                    COALESCE(SUM(vpt.total_farm), 0)::int AS total_farm,
                    COALESCE(SUM(vpt.total_build), 0)::int AS total_build,
                    COALESCE(SUM(vpt.total_playtime_minutes), 0)::int AS total_playtime_minutes,
                    MAX(COALESCE(w.wipe_ended_at, w.created_at)) AS last_wipe_at
                 FROM leaderboard_villages lv
                 INNER JOIN leaderboard_wipes w ON w.id = lv.wipe_id
                 LEFT JOIN village_player_totals vpt ON vpt.wipe_id = lv.wipe_id AND vpt.village_id = lv.village_id
                 WHERE ${wipeFilter}
                 GROUP BY lv.village_id
             )
             SELECT
                ROW_NUMBER() OVER (ORDER BY total_points DESC, best_points DESC, village_id ASC)::int AS rank,
                *
             FROM village_totals
             ORDER BY total_points DESC, best_points DESC, village_id ASC
             LIMIT $1`,
            [limit]
        ),
    ]);

    return {
        period,
        season: seasonResult.rows[0]?.season ?? null,
        players: playersResult.rows.map((row) => ({
            rank: Number(row.rank),
            steamId: String(row.steam_id),
            name: String(row.name || row.steam_id),
            avatarUrl: row.avatar_url || null,
            villageTag: row.village_tag || null,
            totalPoints: Number(row.total_points || 0),
            wipesPlayed: Number(row.wipes_played || 0),
            wins: Number(row.wins || 0),
            topThree: Number(row.top_three || 0),
            bestPoints: Number(row.best_points || 0),
            averagePoints: Number(row.average_points || 0),
            totalKills: Number(row.total_kills || 0),
            totalRaids: Number(row.total_raids || 0),
            totalFarm: Number(row.total_farm || 0),
            totalLoot: Number(row.total_loot || 0),
            totalBuild: Number(row.total_build || 0),
            totalPlaytimeMinutes: Number(row.total_playtime_minutes || 0),
            lastWipeAt: row.last_wipe_at ? toIsoString(row.last_wipe_at) : null,
        })),
        villages: villagesResult.rows.map((row) => ({
            rank: Number(row.rank),
            villageId: String(row.village_id),
            name: String(row.name || row.village_id),
            leaderSteamId: row.leader_steam_id || null,
            leaderName: row.leader_name || null,
            deputySteamId: row.deputy_steam_id || null,
            deputyName: row.deputy_name || null,
            imageUrl: row.image_url || null,
            totalPoints: Number(row.total_points || 0),
            wipesPlayed: Number(row.wipes_played || 0),
            wins: Number(row.wins || 0),
            topThree: Number(row.top_three || 0),
            bestPoints: Number(row.best_points || 0),
            averagePoints: Number(row.average_points || 0),
            membersCount: Number(row.members_count || 0),
            totalKills: Number(row.total_kills || 0),
            totalRaids: Number(row.total_raids || 0),
            totalFarm: Number(row.total_farm || 0),
            totalBuild: Number(row.total_build || 0),
            totalPlaytimeMinutes: Number(row.total_playtime_minutes || 0),
            lastWipeAt: row.last_wipe_at ? toIsoString(row.last_wipe_at) : null,
        })),
    };
}

export async function getPlayerHallOfFameStats(params: {
    steamId: string;
    period?: unknown;
}): Promise<HallOfFamePayload['me']> {
    const steamId = params.steamId.trim();

    if (!steamId) {
        return null;
    }

    const period = normalizeLeaderboardPeriod(params.period);
    const wipeFilter = getLeaderboardWipeFilter(period);
    const villageMembershipFilter = getLeaderboardWipeFilter(period, 'vw');
    const result = await getPool().query(
        `WITH latest_player_villages AS (
            SELECT DISTINCT ON (lvm.steam_id)
                lvm.steam_id,
                lv.village_id AS village_tag
            FROM leaderboard_village_members lvm
            INNER JOIN leaderboard_villages lv ON lv.wipe_id = lvm.wipe_id AND lv.village_id = lvm.village_id
            INNER JOIN leaderboard_wipes vw ON vw.id = lv.wipe_id
            WHERE ${villageMembershipFilter}
            ORDER BY lvm.steam_id, COALESCE(vw.wipe_ended_at, vw.created_at) DESC, lv.id DESC
        ),
        player_totals AS (
            SELECT
                lp.steam_id,
                (ARRAY_AGG(lp.name ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS name,
                (ARRAY_AGG(lp.avatar_url ORDER BY COALESCE(w.wipe_ended_at, w.created_at) DESC, w.id DESC))[1] AS avatar_url,
                MAX(lpv.village_tag) AS village_tag,
                SUM(lp.points)::int AS total_points,
                COUNT(*)::int AS wipes_played,
                COUNT(*) FILTER (WHERE lp.rank = 1)::int AS wins,
                COUNT(*) FILTER (WHERE lp.rank BETWEEN 1 AND 3)::int AS top_three,
                MAX(lp.points)::int AS best_points,
                ROUND(AVG(lp.points))::int AS average_points,
                COALESCE(SUM(lp.kills), 0)::int AS total_kills,
                COALESCE(SUM(lp.raids), 0)::int AS total_raids,
                COALESCE(SUM(lp.farm), 0)::int AS total_farm,
                COALESCE(SUM(lp.loot), 0)::int AS total_loot,
                COALESCE(SUM(lp.build), 0)::int AS total_build,
                COALESCE(SUM(lp.playtime_minutes), 0)::int AS total_playtime_minutes,
                MAX(COALESCE(w.wipe_ended_at, w.created_at)) AS last_wipe_at
             FROM leaderboard_players lp
             INNER JOIN leaderboard_wipes w ON w.id = lp.wipe_id
             LEFT JOIN latest_player_villages lpv ON lpv.steam_id = lp.steam_id
             WHERE ${wipeFilter}
             GROUP BY lp.steam_id
        ),
        ranked_players AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY total_points DESC, best_points DESC, steam_id ASC)::int AS rank,
                *
            FROM player_totals
        )
        SELECT *
        FROM ranked_players
        WHERE steam_id = $1
        LIMIT 1`,
        [steamId]
    );
    const row = result.rows[0];

    if (!row) {
        return null;
    }

    return {
        rank: Number(row.rank),
        steamId: String(row.steam_id),
        name: String(row.name || row.steam_id),
        avatarUrl: row.avatar_url || null,
        villageTag: row.village_tag || null,
        totalPoints: Number(row.total_points || 0),
        wipesPlayed: Number(row.wipes_played || 0),
        wins: Number(row.wins || 0),
        topThree: Number(row.top_three || 0),
        bestPoints: Number(row.best_points || 0),
        averagePoints: Number(row.average_points || 0),
        totalKills: Number(row.total_kills || 0),
        totalRaids: Number(row.total_raids || 0),
        totalFarm: Number(row.total_farm || 0),
        totalLoot: Number(row.total_loot || 0),
        totalBuild: Number(row.total_build || 0),
        totalPlaytimeMinutes: Number(row.total_playtime_minutes || 0),
        lastWipeAt: row.last_wipe_at ? toIsoString(row.last_wipe_at) : null,
    };
}

export async function saveLeaderboardWipeResults(input: LeaderboardWipeResultsInput) {
    return withTransaction(async (client) => {
        const wipeResult = await client.query(
            `INSERT INTO leaderboard_wipes (server_key, wipe_key, season, wipe_started_at, wipe_ended_at, meta, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,now())
             ON CONFLICT (server_key, wipe_key) DO UPDATE SET
                season = EXCLUDED.season,
                wipe_started_at = EXCLUDED.wipe_started_at,
                wipe_ended_at = EXCLUDED.wipe_ended_at,
                meta = EXCLUDED.meta,
                updated_at = now()
             RETURNING id`,
            [
                input.serverKey,
                input.wipeKey,
                input.season || null,
                input.wipeStartedAt || null,
                input.wipeEndedAt || null,
                input.meta ?? null,
            ]
        );
        const wipeId = Number(wipeResult.rows[0].id);

        await client.query('DELETE FROM leaderboard_players WHERE wipe_id=$1', [wipeId]);
        await client.query('DELETE FROM leaderboard_village_members WHERE wipe_id=$1', [wipeId]);
        await client.query('DELETE FROM leaderboard_villages WHERE wipe_id=$1', [wipeId]);

        for (const player of input.players) {
            await client.query(
                `INSERT INTO leaderboard_players
                    (wipe_id, steam_id, name, avatar_url, points, rank, kills, raids, farm, loot, build, playtime_minutes, meta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [
                    wipeId,
                    player.steamId,
                    player.name,
                    player.avatarUrl || null,
                    player.points,
                    player.rank ?? null,
                    player.kills ?? null,
                    player.raids ?? null,
                    player.farm ?? null,
                    player.loot ?? null,
                    player.build ?? null,
                    player.playtimeMinutes ?? null,
                    player.meta ?? null,
                ]
            );
        }

        for (const village of input.villages) {
            await client.query(
                `INSERT INTO leaderboard_villages
                    (wipe_id, village_id, name, leader_steam_id, leader_name, deputy_steam_id, deputy_name, image_url, points, rank, members_count, meta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                 RETURNING id`,
                [
                    wipeId,
                    village.villageId,
                    village.name,
                    village.leaderSteamId || null,
                    village.leaderName || null,
                    village.deputySteamId || null,
                    village.deputyName || null,
                    village.imageUrl || null,
                    village.points,
                    village.rank ?? null,
                    village.membersCount ?? village.members?.length ?? null,
                    village.meta ?? null,
                ]
            );
            for (const member of village.members || []) {
                await client.query(
                    `INSERT INTO leaderboard_village_members (wipe_id, village_id, steam_id, player_name, role, kills, raids, farm, build, meta)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                    [
                        wipeId,
                        village.villageId,
                        member.steamId,
                        member.name || null,
                        member.role || null,
                        member.kills ?? null,
                        member.raids ?? null,
                        member.farm ?? null,
                        member.build ?? null,
                        member.meta ?? null,
                    ]
                );
            }
        }

        return { wipeId };
    });
}

function normalizeSupportTicketStatus(value: unknown): SupportTicketStatus {
    if (typeof value === 'string' && supportTicketStatuses.has(value as SupportTicketStatus)) {
        return value as SupportTicketStatus;
    }

    return 'open';
}

function mapSupportTicketMessageRow(row: Record<string, unknown>): SupportTicketMessage {
    return {
        id: Number(row.id),
        ticketId: Number(row.ticket_id),
        authorSteamId: String(row.author_steamid || ''),
        authorRole: String(row.author_role || 'player') as SupportTicketMessageAuthorRole,
        message: String(row.message || ''),
        createdAt: toIsoString(row.created_at),
        meta: (row.meta as Record<string, unknown> | null) || null,
    };
}

function mapSupportTicketRow(row: Record<string, unknown>, messages: SupportTicketMessage[] = []): SupportTicket {
    return {
        id: Number(row.id),
        userSteamId: String(row.user_steamid || ''),
        subject: String(row.subject || ''),
        status: normalizeSupportTicketStatus(row.status),
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at),
        lastMessageAt: toIsoString(row.last_message_at || row.updated_at || row.created_at),
        closedAt: row.closed_at ? toIsoString(row.closed_at) : null,
        meta: (row.meta as Record<string, unknown> | null) || null,
        messages,
    };
}

async function getSupportTicketMessages(ticketIds: number[]) {
    if (ticketIds.length === 0) {
        return new Map<number, SupportTicketMessage[]>();
    }

    const result = await getPool().query(
        `SELECT id, ticket_id, author_steamid, author_role, message, meta, created_at
         FROM support_ticket_messages
         WHERE ticket_id = ANY($1::int[])
         ORDER BY created_at ASC, id ASC`,
        [ticketIds]
    );
    const grouped = new Map<number, SupportTicketMessage[]>();

    for (const row of result.rows) {
        const message = mapSupportTicketMessageRow(row);
        const messages = grouped.get(message.ticketId) || [];
        messages.push(message);
        grouped.set(message.ticketId, messages);
    }

    return grouped;
}

export async function getSupportTickets(params?: {
    userSteamId?: string;
    status?: SupportTicketStatus | 'all';
    limit?: number;
}) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100);
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params?.userSteamId) {
        values.push(params.userSteamId);
        conditions.push(`user_steamid = $${values.length}`);
    }

    if (params?.status && params.status !== 'all') {
        values.push(params.status);
        conditions.push(`status = $${values.length}`);
    }

    values.push(limit);

    const result = await getPool().query(
        `SELECT id, user_steamid, subject, status, meta, created_at, updated_at, last_message_at, closed_at
         FROM support_tickets
         ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY last_message_at DESC, id DESC
         LIMIT $${values.length}`,
        values
    );
    const ids = result.rows.map((row) => Number(row.id));
    const groupedMessages = await getSupportTicketMessages(ids);

    return result.rows.map((row) => mapSupportTicketRow(row, groupedMessages.get(Number(row.id)) || []));
}

export async function getSupportTicketById(ticketId: number) {
    const result = await getPool().query(
        `SELECT id, user_steamid, subject, status, meta, created_at, updated_at, last_message_at, closed_at
         FROM support_tickets
         WHERE id = $1
         LIMIT 1`,
        [ticketId]
    );
    const row = result.rows[0];

    if (!row) {
        return null;
    }

    const groupedMessages = await getSupportTicketMessages([Number(row.id)]);
    return mapSupportTicketRow(row, groupedMessages.get(Number(row.id)) || []);
}

export async function createSupportTicket(params: {
    userSteamId: string;
    subject: string;
    message: string;
    meta?: unknown;
}) {
    const { userSteamId, subject, message, meta = null } = params;
    const ticket = await withTransaction(async (client) => {
        const ticketResult = await client.query(
            `INSERT INTO support_tickets (user_steamid, subject, status, meta, updated_at, last_message_at)
             VALUES ($1,$2,$3,$4,now(),now())
             RETURNING id, user_steamid, subject, status, meta, created_at, updated_at, last_message_at, closed_at`,
            [userSteamId, subject, 'open', meta]
        );
        const messageResult = await client.query(
            `INSERT INTO support_ticket_messages (ticket_id, author_steamid, author_role, message, meta)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING id, ticket_id, author_steamid, author_role, message, meta, created_at`,
            [ticketResult.rows[0].id, userSteamId, 'player', message, meta]
        );

        return mapSupportTicketRow(ticketResult.rows[0], [mapSupportTicketMessageRow(messageResult.rows[0])]);
    });

    return ticket;
}

export async function addSupportTicketMessage(params: {
    ticketId: number;
    authorSteamId: string;
    authorRole: SupportTicketMessageAuthorRole;
    message: string;
    requireUserSteamId?: string;
    meta?: unknown;
}) {
    const { ticketId, authorSteamId, authorRole, message, requireUserSteamId, meta = null } = params;
    const updatedTicketId = await withTransaction(async (client) => {
        const ticketResult = await client.query(
            `SELECT id, user_steamid, status
             FROM support_tickets
             WHERE id = $1
             FOR UPDATE`,
            [ticketId]
        );
        const ticket = ticketResult.rows[0];

        if (!ticket) {
            return null;
        }

        if (requireUserSteamId && String(ticket.user_steamid) !== requireUserSteamId) {
            return null;
        }

        if (ticket.status === 'closed') {
            throw new Error('SUPPORT_TICKET_CLOSED');
        }

        let nextStatus = normalizeSupportTicketStatus(ticket.status);

        if (authorRole === 'admin' && nextStatus === 'open') {
            nextStatus = 'in_progress';
        }

        if (authorRole === 'player' && nextStatus === 'resolved') {
            nextStatus = 'open';
        }

        await client.query(
            `INSERT INTO support_ticket_messages (ticket_id, author_steamid, author_role, message, meta)
             VALUES ($1,$2,$3,$4,$5)`,
            [ticketId, authorSteamId, authorRole, message, meta]
        );
        await client.query(
            `UPDATE support_tickets
             SET status = $2,
                 updated_at = now(),
                 last_message_at = now(),
                 closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE closed_at END
             WHERE id = $1`,
            [ticketId, nextStatus]
        );

        return ticketId;
    });

    return updatedTicketId == null ? null : getSupportTicketById(updatedTicketId);
}

export async function updateSupportTicketStatus(params: {
    ticketId: number;
    status: SupportTicketStatus;
    adminSteamId: string;
}) {
    const { ticketId, status, adminSteamId } = params;
    const updatedTicketId = await withTransaction(async (client) => {
        const ticketResult = await client.query(
            `SELECT id, status
             FROM support_tickets
             WHERE id = $1
             FOR UPDATE`,
            [ticketId]
        );

        if (!ticketResult.rows[0]) {
            return null;
        }

        await client.query(
            `UPDATE support_tickets
             SET status = $2,
                 updated_at = now(),
                 last_message_at = now(),
                 closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE NULL END
             WHERE id = $1`,
            [ticketId, status]
        );
        await client.query(
            `INSERT INTO support_ticket_messages (ticket_id, author_steamid, author_role, message, meta)
             VALUES ($1,$2,$3,$4,$5)`,
            [
                ticketId,
                adminSteamId,
                'system',
                `Статус тикета изменён на ${status}`,
                { status },
            ]
        );

        return ticketId;
    });

    return updatedTicketId == null ? null : getSupportTicketById(updatedTicketId);
}

export async function getAdminDashboardData(params?: {
    purchasesLimit?: number;
    logsLimit?: number;
    balanceAccountsLimit?: number;
    balanceTransactionsLimit?: number;
    dateFrom?: string;
    dateTo?: string;
    steamId?: string;
    provider?: string;
    status?: string;
}): Promise<AdminDashboardPayload> {
    const purchasesLimit = Math.min(Math.max(params?.purchasesLimit ?? 50, 1), 200);
    const logsLimit = Math.min(Math.max(params?.logsLimit ?? 100, 1), 300);
    const balanceAccountsLimit = Math.min(Math.max(params?.balanceAccountsLimit ?? 50, 1), 200);
    const balanceTransactionsLimit = Math.min(Math.max(params?.balanceTransactionsLimit ?? 100, 1), 300);
    const currentPool = getPool();
    const filters: AdminDashboardFilters = {
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
        steamId: params?.steamId?.trim() || undefined,
        provider: params?.provider?.trim().toLowerCase() || undefined,
        status: params?.status?.trim().toLowerCase() || undefined,
    };

    const buildWhereClause = (conditions: string[]) => {
        return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    };

    const excludeMorunePurchaseProvider = (alias: string) => {
        return `LOWER(COALESCE(${alias}.meta->>'provider', '')) <> 'morune'`;
    };

    const excludeMoruneBalanceTransactionProvider = (alias: string) => {
        return `LOWER(COALESCE(${alias}.meta->>'provider', '')) <> 'morune'`;
    };

    const appendDateRangeFilters = (
        conditions: string[],
        values: unknown[],
        column: string,
        nextFilters: AdminDashboardFilters
    ) => {
        if (nextFilters.dateFrom) {
            values.push(nextFilters.dateFrom);
            conditions.push(`${column} >= $${values.length}::date`);
        }

        if (nextFilters.dateTo) {
            values.push(nextFilters.dateTo);
            conditions.push(`${column} < ($${values.length}::date + INTERVAL '1 day')`);
        }
    };

    const appendSteamIdFilter = (
        conditions: string[],
        values: unknown[],
        column: string,
        steamId?: string
    ) => {
        if (!steamId) {
            return;
        }

        values.push(`%${steamId}%`);
        conditions.push(`${column} LIKE $${values.length}`);
    };

    const appendTokenFilter = (
        conditions: string[],
        values: unknown[],
        expression: string,
        value?: string
    ) => {
        if (!value) {
            return;
        }

        values.push(value);
        conditions.push(`LOWER(COALESCE(${expression}, '')) = $${values.length}`);
    };

    const summaryValues: unknown[] = [];
    const summaryPurchaseConditions: string[] = [excludeMorunePurchaseProvider('p')];
    appendDateRangeFilters(summaryPurchaseConditions, summaryValues, 'p.created_at', filters);
    appendSteamIdFilter(summaryPurchaseConditions, summaryValues, 'p.user_id', filters.steamId);
    appendTokenFilter(summaryPurchaseConditions, summaryValues, 'p.meta->>\'provider\'', filters.provider);
    appendTokenFilter(summaryPurchaseConditions, summaryValues, 'p.status', filters.status);

    const summaryLogsConditions: string[] = [excludeMorunePurchaseProvider('p_logs')];
    appendDateRangeFilters(summaryLogsConditions, summaryValues, 'pl.created_at', filters);
    appendSteamIdFilter(summaryLogsConditions, summaryValues, 'p_logs.user_id', filters.steamId);
    appendTokenFilter(summaryLogsConditions, summaryValues, 'p_logs.meta->>\'provider\'', filters.provider);
    appendTokenFilter(summaryLogsConditions, summaryValues, 'p_logs.status', filters.status);

    const summaryBalanceAccountsConditions: string[] = ['ub.balance > 0'];
    appendSteamIdFilter(summaryBalanceAccountsConditions, summaryValues, 'ub.user_steamid', filters.steamId);

    const summaryBalanceTransactionsConditions: string[] = [excludeMoruneBalanceTransactionProvider('bt')];
    appendDateRangeFilters(summaryBalanceTransactionsConditions, summaryValues, 'bt.created_at', filters);
    appendSteamIdFilter(summaryBalanceTransactionsConditions, summaryValues, 'bt.user_steamid', filters.steamId);
    appendTokenFilter(summaryBalanceTransactionsConditions, summaryValues, 'bt.meta->>\'provider\'', filters.provider);

    const summaryCreditedBalanceConditions = [...summaryBalanceTransactionsConditions, `bt.kind = 'credit'`];
    const summaryDebitedBalanceConditions = [...summaryBalanceTransactionsConditions, `bt.kind = 'debit'`];
    const summaryBalanceTodayConditions = [
        excludeMoruneBalanceTransactionProvider('bt'),
        `bt.kind = 'credit'`,
        `bt.created_at >= CURRENT_DATE`,
        `bt.created_at < CURRENT_DATE + INTERVAL '1 day'`,
    ];
    appendSteamIdFilter(summaryBalanceTodayConditions, summaryValues, 'bt.user_steamid', filters.steamId);

    const summaryRewardClaimsConditions: string[] = [];
    summaryValues.push(ACTIVITY_FREE_COINS_REWARD.kind);
    summaryRewardClaimsConditions.push(`rc.reward_kind = $${summaryValues.length}`);
    appendDateRangeFilters(summaryRewardClaimsConditions, summaryValues, 'rc.claim_date', filters);
    appendSteamIdFilter(summaryRewardClaimsConditions, summaryValues, 'rc.user_steamid', filters.steamId);

    const summaryRewardClaimsTotalConditions: string[] = [];
    summaryValues.push(ACTIVITY_FREE_COINS_REWARD.kind);
    summaryRewardClaimsTotalConditions.push(`rc.reward_kind = $${summaryValues.length}`);
    appendSteamIdFilter(summaryRewardClaimsTotalConditions, summaryValues, 'rc.user_steamid', filters.steamId);

    const summaryRewardClaimsTodayConditions: string[] = [];
    summaryValues.push(ACTIVITY_FREE_COINS_REWARD.kind);
    summaryRewardClaimsTodayConditions.push(`rc.reward_kind = $${summaryValues.length}`);
    summaryRewardClaimsTodayConditions.push(`rc.claim_date = CURRENT_DATE`);
    appendSteamIdFilter(summaryRewardClaimsTodayConditions, summaryValues, 'rc.user_steamid', filters.steamId);

    const purchasesValues: unknown[] = [];
    const purchasesConditions: string[] = [excludeMorunePurchaseProvider('p')];
    appendDateRangeFilters(purchasesConditions, purchasesValues, 'p.created_at', filters);
    appendSteamIdFilter(purchasesConditions, purchasesValues, 'p.user_id', filters.steamId);
    appendTokenFilter(purchasesConditions, purchasesValues, 'p.meta->>\'provider\'', filters.provider);
    appendTokenFilter(purchasesConditions, purchasesValues, 'p.status', filters.status);
    purchasesValues.push(purchasesLimit);

    const logsValues: unknown[] = [];
    const logsConditions: string[] = [excludeMorunePurchaseProvider('p')];
    appendDateRangeFilters(logsConditions, logsValues, 'pl.created_at', filters);
    appendSteamIdFilter(logsConditions, logsValues, 'p.user_id', filters.steamId);
    appendTokenFilter(logsConditions, logsValues, 'p.meta->>\'provider\'', filters.provider);
    appendTokenFilter(logsConditions, logsValues, 'p.status', filters.status);
    logsValues.push(logsLimit);

    const balanceAccountsValues: unknown[] = [];
    const balanceAccountsConditions: string[] = ['ub.balance > 0'];
    appendSteamIdFilter(balanceAccountsConditions, balanceAccountsValues, 'ub.user_steamid', filters.steamId);
    balanceAccountsValues.push(balanceAccountsLimit);

    const balanceTransactionsValues: unknown[] = [];
    const balanceTransactionsConditions: string[] = [excludeMoruneBalanceTransactionProvider('bt')];
    appendDateRangeFilters(balanceTransactionsConditions, balanceTransactionsValues, 'bt.created_at', filters);
    appendSteamIdFilter(balanceTransactionsConditions, balanceTransactionsValues, 'bt.user_steamid', filters.steamId);
    appendTokenFilter(balanceTransactionsConditions, balanceTransactionsValues, 'bt.meta->>\'provider\'', filters.provider);
    balanceTransactionsValues.push(balanceTransactionsLimit);

    const topDonorsValues: unknown[] = [];
    const topDonorsConditions: string[] = [
        `p.status = 'paid'`,
        `p.user_id IS NOT NULL`,
        `p.amount > 0`,
        excludeMorunePurchaseProvider('p'),
        `LOWER(COALESCE(p.meta->>'provider', '')) <> 'balance'`,
    ];
    appendDateRangeFilters(topDonorsConditions, topDonorsValues, 'p.created_at', filters);
    appendSteamIdFilter(topDonorsConditions, topDonorsValues, 'p.user_id', filters.steamId);
    appendTokenFilter(topDonorsConditions, topDonorsValues, 'p.meta->>\'provider\'', filters.provider);
    appendTokenFilter(topDonorsConditions, topDonorsValues, 'p.status', filters.status);
    topDonorsValues.push(5);

    const [summaryResult, topDonorsResult, purchasesResult, logsResult, balanceAccountsResult, balanceTransactionsResult] = await Promise.all([
        currentPool.query(
            `SELECT
                COUNT(*)::int AS total_purchases,
                COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_purchases,
                COUNT(*) FILTER (WHERE status IN ('failed', 'expired', 'refunded', 'provider_error'))::int AS failed_purchases,
                COALESCE(SUM(amount), 0)::int AS total_revenue,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::int AS paid_revenue,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND LOWER(COALESCE(meta->>'provider', '')) = 'tbank'), 0)::int AS tbank_paid_revenue,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND LOWER(COALESCE(meta->>'provider', '')) = 'enot'), 0)::int AS enot_paid_revenue,
                COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND LOWER(COALESCE(meta->>'provider', '')) = 'balance'), 0)::int AS balance_paid_revenue,
                COALESCE((SELECT SUM(bt.amount)::int FROM balance_transactions bt ${buildWhereClause(summaryBalanceTodayConditions)}), 0) AS balance_today,
                COALESCE((SELECT COUNT(*)::int FROM reward_claims rc ${buildWhereClause(summaryRewardClaimsConditions)}), 0) AS free_reward_claims,
                COALESCE((SELECT COUNT(*)::int FROM reward_claims rc ${buildWhereClause(summaryRewardClaimsTotalConditions)}), 0) AS free_reward_claims_total,
                COALESCE((SELECT COUNT(*)::int FROM reward_claims rc ${buildWhereClause(summaryRewardClaimsTodayConditions)}), 0) AS free_reward_claims_today,
                COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS unique_buyers,
                COALESCE((SELECT COUNT(*)::int FROM purchase_logs pl LEFT JOIN purchases p_logs ON p_logs.id = pl.purchase_id ${buildWhereClause(summaryLogsConditions)}), 0) AS total_logs,
                COALESCE((SELECT COUNT(*)::int FROM user_balances ub ${buildWhereClause(summaryBalanceAccountsConditions)}), 0) AS total_balance_holders,
                COALESCE((SELECT SUM(ub.balance)::int FROM user_balances ub ${buildWhereClause(summaryBalanceAccountsConditions)}), 0) AS total_outstanding_balance,
                COALESCE((SELECT COUNT(*)::int FROM balance_transactions bt ${buildWhereClause(summaryBalanceTransactionsConditions)}), 0) AS total_balance_transactions,
                COALESCE((SELECT SUM(bt.amount)::int FROM balance_transactions bt ${buildWhereClause(summaryCreditedBalanceConditions)}), 0) AS credited_balance,
                COALESCE((SELECT SUM(ABS(bt.amount))::int FROM balance_transactions bt ${buildWhereClause(summaryDebitedBalanceConditions)}), 0) AS debited_balance
             FROM purchases p
             ${buildWhereClause(summaryPurchaseConditions)}`,
            summaryValues
        ),
        currentPool.query(
            `SELECT
                p.user_id,
                COUNT(*)::int AS purchases_count,
                COALESCE(SUM(p.amount), 0)::int AS total_amount
             FROM purchases p
             ${buildWhereClause(topDonorsConditions)}
             GROUP BY p.user_id
             ORDER BY total_amount DESC, purchases_count DESC, p.user_id ASC
             LIMIT $${topDonorsValues.length}`,
            topDonorsValues
        ),
        currentPool.query(
            `SELECT
                id,
                user_id,
                server_key,
                item_type,
                amount,
                status,
                meta,
                COALESCE(meta->>'provider', NULL) AS provider,
                created_at
             FROM purchases p
             ${buildWhereClause(purchasesConditions)}
             ORDER BY p.created_at DESC
             LIMIT $${purchasesValues.length}`,
            purchasesValues
        ),
        currentPool.query(
            `SELECT
                pl.id,
                pl.purchase_id,
                pl.server_key,
                pl.event,
                pl.meta,
                pl.created_at
             FROM purchase_logs pl
             LEFT JOIN purchases p ON p.id = pl.purchase_id
             ${buildWhereClause(logsConditions)}
             ORDER BY pl.created_at DESC
             LIMIT $${logsValues.length}`,
            logsValues
        ),
        currentPool.query(
            `SELECT
                ub.user_steamid,
                ub.balance,
                ub.updated_at
             FROM user_balances ub
             ${buildWhereClause(balanceAccountsConditions)}
             ORDER BY ub.balance DESC, ub.updated_at DESC
             LIMIT $${balanceAccountsValues.length}`,
            balanceAccountsValues
        ),
        currentPool.query(
            `SELECT
                bt.id,
                bt.user_steamid,
                bt.purchase_id,
                bt.kind,
                bt.amount,
                bt.meta,
                bt.created_at
             FROM balance_transactions bt
             ${buildWhereClause(balanceTransactionsConditions)}
             ORDER BY bt.created_at DESC
             LIMIT $${balanceTransactionsValues.length}`,
            balanceTransactionsValues
        ),
    ]);

    const summaryRow = summaryResult.rows[0] || {};

    return {
        summary: {
            totalPurchases: Number(summaryRow.total_purchases || 0),
            paidPurchases: Number(summaryRow.paid_purchases || 0),
            failedPurchases: Number(summaryRow.failed_purchases || 0),
            totalRevenue: Number(summaryRow.total_revenue || 0),
            paidRevenue: Number(summaryRow.paid_revenue || 0),
            tbankPaidRevenue: Number(summaryRow.tbank_paid_revenue || 0),
            enotPaidRevenue: Number(summaryRow.enot_paid_revenue || 0),
            balancePaidRevenue: Number(summaryRow.balance_paid_revenue || 0),
            balanceToday: Number(summaryRow.balance_today || 0),
            freeRewardClaims: Number(summaryRow.free_reward_claims || 0),
            freeRewardClaimsTotal: Number(summaryRow.free_reward_claims_total || 0),
            freeRewardClaimsToday: Number(summaryRow.free_reward_claims_today || 0),
            uniqueBuyers: Number(summaryRow.unique_buyers || 0),
            totalLogs: Number(summaryRow.total_logs || 0),
            totalBalanceHolders: Number(summaryRow.total_balance_holders || 0),
            totalOutstandingBalance: Number(summaryRow.total_outstanding_balance || 0),
            totalBalanceTransactions: Number(summaryRow.total_balance_transactions || 0),
            creditedBalance: Number(summaryRow.credited_balance || 0),
            debitedBalance: Number(summaryRow.debited_balance || 0),
        },
        topDonors: topDonorsResult.rows.map((row) => ({
            userId: String(row.user_id),
            totalAmount: Number(row.total_amount || 0),
            purchasesCount: Number(row.purchases_count || 0),
        })),
        purchases: purchasesResult.rows.map((row) => ({
            id: Number(row.id),
            userId: row.user_id || null,
            serverKey: row.server_key,
            itemType: row.item_type,
            amount: Number(row.amount || 0),
            status: row.status,
            provider: row.provider || null,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
            meta: row.meta || null,
        })),
        logs: logsResult.rows.map((row) => ({
            id: Number(row.id),
            purchaseId: row.purchase_id == null ? null : Number(row.purchase_id),
            serverKey: row.server_key,
            event: row.event,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
            meta: row.meta || null,
        })),
        balanceAccounts: balanceAccountsResult.rows.map((row) => ({
            userSteamId: String(row.user_steamid),
            balance: Number(row.balance || 0),
            updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
        })),
        balanceTransactions: balanceTransactionsResult.rows.map((row) => ({
            id: Number(row.id),
            userSteamId: String(row.user_steamid),
            purchaseId: row.purchase_id == null ? null : Number(row.purchase_id),
            kind: String(row.kind),
            amount: Number(row.amount || 0),
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
            meta: row.meta || null,
        })),
    };
}

const db = {
    createPurchase,
    addLog,
    updatePurchaseStatus,
    query,
    getPurchaseById,
    getUserBalance,
    getUserBalanceTransactions,
    getDiscordConnection,
    upsertDiscordConnection,
    getRecentVipPurchase,
    upsertUserPlaytimeDaily,
    getFreeCoinsRewardStatus,
    claimFreeCoinsReward,
    applyBalanceTopup,
    creditUserBalanceManually,
    searchAdminPlayers,
    createPurchaseWithBalance,
    revertBalancePurchase,
    getHallOfFame,
    getPlayerHallOfFameStats,
    saveLeaderboardWipeResults,
    getSupportTickets,
    getSupportTicketById,
    createSupportTicket,
    addSupportTicketMessage,
    updateSupportTicketStatus,
    addServerStats,
    getAggregatedStats,
    getAdminDashboardData,
};

export default db;
