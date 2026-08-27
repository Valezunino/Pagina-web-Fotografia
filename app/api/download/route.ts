import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, photos } from "@/db/schema";
import { verifyOrderCookie } from "@/lib/order-auth";
import { readStoredAsset } from "@/lib/stored-assets";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order") ?? "";
  if (!orderId) return new Response("Compra no encontrada", { status: 400 });
  try {
    const db = getDb();
    const [row] = await db.select({
      status: orders.status, claimHash: orders.claimHash, originalKey: photos.originalKey,
      originalName: photos.originalName, contentType: photos.contentType,
    }).from(orders).innerJoin(photos, eq(photos.id, orders.photoId)).where(eq(orders.id, orderId)).limit(1);
    if (!row || !(await verifyOrderCookie(orderId, row.claimHash))) return new Response("No autorizado", { status: 403 });
    if (row.status !== "approved") return new Response("El pago todavía no está aprobado", { status: 402 });
    const asset = await readStoredAsset(row.originalKey);
    if (!asset || asset.statusCode === 304 || !asset.stream) return new Response("Archivo no encontrado", { status: 404 });
    await db.update(orders).set({ downloadCount: sql`${orders.downloadCount} + 1` }).where(eq(orders.id, orderId));
    return new Response(asset.stream, { headers: {
      "content-type": row.contentType,
      "content-length": String(asset.blob.size),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    }});
  } catch {
    return new Response("La descarga no está disponible", { status: 503 });
  }
}
