import { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/types/iron-session";
import openid from "openid";
import crypto from 'crypto';
import { query } from '@/lib/db';
import { resolveExternalBaseUrl } from '@/lib/paymentServer';

function normalizeReturnTo(value: unknown, baseUrl: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return '/';
  }

  const raw = value.trim();

  if (raw.startsWith('/')) {
    return raw;
  }

  try {
    const base = new URL(baseUrl);
    const candidate = new URL(raw);

    if (candidate.origin !== base.origin) {
      return '/';
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}` || '/';
  } catch {
    return '/';
  }
}

function genRandomToken() {
  return crypto.randomBytes(48).toString('hex');
}
function hashToken(t: string) {
  return crypto.createHash('sha256').update(t).digest('hex');
}
function signAccessToken(steamId: string) {
  return require('jsonwebtoken').sign({ steamId }, process.env.SESSION_SECRET!, { expiresIn: '15m' });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET is not set");
    res.status(500).send("Server misconfiguration: SESSION_SECRET is not set");
    return;
  }

  const applicationUrl = resolveExternalBaseUrl(req);
  const returnToCookie = req.cookies?.steam_return_to;
  const decodedReturnTo = (() => {
    if (typeof returnToCookie !== 'string') {
      return '/';
    }

    try {
      return decodeURIComponent(returnToCookie);
    } catch {
      return '/';
    }
  })();
  const returnTo = normalizeReturnTo(
    decodedReturnTo,
    applicationUrl
  );
  const returnUrl = `${applicationUrl}/api/steam/callback`;

  const relyingParty = new openid.RelyingParty(returnUrl, null, true, false, []);

  try {
    const result = await new Promise<any>((resolve, reject) => {
      relyingParty.verifyAssertion(req, (err, r) => {
        if (err) return reject(err);
        resolve(r);
      });
    });

    console.log("Steam callback: query=", req.query, "result=", result);

    if (!result || !result.claimedIdentifier) {
      res.status(500).send("Steam authentication failed");
      return;
    }

    const steamId = result.claimedIdentifier.split("/").pop();

    try {
      const session = await getIronSession<SessionData>(req, res, sessionOptions);

      session.steamId = steamId!;
      await session.save();

      const existing = res.getHeader('Set-Cookie');
      const newCookies: string[] = [];

      if (existing) {
        if (Array.isArray(existing)) newCookies.push(...existing as string[]);
        else if (typeof existing === 'string') newCookies.push(existing as string);
      }

      newCookies.push(`access_token=${signAccessToken(steamId!)}; HttpOnly; Path=/; Max-Age=${60*15}; SameSite=Lax`);

      if (process.env.DATABASE_URL) {
        try {
          const refreshPlain = genRandomToken();
          const refreshHash = hashToken(refreshPlain);
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * Number(process.env.REFRESH_TOKEN_DAYS || 30));

          await query('INSERT INTO refresh_tokens (user_steamid, token_hash, expires_at) VALUES ($1,$2,$3)', [steamId, refreshHash, expiresAt]);

          newCookies.push(`refresh_token=${refreshPlain}; HttpOnly; Path=/; Max-Age=${60*60*24*Number(process.env.REFRESH_TOKEN_DAYS||30)}; SameSite=Lax`);
        } catch (refreshError) {
          console.error('Failed to persist refresh token after Steam callback:', refreshError);
        }
      }

      newCookies.push('steam_return_to=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

      res.setHeader('Set-Cookie', newCookies);
      res.redirect(returnTo);
    } catch (e) {
      console.error("Error saving session after Steam callback:", e);
      res.status(500).send("Failed to save session");
    }
  } catch (err) {
    console.error('Steam verifyAssertion error', err);
    res.status(500).send('Steam authentication failed');
  }
}
