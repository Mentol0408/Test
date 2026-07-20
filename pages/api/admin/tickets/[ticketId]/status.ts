import type { NextApiRequest, NextApiResponse } from 'next';

import { getAdminAccessContext } from '@/lib/admin';
import db, { isDatabaseUnavailableError } from '@/lib/db';
import { SUPPORT_TICKET_STATUSES, type SupportTicket, type SupportTicketStatus } from '@/types/support';

type AdminTicketStatusResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
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

function normalizeStatus(value: unknown): SupportTicketStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  return SUPPORT_TICKET_STATUSES.includes(value as SupportTicketStatus) ? value as SupportTicketStatus : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminTicketStatusResponse>
) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
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

  if (!access.isAuthenticated || !access.isAdmin || !access.steamId) {
    return res.status(200).json({ ...baseResponse, ok: false, error: 'ADMIN_REQUIRED' });
  }

  const ticketId = getTicketId(req.query.ticketId);
  const status = normalizeStatus(req.body?.status);

  if (!ticketId || !status) {
    return res.status(400).json({ ...baseResponse, ok: false, error: 'INVALID_STATUS_PAYLOAD' });
  }

  try {
    const ticket = await db.updateSupportTicketStatus({
      ticketId,
      status,
      adminSteamId: access.steamId,
    });

    if (!ticket) {
      return res.status(404).json({ ...baseResponse, ok: false, ticket: null, error: 'TICKET_NOT_FOUND' });
    }

    return res.status(200).json({ ...baseResponse, ticket });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to update support ticket status', error);
    }

    return res.status(200).json({ ...baseResponse, ok: false, databaseConfigured: false, error: 'DATABASE_UNAVAILABLE' });
  }
}
