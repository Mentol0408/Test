import { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/types/iron-session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    const steamId = session?.steamId;

    if (!steamId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const key = process.env.STEAM_API_KEY;
    if (!key) {
      console.error("STEAM_API_KEY not set");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(
      key
    )}&steamids=${encodeURIComponent(steamId)}`;

    const r = await fetch(url);
    if (!r.ok) {
      console.error("Steam API returned error", r.status);
      return res.status(502).json({ error: "Steam API error" });
    }

    const data = await r.json();
    const player = data?.response?.players?.[0];
    const avatar = player ? player.avatarfull || player.avatar : null;

    return res.status(200).json({ avatar });
  } catch (e) {
    console.error("/api/steam/avatar error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
