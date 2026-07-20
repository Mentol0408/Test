import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import db from '@/lib/db';
import { fulfillPurchaseInGame } from '@/lib/purchaseFulfillment';
import { updatePurchaseRecord } from '@/lib/paymentServer';

type TBankWebhookBody = Record<string, unknown> & {
  Token?: string;
  Status?: string;
  OrderId?: string;
  PaymentId?: string;
  Success?: boolean;
};

function buildTBankToken(payload: Record<string, unknown>, password: string) {
  const data: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'Token' || value == null || typeof value === 'object') {
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      data[key] = value;
    }
  }

  data.Password = password;

  const concatenated = Object.keys(data)
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((key) => String(data[key]))
    .join('');

  return crypto.createHash('sha256').update(concatenated, 'utf8').digest('hex');
}

function extractPurchaseId(body: TBankWebhookBody) {
  if (typeof body.OrderId === 'string') {
    const match = body.OrderId.match(/-(\d+)$/);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function mapTBankStatus(status: unknown) {
  switch (status) {
    case 'CONFIRMED':
      return 'paid';
    case 'REFUNDED':
    case 'PARTIAL_REFUNDED':
      return 'refunded';
    case 'REJECTED':
    case 'DEADLINE_EXPIRED':
    case 'CANCELED':
      return 'failed';
    default:
      return 'unknown';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  if (req.method !== 'POST') {
    return res.status(405).send('METHOD_NOT_ALLOWED');
  }

  if (!process.env.TBANK_PASSWORD) {
    return res.status(503).send('TBANK_NOT_CONFIGURED');
  }

  const body = (req.body || {}) as TBankWebhookBody;
  const receivedToken = typeof body.Token === 'string' ? body.Token : '';
  const expectedToken = buildTBankToken(body, process.env.TBANK_PASSWORD);

  if (!receivedToken || receivedToken !== expectedToken) {
    return res.status(401).send('INVALID_TOKEN');
  }

  const purchaseId = extractPurchaseId(body);
  const status = mapTBankStatus(body.Status);

  await updatePurchaseRecord({
    purchaseId,
    provider: 'tbank',
    status,
    event: 'tbank_webhook_received',
    meta: {
      orderId: body.OrderId,
      paymentId: body.PaymentId,
      status: body.Status,
      success: body.Success,
      payload: body,
    },
  });

  if (purchaseId && status === 'paid') {
    const purchase = await db.getPurchaseById(purchaseId).catch(() => null);

    if (purchase?.itemType === 'balance_topup' && purchase.userId) {
      await db.applyBalanceTopup({
        userSteamId: purchase.userId,
        purchaseId,
        amount: purchase.amount,
        meta: {
          provider: 'tbank',
          source: 'webhook',
          paymentId: body.PaymentId,
          orderId: body.OrderId,
        },
      }).catch(() => null);
    } else if (purchase?.userId) {
      try {
        const fulfillment = await fulfillPurchaseInGame({
          purchaseId,
          userSteamId: purchase.userId,
          itemType: purchase.itemType,
          amount: purchase.amount,
          meta: purchase.meta,
        });

        if (!fulfillment.ok) {
          await updatePurchaseRecord({
            purchaseId,
            provider: 'tbank',
            status: 'failed',
            event: 'tbank_fulfillment_failed',
            meta: { fulfillment },
          });
        }
      } catch (error) {
        await updatePurchaseRecord({
          purchaseId,
          provider: 'tbank',
          status: 'failed',
          event: 'tbank_fulfillment_failed',
          meta: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  return res.status(200).send('OK');
}