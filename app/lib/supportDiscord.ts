import type { SupportTicket } from '@/types/support';

function truncateDiscordValue(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}

function getTicketUrl(ticketId: number) {
  const baseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, '');

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/admin#ticket-${ticketId}`;
}

async function sendSupportTicketWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.SUPPORT_TICKETS_DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return { sent: false };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return { sent: response.ok };
}

export async function notifySupportTicketCreated(ticket: SupportTicket) {
  const firstMessage = ticket.messages[0]?.message || '';
  const ticketUrl = getTicketUrl(ticket.id);

  return sendSupportTicketWebhook({
    username: 'Rust Way Tickets',
    content: `Новый тикет #${ticket.id} от ${ticket.userSteamId}`,
    embeds: [
      {
        title: `#${ticket.id} ${truncateDiscordValue(ticket.subject, 180)}`,
        description: truncateDiscordValue(firstMessage, 1400),
        color: 12140848,
        fields: [
          { name: 'Steam ID', value: ticket.userSteamId, inline: true },
          { name: 'Статус', value: ticket.status, inline: true },
          { name: 'Админка', value: ticketUrl || 'APP_BASE_URL не настроен', inline: false },
        ],
        timestamp: ticket.createdAt,
      },
    ],
  });
}

export async function notifySupportTicketPlayerReply(ticket: SupportTicket) {
  const lastMessage = ticket.messages[ticket.messages.length - 1];
  const ticketUrl = getTicketUrl(ticket.id);

  return sendSupportTicketWebhook({
    username: 'Rust Way Tickets',
    content: `Новый ответ игрока в тикете #${ticket.id}`,
    embeds: [
      {
        title: `#${ticket.id} ${truncateDiscordValue(ticket.subject, 180)}`,
        description: truncateDiscordValue(lastMessage?.message || '', 1400),
        color: 16753920,
        fields: [
          { name: 'Steam ID', value: ticket.userSteamId, inline: true },
          { name: 'Статус', value: ticket.status, inline: true },
          { name: 'Админка', value: ticketUrl || 'APP_BASE_URL не настроен', inline: false },
        ],
        timestamp: lastMessage?.createdAt || ticket.updatedAt,
      },
    ],
  });
}
