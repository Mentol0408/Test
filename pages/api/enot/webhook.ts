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
      .sort()
      .reduce<JsonObject>((accumulator, key) => {
        accumulator[key] = sortKeysDeep((value as JsonObject)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function sortKeysShallow(value: JsonObject): JsonObject {
  return Object.keys(value)
    .sort()
    .reduce<JsonObject>((accumulator, key) => {
      accumulator[key] = value[key];
      return accumulator;
    }, {});
}

function escapeJsonString(value: string, escapeUnicode: boolean) {
  const serialized = JSON.stringify(value);

  if (!escapeUnicode) {
    return serialized;
  }

  return serialized.replace(/[^\x00-\x7F]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}

function serializeSorted(value: JsonValue, spaced: boolean, escapeUnicode: boolean): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return escapeJsonString(value, escapeUnicode);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeSorted(item as JsonValue, spaced, escapeUnicode)).join(spaced ? ', ' : ',')}]`;
  }

  const separator = spaced ? ': ' : ':';
  const joinSeparator = spaced ? ', ' : ',';
  const entries = Object.entries(value).map(
    ([key, currentValue]) => `${escapeJsonString(key, escapeUnicode)}${separator}${serializeSorted(currentValue as JsonValue, spaced, escapeUnicode)}`
  );

  return `{${entries.join(joinSeparator)}}`;
}

function buildEnotSignatureCandidates(body: JsonObject) {
  const normalizedBodies = [
    sortKeysDeep(body) as JsonObject,
    sortKeysShallow(body),
  ];
  const candidates = new Set<string>();

  normalizedBodies.forEach((normalized) => {
    [false, true].forEach((escapeUnicode) => {
      candidates.add(serializeSorted(normalized, true, escapeUnicode));
      candidates.add(serializeSorted(normalized, false, escapeUnicode));
    });
  });

  return Array.from(candidates);
}

function normalizeSignature(signature: string) {
  return signature.trim().replace(/^sha256=/i, '').toLowerCase();
}

function getEnotWebhookSecrets() {
  return [
    process.env.ENOT_WEBHOOK_SECRET,
    process.env.ENOT_ADDITIONAL_KEY,
    process.env.ENOT_API_KEY,
  ]
    .map((secret) => secret?.trim())
    .filter((secret): secret is string => Boolean(secret));
}

function isValidEnotSignature(body: JsonObject, signature: string, secret: string) {
  const candidates = buildEnotSignatureCandidates(body);
  const normalizedSignature = normalizeSignature(signature);

  return candidates.some((payload) => {
    const digest = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const digestBuffer = Buffer.from(digest, 'utf8');
    const signatureBuffer = Buffer.from(normalizedSignature, 'utf8');

    if (digestBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
  });
}

function isValidEnotSignatureWithSecrets(body: JsonObject, signature: string, secrets: string[]) {
  return secrets.some((secret) => isValidEnotSignature(body, signature, secret));
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

function mapEnotStatus(status: unknown) {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  switch (normalizedStatus) {
    case 'success':
    case 'paid':
    case 'complete':
    case 'completed':
      return 'paid';
    case 'refund':
    case 'refunded':
      return 'refunded';
    case 'expired':
      return 'expired';
    case 'fail':
    case 'failed':
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

  const secrets = getEnotWebhookSecrets();

  if (secrets.length === 0) {
    return res.status(503).json({ ok: false, error: 'ENOT_WEBHOOK_SECRET_NOT_CONFIGURED' });
  }

  const signatureHeader = req.headers['x-api-sha256-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const body = (req.body || {}) as Record<string, unknown>;

  if (!signature || typeof signature !== 'string') {
    console.warn('enot webhook rejected: missing signature', {
      orderId: body.order_id,
      invoiceId: body.invoice_id,
      status: body.status,
    });
    return res.status(401).json({ ok: false, error: 'INVALID_SIGNATURE' });
  }

  if (!isValidEnotSignatureWithSecrets(body as JsonObject, signature, secrets)) {
    console.warn('enot webhook rejected: invalid signature', {
      orderId: body.order_id,
      invoiceId: body.invoice_id,
      status: body.status,
      signatureHeader: signature.slice(0, 12),
    });
    return res.status(401).json({ ok: false, error: 'INVALID_SIGNATURE' });
  }

  const purchaseId = extractPurchaseId(body);
  const purchaseStatus = mapEnotStatus(body.status);

  await updatePurchaseRecord({
    purchaseId,
    provider: 'enot',
    status: purchaseStatus,
    event: 'enot_webhook_received',
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
      try {
        const balanceTopup = await db.applyBalanceTopup({
          userSteamId: purchase.userId,
          purchaseId,
          amount: purchase.amount,
          meta: {
            provider: 'enot',
            source: 'webhook',
            invoiceId: body.invoice_id,
            orderId: body.order_id,
          },
        });

        if (!balanceTopup.applied) {
          await updatePurchaseRecord({
            purchaseId,
            provider: 'enot',
            status: 'paid',
            event: 'enot_balance_topup_already_applied',
            meta: {
              invoiceId: body.invoice_id,
              orderId: body.order_id,
              balance: balanceTopup.balance,
            },
          });
        }
      } catch (error) {
        console.error('enot balance topup failed', error);
        await updatePurchaseRecord({
          purchaseId,
          provider: 'enot',
          status: 'paid_balance_failed',
          event: 'enot_balance_topup_failed',
          meta: {
            invoiceId: body.invoice_id,
            orderId: body.order_id,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        return res.status(500).json({ ok: false, error: 'BALANCE_TOPUP_FAILED' });
      }
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
            provider: 'enot',
            status: 'failed',
            event: 'enot_fulfillment_failed',
            meta: { fulfillment },
          });
        }
      } catch (error) {
        await updatePurchaseRecord({
          purchaseId,
          provider: 'enot',
          status: 'failed',
          event: 'enot_fulfillment_failed',
          meta: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  return res.status(200).json({ ok: true });
}
