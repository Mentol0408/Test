import { randomBytes } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';

import db from '@/lib/db';
import { isDatabaseUnavailableError } from '@/lib/db';
import { sessionOptions } from '@/lib/session';
import type { PaymentProvider, PaymentType } from '@/lib/paymentConfig';
import type { SessionData } from '@/types/iron-session';

type PurchaseRecord = {
  id: number;
  created_at: string;
};

export function resolveExternalBaseUrl(req: NextApiRequest) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  const protocol =
    (req.headers['x-forwarded-proto'] as string) ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');

  return `${protocol}://${req.headers.host}`;
}

export function getBaseUrl(req: NextApiRequest) {
  return resolveExternalBaseUrl(req);
}

export async function getSteamIdFromRequest(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SESSION_SECRET) {
    return null;
  }

  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  return session.steamId || null;
}

export function buildMerchantOrderId(provider: PaymentProvider, purchaseId?: number | null) {
  if (purchaseId) {
    return `${provider}-${purchaseId}`;
  }

  return `${provider}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.slice(0, 36);
}

export async function createPurchaseRecord(params: {
  steamId: string;
  paymentType: PaymentType;
  amount: number;
  provider: PaymentProvider;
  meta?: Record<string, unknown>;
}): Promise<PurchaseRecord | null> {
  const { steamId, paymentType, amount, provider, meta = {} } = params;

  try {
    const purchase = (await db.createPurchase({
      userId: steamId,
      serverKey: 'donate',
      itemType: paymentType,
      amount,
      meta: { provider, ...meta },
    })) as PurchaseRecord;

    await db.addLog({
      purchaseId: purchase.id,
      serverKey: 'donate',
      event: 'payment_request_created',
      meta: { provider, paymentType, amount, ...meta },
    });

    return purchase;
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to create purchase record', error);
    }

    return null;
  }
}

export async function updatePurchaseRecord(params: {
  purchaseId?: number | null;
  provider: PaymentProvider;
  status: string;
  event: string;
  meta?: Record<string, unknown>;
}) {
  const { purchaseId, provider, status, event, meta = {} } = params;

  if (!purchaseId) {
    return;
  }

  try {
    await db.updatePurchaseStatus(purchaseId, status, { provider, ...meta });
    await db.addLog({
      purchaseId,
      serverKey: 'donate',
      event,
      meta: { provider, ...meta },
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to update purchase record', error);
    }
  }
}