import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { albums, orderItems, orders, photos } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { deleteStoredAsset } from "@/lib/stored-assets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as {
    title?: string;
    category?: string;
    price?: number;
    published?: boolean;
    albumId?: string;
  } | null;
  if (!payload) return Response.json({ error: "Datos inválidos." }, { status: 400 });

  const title = payload.title?.trim();
  const category = payload.category?.trim();
  const price = payload.price;
  const albumId = payload.albumId?.trim();
  if (title !== undefined && !title) return Response.json({ error: "El título no puede quedar vacío." }, { status: 400 });
  if (category !== undefined && !category) return Response.json({ error: "La categoría no puede quedar vacía." }, { status: 400 });
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
    return Response.json({ error: "Ingresá un precio válido." }, { status: 400 });
  }
  if (albumId !== undefined) {
    if (!albumId) return Response.json({ error: "Elegí una carpeta válida." }, { status: 400 });
    const [album] = await getDb().select({ id: albums.id }).from(albums).where(eq(albums.id, albumId)).limit(1);
    if (!album) return Response.json({ error: "La carpeta seleccionada no existe." }, { status: 400 });
  }

  const update: Partial<typeof photos.$inferInsert> = {};
  if (title !== undefined) update.title = title;
  if (category !== undefined) update.category = category;
  if (price !== undefined) update.priceCents = Math.round(price * 100);
  if (typeof payload.published === "boolean") update.published = payload.published;
  if (albumId !== undefined) update.albumId = albumId;
  if (!Object.keys(update).length) return Response.json({ error: "No hay cambios para guardar." }, { status: 400 });

  await getDb().update(photos).set(update).where(eq(photos.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const [photo] = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
  if (!photo) return Response.json({ error: "Foto no encontrada." }, { status: 404 });

  try {
    await db.delete(orderItems).where(eq(orderItems.photoId, id));
  } catch {
    // La eliminación de una foto anterior al carrito no depende de esta tabla aditiva.
  }
  await db.transaction(async (transaction) => {
    await transaction.delete(orders).where(eq(orders.photoId, id));
    await transaction.delete(photos).where(eq(photos.id, id));
  });
  await Promise.all([
    deleteStoredAsset(photo.previewKey),
    deleteStoredAsset(photo.originalKey),
  ]);
  return Response.json({ ok: true });
}
