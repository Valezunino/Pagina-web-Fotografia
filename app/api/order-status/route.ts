import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, photos } from "@/db/schema";
import { reconcileMercadoPagoOrder, verifyMercadoPagoReturn } from "@/lib/mercado-pago";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-access";
import { verifyOrderCookie } from "@/lib/order-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order") ?? "";
  const paymentId = url.searchParams.get("paymentId") ?? undefined;
  const accessToken = url.searchParams.get("access") ?? undefined;
  if (!orderId) return Response.json({ error: "Compra no encontrada." }, { status: 400 });

  try {
    const [row] = await getDb()
      .select({
        id: orders.id,
        status: orders.status,
        claimHash: orders.claimHash,
        title: photos.title,
      })
      .from(orders)
      .innerJoin(photos, eq(photos.id, orders.photoId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!row) {
      return Response.json({ error: "No pudimos verificar esta compra." }, { status: 403 });
    }

    let status = row.status;
    let authorized =
      (await verifyOrderCookie(orderId, row.claimHash)) ||
      (await verifyOrderAccessToken(orderId, accessToken));

    if (!authorized && paymentId) {
      try {
        const paymentReturn = await verifyMercadoPagoReturn(orderId, paymentId);
        if (paymentReturn) {
          authorized = true;
          status = paymentReturn.status;
        }
      } catch {
        // Si Mercado Pago demora, el cliente puede volver a verificar sin perder la compra.
      }
    }

    if (!authorized) {
      return Response.json({ error: "No pudimos verificar esta compra." }, { status: 403 });
    }

    if (status !== "approved") {
      try {
        status = (await reconcileMercadoPagoOrder(orderId, paymentId))?.status ?? status;
      } catch {
        // Si Mercado Pago demora en responder, conservamos el estado y el cliente vuelve a consultar.
      }
    }

    const verifiedAccess = await createOrderAccessToken(orderId);
    const downloadQuery = new URLSearchParams({ order: orderId, access: verifiedAccess });
    return Response.json({
      status,
      title: row.title,
      accessToken: verifiedAccess,
      downloadUrl: status === "approved" ? `/api/download?${downloadQuery.toString()}` : null,
    });
  } catch {
    return Response.json({ error: "No pudimos consultar el pago." }, { status: 503 });
  }
}
