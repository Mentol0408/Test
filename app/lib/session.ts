import { SessionOptions } from "iron-session";

const appBaseUrl = process.env.APP_BASE_URL?.trim();
const useSecureCookies = appBaseUrl?.startsWith("https://") === true;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "steam_session",

  cookieOptions: {
    secure: useSecureCookies,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  },
};

export type UserSession = {
  steamId?: string;
};