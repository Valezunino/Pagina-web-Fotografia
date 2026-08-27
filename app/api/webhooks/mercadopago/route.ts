import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireRuntimeValue } from "@/lib/runtime";
import { hmac, safeEqual } from "@/lib/security";

type MercadoPagoPayment = {
  id?: number;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
};

function signatureParts(value: string) {
  return Object.fromEntries(
    value
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter(([key, partValue]) => key && partValue),
  );
}

async function hasValidSignature(request: Request, dataId: string, secret: string) {
  const signature = signatureParts(request.headers.get("x-signature") ?? "");
  const requestId = request.headers.get("x-request-id")?.trim();
  if (!signature.ts || !signature.v1) return false;

  const manifest = [
    dataId ? `id:${dataId.toLowerCase()}` : "",
    requestId ? `request-id:${requestId}` : "",
    `ts:${signature.ts}`,
  ]
    .filter(Boolean)
    .join(";") + ";";

  const expected = await hmac(manifest, secret);
  return safeEqual(expected, signature.v1.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as { data?: { id?: string | number } };
    const paymentId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
    if (!paymentId) return Response.json({ ok: true });

    const webhookSecret = requireRuntimeValue("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!(await hasValidSignature(request, paymentId, webhookSecret))) {
      return Response.json({ error: "Firma inválida." }, { status: 401 });
    }

    const accessToken = requireRuntimeValue("MERCADO_PAGO_ACCESS_TOKEN");
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!paymentResponse.ok) return Response.json({ ok: true });

    const payment = (await paymentResponse.json()) as MercadoPagoPayment;
    const orderId = payment.external_reference;
    if (!orderId) return Response.json({ ok: true });

    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return Response.json({ ok: true });

    const amountMatches = Math.round(Number(payment.transaction_amount) * 100) === order.amountCents;
    if (payment.status === "approved" && payment.currency_id === "ARS" && amountMatches) {
      await db
        .update(orders)
        .set({
          status: "approved",
          paymentId: String(payment.id ?? paymentId),
          paidAt: new Date(),
        })
        .where(eq(orders.id, order.id));
    } else if (payment.status === "rejected" || payment.status === "cancelled" || payment.status === "refunded") {
      await db
        .update(orders)
        .set({ status: payment.status, paymentId: String(payment.id ?? paymentId) })
        .where(eq(orders.id, order.id));
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
