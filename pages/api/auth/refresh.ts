import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { query } from '@/lib/db';

function hashToken(t: string) {
  return crypto.createHash('sha256').update(t).digest('hex');
}
function signAccessToken(steamId: string) {
  return require('jsonwebtoken').sign({ steamId }, process.env.SESSION_SECRET!, { expiresIn: '15m' });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const refreshFromCookie = req.cookies?.refresh_token as string | undefined;
  const provided = refreshFromCookie || req.body?.refresh;
  if (!provided) return res.status(400).json({ ok: false, error: 'No refresh token provided' });

  try {
    const hashed = hashToken(provided);
    const rows = await query('SELECT id, user_steamid, expires_at, revoked FROM refresh_tokens WHERE token_hash=$1', [hashed]);
    const row = rows.rows[0];
    if (!row) return res.status(401).json({ ok: false, error: 'Invalid refresh token' });
    if (row.revoked) return res.status(401).json({ ok: false, error: 'Revoked' });
    if (new Date(row.expires_at) < new Date()) return res.status(401).json({ ok: false, error: 'Expired' });

    await query('UPDATE refresh_tokens SET revoked=true WHERE id=$1', [row.id]);
    const newPlain = crypto.randomBytes(48).toString('hex');
    const newHash = hashToken(newPlain);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * Number(process.env.REFRESH_TOKEN_DAYS || 30));
    await query('INSERT INTO refresh_tokens (user_steamid, token_hash, expires_at) VALUES ($1,$2,$3)', [row.user_steamid, newHash, expiresAt]);

    const access = signAccessToken(row.user_steamid);

    const existing = res.getHeader('Set-Cookie');
    const newCookies: string[] = [];
    if (existing) {
      if (Array.isArray(existing)) newCookies.push(...existing as string[]);
      else if (typeof existing === 'string') newCookies.push(existing as string);
    }
    newCookies.push(`refresh_token=${newPlain}; HttpOnly; Path=/; Max-Age=${60*60*24*Number(process.env.REFRESH_TOKEN_DAYS||30)}; SameSite=Lax`);
    newCookies.push(`access_token=${access}; HttpOnly; Path=/; Max-Age=${60*15}; SameSite=Lax`);
    res.setHeader('Set-Cookie', newCookies);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('refresh error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
