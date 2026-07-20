import { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/types/iron-session";
import { isAdminSteamId } from "@/lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const steamId = session.steamId || null;

  res.status(200).json({
    steamId,
    isAdmin: isAdminSteamId(steamId),
  });
}
