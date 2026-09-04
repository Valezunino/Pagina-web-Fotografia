import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { orderItems, orders, photos } from "@/db/schema";
import {
  reconcileMercadoPagoOrder,
  verifyApprovedMercadoPagoOrder,
  verifyMercadoPagoReturn,
} from "@/lib/mercado-pago";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { getOrderItemsOrEmpty } from "@/lib/order-items";
import { verifyOrderCookie } from "@/lib/order-auth";
import { readStoredAsset } from "@/lib/stored-assets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeDownloadName(filename: string) {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return fallback || "fotografia-original.jpg";
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? "unknown";
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order") ?? "";
  const accessToken = url.searchParams.get("access") ?? undefined;
  const paymentId = url.searchParams.get("paymentId") ?? undefined;
  const requestedPhotoId = url.searchParams.get("photo")?.trim() ?? "";
  const openInline = url.searchParams.get("view") === "1";
  if (!orderId) return new Response("Compra no encontrada", { status: 400 });
  try {
    const db = getDb();
    const [row] = await db.select({
      status: orders.status,
      claimHash: orders.claimHash,
      photoId: orders.photoId,
    }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!row) return new Response("No autorizado", { status: 403 });
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
        // La descarga permanece protegida hasta poder validar el pago.
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
        // Respaldo para compras anteriores abiertas desde otro navegador.
      }
    }
    if (!authorized) return new Response("No autorizado", { status: 403 });

    if (status !== "approved") {
      try {
        status = (await reconcileMercadoPagoOrder(orderId, paymentId))?.status ?? status;
      } catch {
        // La descarga sigue protegida; el cliente puede reintentar cuando Mercado Pago responda.
      }
    }
    if (status !== "approved") return new Response("El pago todavía no está aprobado", { status: 402 });

    const storedItems = await getOrderItemsOrEmpty(orderId);
    const allowedPhotoIds = storedItems.length ? storedItems.map((item) => item.photoId) : [row.photoId];
    const photoId = requestedPhotoId || allowedPhotoIds[0];
    if (!photoId || !allowedPhotoIds.includes(photoId)) return new Response("Foto no incluida en esta compra", { status: 403 });

    const [photo] = await db.select({
      originalKey: photos.originalKey,
      originalName: photos.originalName,
      contentType: photos.contentType,
    }).from(photos).where(eq(photos.id, photoId)).limit(1);
    if (!photo) return new Response("La fotografía ya no está disponible", { status: 404 });

    const asset = await readStoredAsset(photo.originalKey);
    if (!asset || asset.statusCode === 304 || !asset.stream) return new Response("Archivo no encontrado", { status: 404 });
    after(async () => {
      try {
        await Promise.all([
          db.update(orders).set({ downloadCount: sql`${orders.downloadCount} + 1` }).where(eq(orders.id, orderId)),
          storedItems.length
            ? db.update(orderItems)
                .set({ downloadCount: sql`${orderItems.downloadCount} + 1` })
                .where(and(eq(orderItems.orderId, orderId), eq(orderItems.photoId, photoId)))
            : Promise.resolve(),
        ]);
      } catch {
        // El contador es informativo y nunca debe impedir una descarga ya pagada.
      }
    });
    const asciiName = safeDownloadName(photo.originalName);
    console.log(JSON.stringify({
      level: "info",
      message: "paid_download_started",
      route: "/api/download",
      requestId,
      orderIdSuffix: orderId.slice(-8),
      photoIdSuffix: photoId.slice(-8),
      size: asset.blob.size,
      disposition: openInline ? "inline" : "attachment",
      durationMs: Date.now() - startedAt,
    }));
    return new Response(asset.stream, { headers: {
      "content-type": photo.contentType || asset.blob.contentType || "application/octet-stream",
      "content-length": String(asset.blob.size),
      "content-disposition": `${openInline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(photo.originalName)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-original-content-type": photo.contentType,
    }});
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "paid_download_failed",
      route: "/api/download",
      requestId,
      orderIdSuffix: orderId.slice(-8),
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }));
    return new Response("La descarga no está disponible", { status: 503 });
  }
}
