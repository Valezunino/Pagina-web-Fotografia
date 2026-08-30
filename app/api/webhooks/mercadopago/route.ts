import { applyMercadoPagoPayment, getMercadoPagoPayment } from "@/lib/mercado-pago";
import { requireRuntimeValue } from "@/lib/runtime";
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
  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as { data?: { id?: string | number } };
    const paymentId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
    if (!paymentId) return Response.json({ ok: true });

    const webhookSecret = requireRuntimeValue("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!(await hasValidSignature(request, paymentId, webhookSecret))) {
      return Response.json({ error: "Firma inválida." }, { status: 401 });
    }

    const payment = await getMercadoPagoPayment(paymentId);
    if (payment) await applyMercadoPagoPayment(payment);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
