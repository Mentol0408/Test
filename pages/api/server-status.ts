import type { NextApiRequest, NextApiResponse } from 'next';
import dgram from 'dgram';
import purchaseConfig from '@/lib/purchaseConfig.json';
import db from '@/lib/db';
import { isDatabaseUnavailableError } from '@/lib/db';

type Resp = { ok: boolean; error?: string; insertedId?: number; stats?: any };
type AggregatedServerStats = {
    perServer: Array<{
        server_key: string;
        server_id: number;
        map_size: number | null;
        team_limit: number | null;
        last_wipe: number | string | null;
        next_wipe: number | string | null;
        opened_cases: number;
        online: number;
    }>;
};
type LiveServerEndpoint = {
    id: number;
    host: string;
    port: number;
};

type PlaytimeEntry = {
    steamId?: string;
    userSteamId?: string;
    minutes?: number | string;
    trackedMinutes?: number | string;
    minutesToday?: number | string;
    activityDate?: string;
    date?: string;
    server?: string;
    meta?: unknown;
};

const LIVE_SERVER_ENDPOINTS: Record<string, LiveServerEndpoint> = {
    hard: { id: 1, host: '195.18.27.40', port: 35000 },
    vanilla: { id: 2, host: '185.189.255.248', port: 35000 },
    chill: { id: 3, host: '185.207.214.202', port: 35400 },
};

function parseOptionalInteger(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === 'string' && value.trim()) {
        const parsedValue = Number.parseInt(value, 10);

        if (Number.isFinite(parsedValue)) {
            return parsedValue;
        }
    }

    return undefined;
}

function readNullTerminatedString(buffer: Buffer, offset: number) {
    let end = offset;

    while (end < buffer.length && buffer[end] !== 0) {
        end += 1;
    }

    return end + 1;
}

function sendUdpQuery(host: string, port: number, payload: Buffer, timeoutMs = 1500): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        const timeout = setTimeout(() => {
            socket.close();
            reject(new Error(`A2S timeout ${host}:${port}`));
        }, timeoutMs);

        socket.once('message', (message) => {
            clearTimeout(timeout);
            socket.close();
            resolve(message);
        });

        socket.once('error', (error) => {
            clearTimeout(timeout);
            socket.close();
            reject(error);
        });

        socket.send(payload, port, host, (error) => {
            if (error) {
                clearTimeout(timeout);
                socket.close();
                reject(error);
            }
        });
    });
}

async function querySourceServerOnline(endpoint: LiveServerEndpoint): Promise<number | null> {
    const requestHeader = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
    const requestBody = Buffer.from('Source Engine Query\0', 'ascii');
    const basePayload = Buffer.concat([requestHeader, requestBody]);

    try {
        let response = await sendUdpQuery(endpoint.host, endpoint.port, basePayload);

        if (response.length >= 9 && response[4] === 0x41) {
            const challengePayload = Buffer.concat([basePayload, response.subarray(5, 9)]);
            response = await sendUdpQuery(endpoint.host, endpoint.port, challengePayload);
        }

        if (response.length < 7 || response[4] !== 0x49) {
            return null;
        }

        let offset = 6;
        offset = readNullTerminatedString(response, offset);
        offset = readNullTerminatedString(response, offset);
        offset = readNullTerminatedString(response, offset);
        offset = readNullTerminatedString(response, offset);
        offset += 2;

        if (offset >= response.length) {
            return null;
        }

        return Number(response[offset]);
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`A2S query failed for ${endpoint.host}:${endpoint.port}`, error);
        }

        return null;
    }
}

async function getLiveOnlineByServerKey() {
    const entries = await Promise.all(
        Object.entries(LIVE_SERVER_ENDPOINTS).map(async ([serverKey, endpoint]) => {
            const online = await querySourceServerOnline(endpoint);
            return [serverKey, online] as const;
        })
    );

    return new Map(entries.filter(([, online]) => online !== null) as Array<[string, number]>);
}

function getFallbackStats(liveOnline = new Map<string, number>()): AggregatedServerStats {
    const now = String(Date.now());
    const servers = Object.entries(purchaseConfig.servers || {}) as Array<[string, { id?: number }]>

    return {
        perServer: servers.map(([serverKey, serverCfg]) => ({
            server_key: serverKey,
            server_id: Number(serverCfg?.id || 0),
            map_size: 0,
            team_limit: null,
            last_wipe: now,
            next_wipe: now,
            opened_cases: 0,
            online: liveOnline.get(serverKey) ?? 0,
        })),
    };
}

function mergeLiveOnline(stats: AggregatedServerStats, liveOnline: Map<string, number>): AggregatedServerStats {
    if (liveOnline.size === 0) {
        return stats;
    }

    const knownKeys = new Set<string>();
    const perServer = stats.perServer.map((serverStats) => {
        knownKeys.add(serverStats.server_key);

        return {
            ...serverStats,
            online: liveOnline.get(serverStats.server_key) ?? Number(serverStats.online || 0),
        };
    });

    Object.entries(LIVE_SERVER_ENDPOINTS).forEach(([serverKey, endpoint]) => {
        if (knownKeys.has(serverKey) || !liveOnline.has(serverKey)) {
            return;
        }

        perServer.push({
            server_key: serverKey,
            server_id: endpoint.id,
            map_size: 0,
            team_limit: null,
            last_wipe: String(Date.now()),
            next_wipe: String(Date.now()),
            opened_cases: 0,
            online: liveOnline.get(serverKey) ?? 0,
        });
    });

    return { ...stats, perServer };
}

function getSharedStatusApiKeys() {
    return [
        process.env.SERVER_apiKey,
        process.env.SERVER_API_KEY,
        process.env.NEXT_PUBLIC_apiKey,
        process.env.NEXT_PUBLIC_API_KEY,
        process.env.apiKey,
        process.env.API_KEY,
    ].filter(Boolean).map(String);
}

function getServerStatusApiKeys(serverKey: string) {
    const sharedKeys = getSharedStatusApiKeys();
    const serverSpecificKeys: Record<string, Array<string | undefined>> = {
        chill: [
            process.env.SERVER_CHILL_API_KEY,
            process.env.CHILL_SERVER_API_KEY,
            process.env.NEXT_PUBLIC_CHILL_API_KEY,
        ],
        hard: [
            process.env.SERVER_HARD_API_KEY,
            process.env.HARD_SERVER_API_KEY,
            process.env.NEXT_PUBLIC_HARD_API_KEY,
        ],
        vanilla: [
            process.env.SERVER_VANILLA_API_KEY,
            process.env.VANILLA_SERVER_API_KEY,
            process.env.NEXT_PUBLIC_VANILLA_API_KEY,
        ],
    };

    return Array.from(new Set([...sharedKeys, ...(serverSpecificKeys[serverKey] || []).filter(Boolean).map(String)]));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
    if (req.method === 'GET') {
        const serverQuery = (req.query.server as string) || undefined;

        if (!process.env.DATABASE_URL) {
            if (serverQuery) {
                return res.status(200).json({ ok: true, stats: { recent: [] } });
            }

            const liveOnline = await getLiveOnlineByServerKey();
            return res.status(200).json({ ok: true, stats: getFallbackStats(liveOnline) });
        }

        try {
            if (serverQuery) {
                const recent = await db.query('SELECT * FROM server_stats WHERE server_key=$1 ORDER BY created_at DESC LIMIT 20', [serverQuery]);
                return res.status(200).json({ ok: true, stats: { recent: recent.rows } });
            }

            const stats = await db.getAggregatedStats();
            const perServer = Array.isArray(stats?.perServer) ? stats.perServer : [];
            const shouldRefreshLiveOnline = perServer.length === 0 || perServer.every((serverStats) => Number(serverStats.online || 0) === 0);
            const liveOnline = shouldRefreshLiveOnline ? await getLiveOnlineByServerKey() : new Map<string, number>();
            const finalStats = perServer.length > 0
                ? mergeLiveOnline(stats, liveOnline)
                : getFallbackStats(liveOnline);

            return res.status(200).json({
                ok: true,
                stats: finalStats,
            });
        } catch (err: any) {
            if (isDatabaseUnavailableError(err)) {
                if (serverQuery) {
                    return res.status(200).json({ ok: true, stats: { recent: [] } });
                }

                const liveOnline = await getLiveOnlineByServerKey();
                return res.status(200).json({ ok: true, stats: getFallbackStats(liveOnline) });
            }

            console.error('server-status GET error', err);

            if (process.env.NODE_ENV !== 'production') {
                const liveOnline = await getLiveOnlineByServerKey();
                return res.status(200).json({ ok: true, stats: getFallbackStats(liveOnline) });
            }

            return res.status(500).json({ ok: false, error: String(err) });
        }
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const body = req.body || {};
    const providedKey = body.apiKey || req.headers['x-api-key'];
    const payload = body;

    let serverKey: string | undefined;
    let serverId: number | undefined;
    const serverEntries = Object.entries(purchaseConfig.servers || {}) as Array<[string, { id?: number }]>;

    if (payload?.server && typeof payload.server === 'string') {
        const providedServerKey = payload.server.trim();
        // @ts-ignore
        const serverCfg = purchaseConfig.servers?.[providedServerKey];

        if (serverCfg) {
            serverKey = providedServerKey;
            serverId = Number(serverCfg.id);
        } else {
            const legacyServerMatch = providedServerKey.match(/^serv_(\d+)$/i);

            if (!legacyServerMatch) {
                return res.status(400).json({ ok: false, error: 'Unknown server key' });
            }

            serverId = Number(legacyServerMatch[1]);
            const matchedServer = serverEntries.find(([, val]) => Number(val?.id) === serverId);

            if (!matchedServer) {
                return res.status(400).json({ ok: false, error: 'Unknown server key' });
            }

            serverKey = matchedServer[0];
        }
    } else {
        serverId = typeof payload.id === 'number' ? payload.id : parseInt(payload.id, 10);
        if (Number.isNaN(serverId)) return res.status(400).json({ ok: false, error: 'Invalid server id' });

        const match = serverEntries.find(([, val]) => Number(val?.id) === Number(serverId));
        if (!match) return res.status(400).json({ ok: false, error: 'Unknown server id' });
        serverKey = match[0];
    }

    if (!serverKey) {
        return res.status(400).json({ ok: false, error: 'Server key is required' });
    }

    if (!serverId || Number.isNaN(serverId)) {
        return res.status(400).json({ ok: false, error: 'Server id is required' });
    }

    const allowedKeys = getServerStatusApiKeys(serverKey);
    if (allowedKeys.length === 0) {
        return res.status(500).json({ ok: false, error: 'Server status API key is not configured' });
    }

    if (!providedKey || !allowedKeys.includes(String(providedKey))) {
        console.warn('server-status POST rejected: invalid apiKey', {
            hasProvidedKey: Boolean(providedKey),
            configuredKeys: allowedKeys.length,
            server: serverKey,
        });
        return res.status(401).json({ ok: false, error: 'Invalid apiKey' });
    }

    const mapSize = parseOptionalInteger(payload.mapSize ?? payload.map_size);
    const teamLimit = parseOptionalInteger(payload.teamLimit ?? payload.team_limit ?? payload.maxTeamSize ?? payload.max_team_size);
    const lastWipe = parseOptionalInteger(payload.lastWipe ?? payload.last_wipe);
    const nextWipe = parseOptionalInteger(payload.nextWipe ?? payload.next_wipe);
    const openedCases = parseOptionalInteger(payload.openedCases ?? payload.opened_cases);
    const online = parseOptionalInteger(payload.online);
    const playtimeEntries = Array.isArray(payload.players)
        ? payload.players
        : Array.isArray(payload.playtime)
            ? payload.playtime
            : [];

    try {
        const inserted = await db.addServerStats({
            serverKey,
            serverId,
            mapSize,
            teamLimit,
            lastWipe,
            nextWipe,
            openedCases,
            online,
            meta: { raw: payload },
        });

        const normalizedPlaytimeEntries = playtimeEntries
            .map((entry: PlaytimeEntry) => {
                const userSteamId = typeof entry?.steamId === 'string'
                    ? entry.steamId.trim()
                    : typeof entry?.userSteamId === 'string'
                        ? entry.userSteamId.trim()
                        : '';

                const rawMinutes = entry?.trackedMinutes ?? entry?.minutesToday ?? entry?.minutes;
                const trackedMinutes = typeof rawMinutes === 'number'
                    ? rawMinutes
                    : parseInt(String(rawMinutes || ''), 10);

                if (!userSteamId || !Number.isFinite(trackedMinutes) || trackedMinutes < 0) {
                    return null;
                }

                return {
                    userSteamId,
                    serverKey: typeof entry?.server === 'string' && entry.server.trim() ? entry.server.trim() : serverKey,
                    trackedMinutes: Math.min(Math.max(Math.floor(trackedMinutes), 0), 24 * 60),
                    activityDate: typeof entry?.activityDate === 'string' ? entry.activityDate : (typeof entry?.date === 'string' ? entry.date : undefined),
                    meta: entry?.meta ?? null,
                };
            })
            .filter(Boolean) as Array<{
                userSteamId: string;
                serverKey: string;
                trackedMinutes: number;
                activityDate?: string;
                meta?: unknown;
            }>;

        if (normalizedPlaytimeEntries.length > 0) {
            await db.upsertUserPlaytimeDaily(normalizedPlaytimeEntries);
            await db.addLog({
                purchaseId: null,
                serverKey,
                event: 'user_playtime_received',
                meta: { count: normalizedPlaytimeEntries.length },
            });
        }

        await db.addLog({ purchaseId: null, serverKey, event: 'server_status_received', meta: { serverId, payload } });

        const stats = await db.getAggregatedStats();

        return res.status(200).json({ ok: true, insertedId: inserted.id, stats });
    } catch (err: any) {
        console.error('server-status handler error', err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
}
