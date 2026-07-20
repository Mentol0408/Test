export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export type SupportTicketStatus = typeof SUPPORT_TICKET_STATUSES[number];

export type SupportTicketMessageAuthorRole = 'player' | 'admin' | 'system';

export type SupportTicketMessage = {
  id: number;
  ticketId: number;
  authorSteamId: string;
  authorName?: string | null;
  authorRole: SupportTicketMessageAuthorRole;
  message: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

export type SupportTicket = {
  id: number;
  userSteamId: string;
  userName?: string | null;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  meta: Record<string, unknown> | null;
  messages: SupportTicketMessage[];
};
