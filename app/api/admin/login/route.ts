import { cookies } from "next/headers";
import { adminConfigured, createAdminCookie } from "@/lib/admin-auth";
import { getAdminEmail, verifyAdminPassword } from "@/lib/admin-password";

export async function POST(request: Request) {
  if (!(await adminConfigured())) {
    return Response.json({ error: "El acceso del fotógrafo todavía no está configurado." }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = payload?.email?.trim().toLowerCase() ?? "";
  const password = payload?.password ?? "";
  const activeEmail = await getAdminEmail();
  if (!activeEmail || email !== activeEmail || !(await verifyAdminPassword(email, password))) {
    return Response.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  const adminCookie = await createAdminCookie(email);
  const store = await cookies();
  store.set(adminCookie.name, adminCookie.value, adminCookie.options);
  return Response.json({ ok: true });
}
