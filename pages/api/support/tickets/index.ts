import type { NextApiRequest, NextApiResponse } from 'next';

import db, { isDatabaseUnavailableError } from '@/lib/db';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import { notifySupportTicketCreated } from '@/lib/supportDiscord';
import type { SupportTicket } from '@/types/support';

type SupportTicketsResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  steamId: string | null;
  databaseConfigured: boolean;
  tickets?: SupportTicket[];
  ticket?: SupportTicket;
  error?: string;
};

function normalizeSubject(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 160) : '';
}

function normalizeMessage(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 3000) : '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SupportTicketsResponse>
) {
  res.setHeader('Cache-Control', 'no-store');

  const steamId = await getSteamIdFromRequest(req, res);
  const baseResponse = {
    ok: true,
    isAuthenticated: Boolean(steamId),
    steamId,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };

  if (!steamId) {
    return res.status(200).json({ ...baseResponse, tickets: [] });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(200).json({ ...baseResponse, ok: false, databaseConfigured: false, tickets: [], error: 'DATABASE_UNAVAILABLE' });
  }

  if (req.method === 'GET') {
    try {
      const tickets = await db.getSupportTickets({ userSteamId: steamId, limit: 25 });
      return res.status(200).json({ ...baseResponse, tickets });
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        console.error('Failed to load support tickets', error);
      }

      return res.status(200).json({ ...baseResponse, ok: false, databaseConfigured: false, tickets: [], error: 'DATABASE_UNAVAILABLE' });
    }
  }

  if (req.method === 'POST') {
    const subject = normalizeSubject(req.body?.subject);
    const message = normalizeMessage(req.body?.message);

    if (subject.length < 3 || message.length < 10) {
      return res.status(400).json({ ...baseResponse, ok: false, error: 'INVALID_TICKET_PAYLOAD' });
    }

    try {
      const ticket = await db.createSupportTicket({
        userSteamId: steamId,
        subject,
        message,
        meta: {
          userAgent: req.headers['user-agent'] || null,
        },
      });

      notifySupportTicketCreated(ticket).catch((error) => {
        console.error('Failed to notify support ticket webhook', error);
      });

      return res.status(201).json({ ...baseResponse, ticket });
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        console.error('Failed to create support ticket', error);
      }

      return res.status(200).json({ ...baseResponse, ok: false, databaseConfigured: false, error: 'DATABASE_UNAVAILABLE' });
    }
  }

  return res.status(405).json({ ...baseResponse, ok: false, error: 'Method not allowed' });
}
