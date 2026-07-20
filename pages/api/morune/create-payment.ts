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
  provider?: 'morune';
  purchaseId?: number | null;
};

function getMoruneIncludeServices() {
  if (!process.env.MORUNE_INCLUDE_SERVICES) {
    return undefined;
  }

  const services = process.env.MORUNE_INCLUDE_SERVICES.split(',')
    .map((service) => service.trim())
    .filter(Boolean);

  return services.length > 0 ? services : undefined;
}

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

  if (!process.env.MORUNE_SHOP_ID || !process.env.MORUNE_API_KEY) {
    return res.status(503).json({ ok: false, error: 'MORUNE_NOT_CONFIGURED' });
  }

  const paymentType = req.body?.paymentType;

  if (!isPaymentType(paymentType)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_TYPE' });
  }

  if (paymentType !== 'balance_topup') {
    return res.status(409).json({ ok: false, error: 'DIRECT_PAYMENT_DISABLED' });
  }

  if (!process.env.MORUNE_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'MORUNE_WEBHOOK_SECRET_NOT_CONFIGURED' });
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
    provider: 'morune',
  });

  const orderId = buildMerchantOrderId('morune', purchase?.id);
  const baseUrl = getBaseUrl(req);
  const includeService = getMoruneIncludeServices();

  const payload: Record<string, unknown> = {
    amount,
    order_id: orderId,
    currency: 'RUB',
    shop_id: process.env.MORUNE_SHOP_ID,
    comment: getPaymentComment(paymentType, amount),
    success_url: `${baseUrl}/?payment=success&provider=morune#donate`,
    fail_url: `${baseUrl}/?payment=failed&provider=morune#donate`,
    custom_fields: JSON.stringify({
      provider: 'morune',
      paymentType,
      amount,
      steamId,
      purchaseId: purchase?.id ?? null,
      title: getPaymentTitle(paymentType, amount),
    }),
    expire: Number(process.env.MORUNE_INVOICE_EXPIRE_MINUTES || 300),
  };

  payload.hook_url = `${baseUrl}/api/morune/webhook`;

  if (includeService) {
    payload.include_service = includeService;
  }

  try {
    const response = await fetch('https://api.morune.com/invoice/create', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': process.env.MORUNE_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    const paymentUrl = data?.data?.url as string | undefined;
    const invoiceId = data?.data?.id as string | undefined;

    if (!response.ok || !paymentUrl) {
      await updatePurchaseRecord({
        purchaseId: purchase?.id,
        provider: 'morune',
        status: 'provider_error',
        event: 'morune_invoice_create_failed',
        meta: {
          orderId,
          responseStatus: response.status,
          providerError: data?.error || null,
        },
      });

      return res.status(response.ok ? 502 : response.status).json({
        ok: false,
        error: data?.error || 'MORUNE_CREATE_FAILED',
      });
    }

    await updatePurchaseRecord({
      purchaseId: purchase?.id,
      provider: 'morune',
      status: 'invoice_created',
      event: 'morune_invoice_created',
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
      provider: 'morune',
      purchaseId: purchase?.id ?? null,
    });
  } catch (error) {
    await updatePurchaseRecord({
      purchaseId: purchase?.id,
      provider: 'morune',
      status: 'provider_error',
      event: 'morune_request_failed',
      meta: {
        orderId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return res.status(502).json({ ok: false, error: 'MORUNE_REQUEST_FAILED' });
  }
}