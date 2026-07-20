import { NextApiRequest, NextApiResponse } from "next";
import openid from "openid";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const applicationUrl = resolveExternalBaseUrl(req);
  const returnTo = normalizeReturnTo(req.query.returnTo, applicationUrl);
  const returnUrl = `${applicationUrl}/api/steam/callback`;

  res.setHeader('Set-Cookie', `steam_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  const relyingParty = new openid.RelyingParty(returnUrl, null, true, false, []);

    try {
      const authUrl = await new Promise<string>((resolve, reject) => {
        relyingParty.authenticate("https://steamcommunity.com/openid", false, (error, url) => {
          if (error) return reject(error);
          if (!url) return reject(new Error('No auth url'));
          resolve(url);
        });
      });
      res.redirect(authUrl);
      return;
    } catch (err) {
      console.error("Steam OpenID authenticate error:", err);
      res.status(500).json({ error: "Steam OpenID authentication failed" });
      return;
    }
}
