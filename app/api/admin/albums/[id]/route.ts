import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { albums, photos } from "@/db/schema";
import { uniqueAlbumSlug } from "@/lib/album-slug";
import { isAdmin } from "@/lib/admin-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as {
    title?: string;
    description?: string;
    published?: boolean;
  } | null;
  if (!payload) return Response.json({ error: "Datos inválidos." }, { status: 400 });

  const update: Partial<typeof albums.$inferInsert> = {};
  if (payload.title !== undefined) {
    const title = payload.title.trim();
    if (title.length < 3 || title.length > 120) {
      return Response.json({ error: "El nombre debe tener entre 3 y 120 caracteres." }, { status: 400 });
    }
    update.title = title;
    update.slug = await uniqueAlbumSlug(title, id);
  }
  if (payload.description !== undefined) {
    const description = payload.description.trim();
    if (description.length > 500) {
      return Response.json({ error: "La descripción puede tener hasta 500 caracteres." }, { status: 400 });
    }
    update.description = description;
  }
  if (typeof payload.published === "boolean") update.published = payload.published;
  if (!Object.keys(update).length) return Response.json({ error: "No hay cambios para guardar." }, { status: 400 });

  const [album] = await getDb().update(albums).set(update).where(eq(albums.id, id)).returning();
  if (!album) return Response.json({ error: "Carpeta no encontrada." }, { status: 404 });
  return Response.json({ album });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const [photoTotal] = await db.select({ value: count() }).from(photos).where(eq(photos.albumId, id));
  if ((photoTotal?.value ?? 0) > 0) {
    return Response.json({ error: "La carpeta contiene fotos. Eliminá o mové esas fotos antes de borrar la carpeta." }, { status: 409 });
  }
  const [deleted] = await db.delete(albums).where(eq(albums.id, id)).returning({ id: albums.id });
  if (!deleted) return Response.json({ error: "Carpeta no encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
