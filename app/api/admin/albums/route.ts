import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { albums } from "@/db/schema";
import { uniqueAlbumSlug } from "@/lib/album-slug";
import { isAdmin } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const rows = await getDb().select().from(albums).orderBy(asc(albums.sortOrder), desc(albums.createdAt));
    return Response.json({ albums: rows });
  } catch {
    return Response.json({ error: "La base de datos todavía no está disponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const payload = (await request.json().catch(() => null)) as { title?: string; description?: string } | null;
  const title = payload?.title?.trim() ?? "";
  const description = payload?.description?.trim() ?? "";
  if (title.length < 3 || title.length > 120) {
    return Response.json({ error: "El nombre debe tener entre 3 y 120 caracteres." }, { status: 400 });
  }
  if (description.length > 500) {
    return Response.json({ error: "La descripción puede tener hasta 500 caracteres." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const slug = await uniqueAlbumSlug(title);
  const [album] = await getDb().insert(albums).values({
    id,
    slug,
    title,
    description,
    published: true,
    sortOrder: Math.floor(Date.now() / 1000),
  }).returning();
  return Response.json({ album }, { status: 201 });
}
