import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { photos } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const rows = await getDb().select().from(photos).orderBy(asc(photos.sortOrder), desc(photos.createdAt));
    return Response.json({ photos: rows });
  } catch {
    return Response.json({ error: "La base de datos todavía no está disponible." }, { status: 503 });
  }
}
