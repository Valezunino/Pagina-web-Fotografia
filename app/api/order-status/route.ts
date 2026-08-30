import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, photos } from "@/db/schema";
import { reconcileMercadoPagoOrder } from "@/lib/mercado-pago";
import { verifyOrderCookie } from "@/lib/order-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order") ?? "";
  const paymentId = url.searchParams.get("paymentId") ?? undefined;
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
    if (!row || !(await verifyOrderCookie(orderId, row.claimHash))) {
      return Response.json({ error: "No pudimos verificar esta compra." }, { status: 403 });
    }

    let status = row.status;
    if (status !== "approved") {
      try {
        status = (await reconcileMercadoPagoOrder(orderId, paymentId))?.status ?? status;
      } catch {
        // Si Mercado Pago demora en responder, conservamos el estado y el cliente vuelve a consultar.
      }
    }

    return Response.json({
      status,
      title: row.title,
      downloadUrl: status === "approved" ? `/api/download?order=${encodeURIComponent(orderId)}` : null,
    });
  } catch {
    return Response.json({ error: "No pudimos consultar el pago." }, { status: 503 });
  }
}
