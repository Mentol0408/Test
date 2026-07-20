import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { query } from '@/lib/db';

function hashToken(t: string) {
  return crypto.createHash('sha256').update(t).digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const provided = req.cookies?.refresh_token || req.body?.refresh;
  if (!provided) return res.status(400).json({ ok: false, error: 'No refresh token provided' });

  try {
    const hashed = hashToken(provided as string);
    await query('UPDATE refresh_tokens SET revoked=true WHERE token_hash=$1', [hashed]);

    const cookiesToClear = [
      `refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
      `access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
      `steam_session=; Path=/; Max-Age=0; SameSite=Lax`
    ];
    res.setHeader('Set-Cookie', cookiesToClear);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('revoke error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
