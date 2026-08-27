import { cookies } from "next/headers";
import { createAdminCookie, isAdmin } from "@/lib/admin-auth";
import { getAdminEmail, saveAdminEmail, verifyAdminPassword } from "@/lib/admin-password";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newEmail?: string;
  } | null;
  const currentPassword = payload?.currentPassword ?? "";
  const newEmail = payload?.newEmail?.trim().toLowerCase() ?? "";
  const currentEmail = await getAdminEmail();
  if (!currentEmail) return Response.json({ error: "El administrador no está configurado." }, { status: 503 });
  if (!EMAIL.test(newEmail)) return Response.json({ error: "Ingresá un email válido." }, { status: 400 });
  if (!(await verifyAdminPassword(currentEmail, currentPassword))) {
    return Response.json({ error: "La contraseña actual es incorrecta." }, { status: 403 });
  }

  try {
    const email = await saveAdminEmail(currentEmail, newEmail, currentPassword);
    const adminCookie = await createAdminCookie(email);
    const store = await cookies();
    store.set(adminCookie.name, adminCookie.value, adminCookie.options);
    return Response.json({ ok: true, email });
  } catch {
    return Response.json({ error: "No pudimos guardar el nuevo email." }, { status: 503 });
  }
}
