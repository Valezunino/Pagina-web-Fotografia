import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireRuntimeValue } from "@/lib/runtime";

export type MercadoPagoPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  transaction_amount?: number | string;
  currency_id?: string;
};

type OrderPaymentTarget = {
  id: string;
  amountCents: number;
  status: string;
  paymentId: string | null;
};

type PaymentSearchResponse = {
  results?: MercadoPagoPayment[];
};

const FAILED_PAYMENT_STATUSES = new Set(["rejected", "cancelled", "refunded", "charged_back"]);

function paymentMatchesOrder(payment: MercadoPagoPayment, order: OrderPaymentTarget) {
  return (
    payment.external_reference === order.id &&
    payment.currency_id === "ARS" &&
    Math.round(Number(payment.transaction_amount) * 100) === order.amountCents
  );
}

async function mercadoPagoRequest<T>(url: string): Promise<T> {
  const accessToken = requireRuntimeValue("MERCADO_PAGO_ACCESS_TOKEN");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Mercado Pago respondió ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function getMercadoPagoPayment(paymentId: string) {
  if (!/^\d+$/.test(paymentId)) return null;
  return mercadoPagoRequest<MercadoPagoPayment>(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
  );
}

async function findMercadoPagoPayment(order: OrderPaymentTarget) {
  const query = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    external_reference: order.id,
    range: "date_created",
    begin_date: "NOW-364DAYS",
    end_date: "NOW",
  });
  const search = await mercadoPagoRequest<PaymentSearchResponse>(
    `https://api.mercadopago.com/v1/payments/search?${query.toString()}`,
  );
  const matching = (search.results ?? []).filter((payment) => paymentMatchesOrder(payment, order));
  return matching.find((payment) => payment.status === "approved") ?? matching[0] ?? null;
}

async function resolvePayment(order: OrderPaymentTarget, candidatePaymentId?: string) {
  const ids = [...new Set([candidatePaymentId, order.paymentId].filter((id): id is string => Boolean(id)))];

  for (const paymentId of ids) {
    try {
      const payment = await getMercadoPagoPayment(paymentId);
      if (payment && paymentMatchesOrder(payment, order)) return payment;
    } catch {
      // La búsqueda por referencia que sigue funciona como respaldo.
    }
  }

  return findMercadoPagoPayment(order);
}

export async function reconcileMercadoPagoOrder(orderId: string, candidatePaymentId?: string) {
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      amountCents: orders.amountCents,
      status: orders.status,
      paymentId: orders.paymentId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status === "approved") return order ?? null;

  const payment = await resolvePayment(order, candidatePaymentId);
  if (!payment || !paymentMatchesOrder(payment, order)) return order;

  const paymentId = payment.id == null ? order.paymentId : String(payment.id);
  if (payment.status === "approved") {
    await db
      .update(orders)
      .set({ status: "approved", paymentId, paidAt: new Date() })
      .where(eq(orders.id, order.id));
    return { ...order, status: "approved", paymentId };
  }

  if (payment.status && FAILED_PAYMENT_STATUSES.has(payment.status)) {
    await db
      .update(orders)
      .set({ status: payment.status, paymentId })
      .where(eq(orders.id, order.id));
    return { ...order, status: payment.status, paymentId };
  }

  if (paymentId && paymentId !== order.paymentId) {
    await db.update(orders).set({ paymentId }).where(eq(orders.id, order.id));
  }
  return { ...order, paymentId };
}

export async function verifyMercadoPagoReturn(orderId: string, paymentId: string) {
  const payment = await getMercadoPagoPayment(paymentId);
  if (!payment) return null;

  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      amountCents: orders.amountCents,
      status: orders.status,
      paymentId: orders.paymentId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !paymentMatchesOrder(payment, order)) return null;
  const reconciled = await applyMercadoPagoPayment(payment);
  return {
    status: reconciled?.status ?? order.status,
    paymentId: String(payment.id ?? paymentId),
  };
}

export async function verifyApprovedMercadoPagoOrder(orderId: string) {
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      amountCents: orders.amountCents,
      status: orders.status,
      paymentId: orders.paymentId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  const payment = await findMercadoPagoPayment(order);
  if (!payment || payment.status !== "approved" || !paymentMatchesOrder(payment, order)) return null;
  const reconciled = await applyMercadoPagoPayment(payment);
  return {
    status: reconciled?.status ?? order.status,
    paymentId: String(payment.id ?? order.paymentId ?? ""),
  };
}

export async function applyMercadoPagoPayment(payment: MercadoPagoPayment) {
  const orderId = payment.external_reference;
  if (!orderId) return null;

  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      amountCents: orders.amountCents,
      status: orders.status,
      paymentId: orders.paymentId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || !paymentMatchesOrder(payment, order)) return order ?? null;

  const paymentId = payment.id == null ? order.paymentId : String(payment.id);
  if (payment.status === "approved") {
    await db
      .update(orders)
      .set({ status: "approved", paymentId, paidAt: new Date() })
      .where(eq(orders.id, order.id));
    return { ...order, status: "approved", paymentId };
  }

  if (payment.status && FAILED_PAYMENT_STATUSES.has(payment.status) && order.status !== "approved") {
    await db
      .update(orders)
      .set({ status: payment.status, paymentId })
      .where(eq(orders.id, order.id));
    return { ...order, status: payment.status, paymentId };
  }

  return order;
}
