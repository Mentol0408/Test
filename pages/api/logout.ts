import { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/types/iron-session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.steamId = undefined;
  await session.save();

  const cookieName = sessionOptions.cookieName || "steam_session";
  const secure = sessionOptions.cookieOptions?.secure ? "; Secure" : "";
  const cookie = `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  res.setHeader("Set-Cookie", cookie);

  return res.status(200).json({ ok: true });
}