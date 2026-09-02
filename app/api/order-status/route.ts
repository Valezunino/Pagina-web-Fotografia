import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, photos } from "@/db/schema";
import {
  reconcileMercadoPagoOrder,
  verifyApprovedMercadoPagoOrder,
  verifyMercadoPagoReturn,
} from "@/lib/mercado-pago";
import { createOrderAccessToken, verifyOrderAccessToken } from "@/lib/order-access";
import { getOrderItemsOrEmpty } from "@/lib/order-items";
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
        photoId: orders.photoId,
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
      try {
        const approvedOrder = await verifyApprovedMercadoPagoOrder(orderId);
        if (approvedOrder?.status === "approved") {
          authorized = true;
          status = approvedOrder.status;
        }
      } catch {
        // Respaldo para compras anteriores que volvieron sin cookie ni ID visible.
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
    const storedItems = await getOrderItemsOrEmpty(orderId);
    const items = storedItems.length
      ? storedItems.map((item) => ({ id: item.photoId, title: item.title }))
      : [{ id: row.photoId, title: row.title }];
    const downloads = items.map((item) => {
      const downloadQuery = new URLSearchParams({ order: orderId, access: verifiedAccess, photo: item.id });
      return { ...item, downloadUrl: `/api/download?${downloadQuery.toString()}` };
    });
    return Response.json({
      status,
      title: items.length === 1 ? items[0].title : `${items.length} fotografías`,
      itemCount: items.length,
      items: status === "approved" ? downloads : items.map(({ id, title }) => ({ id, title })),
      accessToken: verifiedAccess,
      downloadUrl: status === "approved" ? downloads[0]?.downloadUrl ?? null : null,
    });
  } catch {
    return Response.json({ error: "No pudimos consultar el pago." }, { status: 503 });
  }
}
