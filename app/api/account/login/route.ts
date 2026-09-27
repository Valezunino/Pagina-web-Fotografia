import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customerAccounts } from "@/db/schema";
import {
  createCustomerSession,
  ensureCustomerAccountsTable,
  normalizeCustomerEmail,
  validCustomerEmail,
  verifyCustomerPassword,
} from "@/lib/customer-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = normalizeCustomerEmail(payload?.email ?? "");
  const password = payload?.password ?? "";
  if (!validCustomerEmail(email) || !password) {
    return Response.json({ error: "Completá tu email y contraseña." }, { status: 400 });
  }

  try {
    await ensureCustomerAccountsTable();
    const [account] = await getDb()
      .select({ id: customerAccounts.id, email: customerAccounts.email, passwordHash: customerAccounts.passwordHash })
      .from(customerAccounts)
      .where(eq(customerAccounts.email, email))
      .limit(1);
    if (!account || !(await verifyCustomerPassword(password, account.passwordHash))) {
      return Response.json({ error: "El email o la contraseña no son correctos." }, { status: 401 });
    }
    await createCustomerSession(account);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "No pudimos iniciar sesión. Intentá nuevamente." }, { status: 503 });
  }
}
