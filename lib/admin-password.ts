import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminCredentials } from "@/db/schema";
import { requireRuntimeValue, runtime } from "@/lib/runtime";
import { hmac, safeEqual, sha256 } from "@/lib/security";

async function passwordHash(password: string) {
  return hmac(password, requireRuntimeValue("SESSION_SECRET"));
}

export async function verifyAdminPassword(email: string, password: string) {
  try {
    const [credential] = await getDb()
      .select({ passwordHash: adminCredentials.passwordHash })
      .from(adminCredentials)
      .where(eq(adminCredentials.email, email.toLowerCase()))
      .limit(1);
    if (credential) {
      return safeEqual(await passwordHash(password), credential.passwordHash);
    }
  } catch {
    // Before the credentials migration is available, use the private bootstrap password.
  }

  const bootstrap = runtime().ADMIN_PASSWORD;
  if (!bootstrap) return false;
  const [providedHash, expectedHash] = await Promise.all([sha256(password), sha256(bootstrap)]);
  return safeEqual(providedHash, expectedHash);
}

export async function saveAdminPassword(email: string, password: string) {
  const hash = await passwordHash(password);
  await getDb()
    .insert(adminCredentials)
    .values({
      email: email.toLowerCase(),
      passwordHash: hash,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminCredentials.email,
      set: { passwordHash: hash, updatedAt: new Date() },
    });
}
