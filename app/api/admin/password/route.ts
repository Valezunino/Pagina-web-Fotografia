import { isAdmin } from "@/lib/admin-auth";
import { getAdminEmail, saveAdminPassword, verifyAdminPassword } from "@/lib/admin-password";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado." }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;
  const currentPassword = payload?.currentPassword ?? "";
  const newPassword = payload?.newPassword ?? "";
  const email = await getAdminEmail();
  if (!email) return Response.json({ error: "El administrador no está configurado." }, { status: 503 });
  if (newPassword.length < 10) {
    return Response.json({ error: "La contraseña nueva debe tener al menos 10 caracteres." }, { status: 400 });
  }
  if (!(await verifyAdminPassword(email, currentPassword))) {
    return Response.json({ error: "La contraseña actual es incorrecta." }, { status: 403 });
  }

  try {
    await saveAdminPassword(email, newPassword);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "No pudimos guardar la contraseña nueva." }, { status: 503 });
  }
}
