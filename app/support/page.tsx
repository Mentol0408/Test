'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { SupportTicket, SupportTicketStatus } from '@/types/support';
import styles from './page.module.scss';

type SupportTicketsResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  steamId: string | null;
  databaseConfigured: boolean;
  tickets?: SupportTicket[];
  ticket?: SupportTicket;
  error?: string;
};

const statusLabels: Record<SupportTicketStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

const statusClassNames: Record<SupportTicketStatus, string> = {
  open: styles.statusOpen,
  in_progress: styles.statusInProgress,
  resolved: styles.statusResolved,
  closed: styles.statusClosed,
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getMessageAuthorLabel(role: string) {
  if (role === 'admin') {
    return 'Админ';
  }

  if (role === 'system') {
    return 'Система';
  }

  return 'Игрок';
}

export default function SupportPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<SupportTicketsResponse | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');

  const tickets = useMemo(() => data?.tickets || [], [data]);

  const loadTickets = async () => {
    setLoading(true);
    setNotice('');

    try {
      const response = await fetch('/api/support/tickets', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await response.json().catch(() => null)) as SupportTicketsResponse | null;

      if (!json) {
        throw new Error('SUPPORT_RESPONSE_INVALID');
      }

      setData(json);
    } catch {
      setData({
        ok: false,
        isAuthenticated: false,
        steamId: null,
        databaseConfigured: false,
        tickets: [],
        error: 'SUPPORT_UNAVAILABLE',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject, message }),
      });
      const json = (await response.json().catch(() => null)) as SupportTicketsResponse | null;

      if (!response.ok || !json?.ok || !json.ticket) {
        setNotice(json?.error || 'Не удалось создать тикет.');
        return;
      }

      setSubject('');
      setMessage('');
      setData((current) => ({
        ...(current || json),
        tickets: [json.ticket as SupportTicket, ...(current?.tickets || [])],
      }));
      setNotice('Тикет создан. Админы получили уведомление.');
    } catch {
      setNotice('Не удалось создать тикет.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (ticketId: number) => {
    const reply = (replyDrafts[ticketId] || '').trim();

    if (reply.length < 2) {
      return;
    }

    setSubmitting(true);
    setNotice('');

    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: reply }),
      });
      const json = (await response.json().catch(() => null)) as SupportTicketsResponse | null;

      if (!response.ok || !json?.ok || !json.ticket) {
        setNotice(json?.error || 'Не удалось отправить ответ.');
        return;
      }

      setReplyDrafts((current) => ({ ...current, [ticketId]: '' }));
      setData((current) => ({
        ...(current || json),
        tickets: (current?.tickets || []).map((ticket) => ticket.id === ticketId ? json.ticket as SupportTicket : ticket),
      }));
      setNotice('Ответ отправлен.');
    } catch {
      setNotice('Не удалось отправить ответ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Rust Way Support</p>
          <h1>Тикеты поддержки</h1>
          <p>Создай обращение по донату, балансу, VIP, Discord-роли или любой проблеме на сервере. Ответ появится здесь.</p>
          <div className={styles.heroPills}>
            <span>Донат и баланс</span>
            <span>VIP и роли</span>
            <span>Проблемы сервера</span>
          </div>
        </div>
        <Link href="/" className={styles.backLink}>На главную</Link>
      </section>

      {loading ? (
        <section className={`${styles.card} ${styles.stateCard}`}>
          <h2>Загрузка</h2>
          <p>Подтягиваем твои обращения.</p>
        </section>
      ) : null}

      {!loading && !data?.isAuthenticated ? (
        <section className={`${styles.card} ${styles.authCard}`}>
          <div className={styles.authIcon}>S</div>
          <div>
            <h2>Нужна авторизация</h2>
            <p>Войди через Steam, чтобы создать тикет, видеть историю переписки и получать ответы администрации в одном месте.</p>
            <Link href="/api/steam/login" className={styles.primaryButton}>Войти через Steam</Link>
          </div>
        </section>
      ) : null}

      {!loading && data?.isAuthenticated ? (
        <div className={styles.supportGrid}>
          <section className={`${styles.card} ${styles.createTicketCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Новое обращение</span>
                <h2>Новый тикет</h2>
              </div>
              <p className={styles.steamIdBadge}>Steam ID: {data.steamId}</p>
            </div>
            <form className={styles.ticketForm} onSubmit={handleCreateTicket}>
              <label>
                <span>Тема</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  minLength={3}
                  maxLength={160}
                  placeholder="Например: не пришли монеты"
                  required
                />
              </label>
              <label>
                <span>Описание</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  minLength={10}
                  maxLength={3000}
                  placeholder="Опиши проблему, укажи дату платежа, сумму или сервер, если это важно."
                  required
                />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={submitting || !data.databaseConfigured}>
                Создать тикет
              </button>
            </form>
            {notice ? <p className={styles.notice}>{notice}</p> : null}
          </section>

          <section className={`${styles.card} ${styles.ticketsCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>История обращений</span>
                <h2>Мои тикеты</h2>
              </div>
              <p>{tickets.length > 0 ? `${tickets.length} обращений` : 'Обращений пока нет'}</p>
            </div>
            <div className={styles.ticketList}>
              {tickets.map((ticket) => (
                <article key={ticket.id} className={styles.ticketCard}>
                  <div className={styles.ticketHeader}>
                    <div>
                      <h3>#{ticket.id} {ticket.subject}</h3>
                      <p>Обновлён: {formatDate(ticket.lastMessageAt)}</p>
                    </div>
                    <span className={`${styles.status} ${statusClassNames[ticket.status]}`}>{statusLabels[ticket.status]}</span>
                  </div>
                  <div className={styles.messages}>
                    {ticket.messages.map((ticketMessage) => (
                      <div key={ticketMessage.id} className={`${styles.message} ${styles[`message_${ticketMessage.authorRole}`] || ''}`}>
                        <div className={styles.messageMeta}>
                          <strong>{getMessageAuthorLabel(ticketMessage.authorRole)}</strong>
                          <span>{formatDate(ticketMessage.createdAt)}</span>
                        </div>
                        <p>{ticketMessage.message}</p>
                      </div>
                    ))}
                  </div>
                  {ticket.status !== 'closed' ? (
                    <div className={styles.replyBox}>
                      <textarea
                        value={replyDrafts[ticket.id] || ''}
                        onChange={(event) => setReplyDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))}
                        placeholder="Ответить в тикет"
                        maxLength={3000}
                      />
                      <button className={styles.secondaryButton} type="button" onClick={() => void handleReply(ticket.id)} disabled={submitting}>
                        Отправить ответ
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {tickets.length === 0 ? <p className={styles.emptyState}>Создай первый тикет, если нужна помощь.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
