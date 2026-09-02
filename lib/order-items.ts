import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems } from "@/db/schema";

let tableReady: Promise<void> | undefined;

/**
 * Keeps the cart rollout backwards compatible with the existing production
 * database. The checked-in migration remains the source of truth, while this
 * guard creates the additive table on the first cart request if the migration
 * has not been applied yet.
 */
export function ensureOrderItemsTable() {
  if (!tableReady) {
    tableReady = (async () => {
      const db = getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "order_items" (
          "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
          "photo_id" text NOT NULL,
          "title" text NOT NULL,
          "price_cents" integer NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "download_count" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          CONSTRAINT "order_items_order_id_photo_id_pk" PRIMARY KEY ("order_id", "photo_id")
        )
      `);
      await Promise.all([
        db.execute(sql`CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id", "sort_order")`),
        db.execute(sql`CREATE INDEX IF NOT EXISTS "order_items_photo_idx" ON "order_items" ("photo_id")`),
      ]);
    })().catch((error) => {
      tableReady = undefined;
      throw error;
    });
  }
  return tableReady;
}

export async function getOrderItems(orderId: string) {
  await ensureOrderItemsTable();
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
