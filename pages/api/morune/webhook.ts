import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import db from '@/lib/db';
import { fulfillPurchaseInGame } from '@/lib/purchaseFulfillment';
import { updatePurchaseRecord } from '@/lib/paymentServer';

type WebhookResponse = {
  ok: boolean;
  error?: string;
};

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item as JsonValue));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .reduce<JsonObject>((accumulator, key) => {
        accumulator[key] = sortKeysDeep((value as JsonObject)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function serializeSorted(value: JsonValue, spaced: boolean): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeSorted(item as JsonValue, spaced)).join(spaced ? ', ' : ',')}]`;
  }

  const separator = spaced ? ': ' : ':';
  const joinSeparator = spaced ? ', ' : ',';
  const entries = Object.entries(value).map(
    ([key, currentValue]) => `${JSON.stringify(key)}${separator}${serializeSorted(currentValue as JsonValue, spaced)}`
  );

  return `{${entries.join(joinSeparator)}}`;
}

function buildMoruneSignatureCandidates(body: JsonObject) {
  const normalized = sortKeysDeep(body) as JsonObject;

  return [
    serializeSorted(normalized, false),
    serializeSorted(normalized, true),
  ];
}

function isValidMoruneSignature(body: JsonObject, signature: string, secret: string) {
  const candidates = buildMoruneSignatureCandidates(body);

  return candidates.some((payload) => {
    const digest = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const digestBuffer = Buffer.from(digest, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (digestBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
  });
}

function parseCustomFields(customFields: unknown) {
  if (!customFields) {
    return null;
  }

  if (typeof customFields === 'string') {
    try {
      return JSON.parse(customFields) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (typeof customFields === 'object') {
    return customFields as Record<string, unknown>;
  }

  return null;
}

function extractPurchaseId(body: Record<string, unknown>) {
  const customFields = parseCustomFields(body.custom_fields);
  const purchaseId = customFields?.purchaseId;

  if (typeof purchaseId === 'number') {
    return purchaseId;
  }

  if (typeof purchaseId === 'string' && /^\d+$/.test(purchaseId)) {
    return Number(purchaseId);
  }

  if (typeof body.order_id === 'string') {
    const match = body.order_id.match(/-(\d+)$/);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function mapMoruneStatus(status: unknown) {
  switch (status) {
    case 'success':
      return 'paid';
    case 'refund':
      return 'refunded';
    case 'expired':
      return 'expired';
    case 'fail':
      return 'failed';
    default:
      return 'unknown';
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!process.env.MORUNE_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'MORUNE_WEBHOOK_SECRET_NOT_CONFIGURED' });
  }

  const signature = req.headers['x-api-sha256-signature'];

  if (!signature || typeof signature !== 'string') {
    return res.status(401).json({ ok: false, error: 'INVALID_SIGNATURE' });
  }

  const body = (req.body || {}) as Record<string, unknown>;

  if (!isValidMoruneSignature(body as JsonObject, signature, process.env.MORUNE_WEBHOOK_SECRET)) {
    return res.status(401).json({ ok: false, error: 'INVALID_SIGNATURE' });
  }

  const purchaseId = extractPurchaseId(body);
  const purchaseStatus = mapMoruneStatus(body.status);

  await updatePurchaseRecord({
    purchaseId,
    provider: 'morune',
    status: purchaseStatus,
    event: 'morune_webhook_received',
    meta: {
      webhookStatus: body.status,
      orderId: body.order_id,
      invoiceId: body.invoice_id,
      amount: body.amount,
      code: body.code,
      payload: body,
    },
  });

  if (purchaseId && purchaseStatus === 'paid') {
    const purchase = await db.getPurchaseById(purchaseId).catch(() => null);

    if (purchase?.itemType === 'balance_topup' && purchase.userId) {
      await db.applyBalanceTopup({
        userSteamId: purchase.userId,
        purchaseId,
        amount: purchase.amount,
        meta: {
          provider: 'morune',
          source: 'webhook',
          invoiceId: body.invoice_id,
          orderId: body.order_id,
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
            provider: 'morune',
            status: 'failed',
            event: 'morune_fulfillment_failed',
            meta: { fulfillment },
          });
        }
      } catch (error) {
        await updatePurchaseRecord({
          purchaseId,
          provider: 'morune',
          status: 'failed',
          event: 'morune_fulfillment_failed',
          meta: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  return res.status(200).json({ ok: true });
}