import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems } from "@/db/schema";

export async function getOrderItems(orderId: string) {
  return getDb()
    .select({
      photoId: orderItems.photoId,
      title: orderItems.title,
      priceCents: orderItems.priceCents,
      downloadCount: orderItems.downloadCount,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.sortOrder));
}

export async function getOrderItemsOrEmpty(orderId: string) {
  try {
    return await getOrderItems(orderId);
  } catch {
    // Las compras individuales anteriores al carrito siguen funcionando aunque
    // la tabla aditiva todavía no se haya creado en una base existente.
    return [];
  }
}
