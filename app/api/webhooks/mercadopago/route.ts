import {
  applyMercadoPagoPayment,
  getMercadoPagoPayment,
  MercadoPagoApiError,
} from "@/lib/mercado-pago";
import { runtime } from "@/lib/runtime";
import { hmac, safeEqual } from "@/lib/security";

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
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id") ?? "unknown";
  const url = new URL(request.url);
  const queryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("data_id") ?? "";

  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
    };
    const resourceId = String(queryDataId || body.data?.id || url.searchParams.get("id") || "").trim();
    const eventType = String(body.type || url.searchParams.get("type") || url.searchParams.get("topic") || "")
      .trim()
      .toLowerCase();
    const webhookSecret = runtime().MERCADO_PAGO_WEBHOOK_SECRET?.trim();
    const signatureValid = Boolean(
      webhookSecret && queryDataId && (await hasValidSignature(request, queryDataId, webhookSecret)),
    );

    console.log(JSON.stringify({
      level: signatureValid ? "info" : "warning",
      message: "mercado_pago_webhook_received",
      route: "/api/webhooks/mercadopago",
      requestId,
      eventType: eventType || "unknown",
      action: body.action || "unknown",
      hasResourceId: Boolean(resourceId),
      signatureValid,
    }));

    if (!resourceId || (eventType && eventType !== "payment")) {
      return Response.json({ ok: true });
    }

    // La firma se valida con data.id de la URL, tal como exige Mercado Pago.
    // Si la clave configurada no coincide o llega una notificación legacy, el
    // payload nunca se toma como fuente de verdad: consultamos el pago con el
    // Access Token privado y la actualización vuelve a validar orden, importe
    // y moneda antes de aprobarla.
    const payment = await getMercadoPagoPayment(resourceId);
    const order = payment ? await applyMercadoPagoPayment(payment) : null;

    console.log(JSON.stringify({
      level: "info",
      message: "mercado_pago_webhook_processed",
      route: "/api/webhooks/mercadopago",
      requestId,
      signatureValid,
      paymentStatus: payment?.status ?? "not_found",
      orderMatched: Boolean(order),
      durationMs: Date.now() - startedAt,
    }));

    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof MercadoPagoApiError && error.status === 404 ? 200 : 503;
    console.error(JSON.stringify({
      level: status === 200 ? "warning" : "error",
      message: "mercado_pago_webhook_failed",
      route: "/api/webhooks/mercadopago",
      requestId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }));
    return Response.json({ ok: status === 200 }, { status });
  }
}
