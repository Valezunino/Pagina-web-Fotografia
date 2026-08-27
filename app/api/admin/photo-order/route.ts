import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { photos } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const payload = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = payload?.ids?.filter((id) => typeof id === "string" && id.length > 0) ?? [];
  if (!ids.length || new Set(ids).size !== ids.length) {
    return Response.json({ error: "El orden recibido no es válido." }, { status: 400 });
  }

  const db = getDb();
  for (let index = 0; index < ids.length; index += 1) {
    await db.update(photos).set({ sortOrder: index + 1 }).where(eq(photos.id, ids[index]));
  }
  return Response.json({ ok: true });
}
