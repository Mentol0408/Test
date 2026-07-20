import type { NextApiRequest, NextApiResponse } from 'next';

import db, { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import { notifySupportTicketPlayerReply } from '@/lib/supportDiscord';
import type { SupportTicket } from '@/types/support';

type SupportTicketMessageResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  steamId: string | null;
  databaseConfigured: boolean;
  ticket?: SupportTicket | null;
  error?: string;
};

function getTicketId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const ticketId = Number(candidate);

  return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null;
}

function normalizeMessage(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 3000) : '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SupportTicketMessageResponse>
) {
  res.setHeader('Cache-Control', 'no-store');

  const steamId = await getSteamIdFromRequest(req, res);
  const baseResponse = {
    ok: true,
    isAuthenticated: Boolean(steamId),
    steamId,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };

  if (req.method !== 'POST') {
    return res.status(405).json({ ...baseResponse, ok: false, error: 'Method not allowed' });
  }

  if (!steamId) {
    return res.status(401).json({ ...baseResponse, ok: false, error: 'AUTH_REQUIRED' });
  }

  const ticketId = getTicketId(req.query.ticketId);
  const message = normalizeMessage(req.body?.message);

  if (!ticketId || message.length < 2) {
    return res.status(400).json({ ...baseResponse, ok: false, error: 'INVALID_MESSAGE_PAYLOAD' });
  }

  try {
    const ticket = await db.addSupportTicketMessage({
      ticketId,
      authorSteamId: steamId,
      authorRole: 'player',
      message,
      requireUserSteamId: steamId,
    });

    if (!ticket) {
      return res.status(404).json({ ...baseResponse, ok: false, ticket: null, error: 'TICKET_NOT_FOUND' });
    }

    notifySupportTicketPlayerReply(ticket).catch((error) => {
      console.error('Failed to notify support ticket webhook', error);
    });

    return res.status(200).json({ ...baseResponse, ticket });
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPPORT_TICKET_CLOSED') {
      return res.status(409).json({ ...baseResponse, ok: false, error: 'TICKET_CLOSED' });
    }

    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to add support ticket message', error);
    }

    return res.status(200).json({ ...baseResponse, ok: false, databaseConfigured: false, error: 'DATABASE_UNAVAILABLE' });
  }
}
