import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getPaymentComment,
  getPaymentTitle,
  isPaymentType,
  resolvePaymentAmount,
} from '@/lib/paymentConfig';
import {
  buildMerchantOrderId,
  createPurchaseRecord,
  getBaseUrl,
  getSteamIdFromRequest,
  updatePurchaseRecord,
} from '@/lib/paymentServer';

type CreatePaymentResponse = {
  ok: boolean;
  url?: string;
  error?: string;
  provider?: 'enot';
  purchaseId?: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatePaymentResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const steamId = await getSteamIdFromRequest(req, res);

  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  if (!process.env.ENOT_SHOP_ID || !process.env.ENOT_API_KEY) {
    return res.status(503).json({ ok: false, error: 'ENOT_NOT_CONFIGURED' });
  }

  const paymentType = req.body?.paymentType;

  if (!isPaymentType(paymentType)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_TYPE' });
  }

  if (paymentType !== 'balance_topup') {
    return res.status(409).json({ ok: false, error: 'DIRECT_PAYMENT_DISABLED' });
  }

  if (!process.env.ENOT_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'ENOT_WEBHOOK_SECRET_NOT_CONFIGURED' });
  }

  let amount: number;

  try {
    const rawAmount =
      typeof req.body?.amount === 'number'
        ? req.body.amount
        : Number.isFinite(Number(req.body?.amount))
          ? Number(req.body?.amount)
          : undefined;

    amount = resolvePaymentAmount(paymentType, rawAmount);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'INVALID_AMOUNT',
    });
  }

  const purchase = await createPurchaseRecord({
    steamId,
    paymentType,
    amount,
    provider: 'enot',
  });

  const orderId = buildMerchantOrderId('enot', purchase?.id);
  const baseUrl = getBaseUrl(req);
  const successUrl = process.env.ENOT_SUCCESS_URL || `${baseUrl}/?payment=success&provider=enot#donate`;
  const failUrl = process.env.ENOT_FAIL_URL || `${baseUrl}/?payment=failed&provider=enot#donate`;
  const hookUrl = process.env.ENOT_WEBHOOK_URL || `${baseUrl}/api/enot/webhook`;

  const payload: Record<string, unknown> = {
    amount,
    order_id: orderId,
    currency: 'RUB',
    shop_id: process.env.ENOT_SHOP_ID,
    comment: getPaymentComment(paymentType, amount),
    success_url: successUrl,
    fail_url: failUrl,
    hook_url: hookUrl,
    custom_fields: JSON.stringify({
      provider: 'enot',
      paymentType,
      amount,
      steamId,
      purchaseId: purchase?.id ?? null,
      title: getPaymentTitle(paymentType, amount),
    }),
    expire: Number(process.env.ENOT_INVOICE_EXPIRE_MINUTES || 300),
  };

  try {
    const response = await fetch('https://api.enot.io/invoice/create', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': process.env.ENOT_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    const paymentUrl = data?.data?.url as string | undefined;
    const invoiceId = data?.data?.id as string | undefined;

    if (!response.ok || !paymentUrl) {
      await updatePurchaseRecord({
        purchaseId: purchase?.id,
        provider: 'enot',
        status: 'provider_error',
        event: 'enot_invoice_create_failed',
        meta: {
          orderId,
          responseStatus: response.status,
          providerError: data?.error || null,
        },
      });

      return res.status(response.ok ? 502 : response.status).json({
        ok: false,
        error: data?.error || 'ENOT_CREATE_FAILED',
      });
    }

    await updatePurchaseRecord({
      purchaseId: purchase?.id,
      provider: 'enot',
      status: 'invoice_created',
      event: 'enot_invoice_created',
      meta: {
        orderId,
        invoiceId,
        paymentUrl,
        expiresAt: data?.data?.expired || null,
      },
    });

    return res.status(200).json({
      ok: true,
      url: paymentUrl,
      provider: 'enot',
      purchaseId: purchase?.id ?? null,
    });
  } catch (error) {
    await updatePurchaseRecord({
      purchaseId: purchase?.id,
      provider: 'enot',
      status: 'provider_error',
      event: 'enot_request_failed',
      meta: {
        orderId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return res.status(502).json({ ok: false, error: 'ENOT_REQUEST_FAILED' });
  }
}