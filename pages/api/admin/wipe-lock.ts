import type { NextApiRequest, NextApiResponse } from 'next';

import { getAdminAccessContext } from '@/lib/admin';
import { WebRcon } from '@/lib/webrcon';
import purchaseConfig from '@/lib/purchaseConfig.json';
import { isStoreServerKey, STORE_SERVERS } from '@/lib/store/servers';

type ServerCfg = { ip: string; port: number; pass: string };
type LockResult = { serverKey: string; ok: boolean; message?: string };

const MAX_MINUTES = 60 * 24 * 30; // максимум 30 дней

// Включить/снять блокировку выдачи из инвентаря RWMenu после вайпа.
// POST { minutes: number, serverKey?: string | 'all' }. minutes <= 0 — снять блок.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const access = await getAdminAccessContext(req, res);

  if (!access.isAuthenticated) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  if (!access.isAdmin) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const minutesRaw = Number(req.body?.minutes);
  if (!Number.isFinite(minutesRaw)) {
    return res.status(400).json({ ok: false, error: 'INVALID_MINUTES' });
  }
  const minutes = Math.max(0, Math.min(Math.round(minutesRaw), MAX_MINUTES));

  const serverKey = req.body?.serverKey;
  const servers = purchaseConfig.servers as Record<string, ServerCfg>;
  const allKeys = STORE_SERVERS.map((s) => s.key);
  const targets = !serverKey || serverKey === 'all'
    ? allKeys
    : isStoreServerKey(serverKey)
      ? [serverKey]
      : [];

  if (targets.length === 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_SERVER' });
  }

  // 0 минут = снять блок (rwmenu.unlock), иначе заблокировать на N минут.
  const command = minutes <= 0 ? 'rwmenu.unlock' : `rwmenu.setlock ${minutes}`;
  const results: LockResult[] = [];

  for (const key of targets) {
    const cfg = servers[key];
    if (!cfg) {
      results.push({ serverKey: key, ok: false, message: 'SERVER_NOT_CONFIGURED' });
      continue;
    }

    const rcon = new WebRcon(cfg.ip, cfg.port, cfg.pass);
    try {
      await rcon.connect(10000);
      const response = await rcon.send(command, 10000, { assumeSuccessOnSilence: true, silenceMs: 2000 });
      const failed = /unknown command|not found|error/i.test(response);
      results.push({ serverKey: key, ok: !failed, message: response || 'ok' });
    } catch (error) {
      results.push({ serverKey: key, ok: false, message: error instanceof Error ? error.message : 'RCON error' });
    } finally {
      try { rcon.end(); } catch { /* ignore */ }
    }
  }

  const okAll = results.every((r) => r.ok);
  return res.status(okAll ? 200 : 207).json({ ok: okAll, minutes, command, results });
}
