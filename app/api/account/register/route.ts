import { getDb } from "@/db";
import { customerAccounts } from "@/db/schema";
import {
  createCustomerSession,
  ensureCustomerAccountsTable,
  hashCustomerPassword,
  normalizeCustomerEmail,
  validCustomerEmail,
} from "@/lib/customer-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = normalizeCustomerEmail(payload?.email ?? "");
  const password = payload?.password ?? "";
  if (!validCustomerEmail(email)) return Response.json({ error: "Ingresá un email válido." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  if (password.length > 128) return Response.json({ error: "La contraseña es demasiado larga." }, { status: 400 });

  try {
    await ensureCustomerAccountsTable();
    const account = { id: crypto.randomUUID(), email };
    await getDb().insert(customerAccounts).values({
      ...account,
      passwordHash: await hashCustomerPassword(password),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createCustomerSession(account);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("customer_accounts_email_unique") || message.includes("duplicate key")) {
      return Response.json({ error: "Ya existe una cuenta con ese email. Iniciá sesión." }, { status: 409 });
    }
    return Response.json({ error: "No pudimos crear la cuenta. Intentá nuevamente." }, { status: 503 });
  }
}
