import type { NextApiRequest, NextApiResponse } from 'next';

import { getAdminAccessContext } from '@/lib/admin';
import db, { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamPlayerProfiles } from '@/lib/steamProfiles';
import { SUPPORT_TICKET_STATUSES, type SupportTicket, type SupportTicketStatus } from '@/types/support';

type AdminTicketsResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  steamId: string | null;
  databaseConfigured: boolean;
  tickets?: SupportTicket[];
  error?: string;
};

function normalizeStatus(value: string | string[] | undefined): SupportTicketStatus | 'all' | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || candidate === 'all') {
    return 'all';
  }

  return SUPPORT_TICKET_STATUSES.includes(candidate as SupportTicketStatus) ? candidate as SupportTicketStatus : undefined;
}

async function enrichTicketsWithPlayerNames(tickets: SupportTicket[]) {
  const steamIds = new Set<string>();

  tickets.forEach((ticket) => {
    steamIds.add(ticket.userSteamId);
    ticket.messages.forEach((message) => steamIds.add(message.authorSteamId));
  });

  const profiles = await getSteamPlayerProfiles(Array.from(steamIds));

  return tickets.map((ticket) => ({
    ...ticket,
    userName: profiles[ticket.userSteamId]?.name || null,
    messages: ticket.messages.map((message) => ({
      ...message,
      authorName: profiles[message.authorSteamId]?.name || null,
    })),
  }));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminTicketsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      isAuthenticated: false,
      isAdmin: false,
      steamId: null,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      error: 'Method not allowed',
    });
  }

  res.setHeader('Cache-Control', 'no-store');

  const access = await getAdminAccessContext(req, res);
  const baseResponse = {
    ok: true,
    isAuthenticated: access.isAuthenticated,
    isAdmin: access.isAdmin,
    steamId: access.steamId,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };

  if (!access.isAuthenticated || !access.isAdmin) {
    return res.status(200).json({ ...baseResponse, tickets: [] });
  }

  const status = normalizeStatus(req.query.status);

  if (status === undefined) {
    return res.status(400).json({ ...baseResponse, ok: false, tickets: [], error: 'INVALID_STATUS' });
  }

  try {
    const tickets = await db.getSupportTickets({ status, limit: 100 });
    const enrichedTickets = await enrichTicketsWithPlayerNames(tickets);
    return res.status(200).json({ ...baseResponse, tickets: enrichedTickets });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load admin support tickets', error);
    }

    return res.status(200).json({ ...baseResponse, ok: false, databaseConfigured: false, tickets: [], error: 'DATABASE_UNAVAILABLE' });
  }
}
