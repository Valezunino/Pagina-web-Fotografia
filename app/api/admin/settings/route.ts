import { getDb } from "@/db";
import { siteSettings } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { DEFAULT_SITE_SETTINGS, type EditableSiteSettings } from "@/lib/site-settings";

const KEYS = Object.keys(DEFAULT_SITE_SETTINGS) as (keyof EditableSiteSettings)[];

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });
  const payload = (await request.json().catch(() => null)) as Partial<EditableSiteSettings> | null;
  if (!payload) return Response.json({ error: "Datos inválidos." }, { status: 400 });

  const entries = KEYS.map((key) => [key, String(payload[key] ?? "").trim()] as const);
  if (entries.some(([, value]) => !value || value.length > 500)) {
    return Response.json({ error: "Completá todos los textos. El máximo es de 500 caracteres." }, { status: 400 });
  }

  try {
    const db = getDb();
    for (const [key, value] of entries) {
      await db
        .insert(siteSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value, updatedAt: new Date() },
        });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "No pudimos guardar los cambios del sitio." }, { status: 503 });
  }
}
