import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminCredentials, siteSettings } from "@/db/schema";
import { requireRuntimeValue, runtime } from "@/lib/runtime";
import { hmac, safeEqual, sha256 } from "@/lib/security";

const ADMIN_EMAIL_KEY = "admin_email";

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

  const { ADMIN_EMAIL, ADMIN_PASSWORD: bootstrap } = runtime();
  if (!bootstrap || email.toLowerCase() !== ADMIN_EMAIL?.trim().toLowerCase()) return false;
  const [providedHash, expectedHash] = await Promise.all([sha256(password), sha256(bootstrap)]);
  return safeEqual(providedHash, expectedHash);
}

export async function getAdminEmail() {
  try {
    const [setting] = await getDb()
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, ADMIN_EMAIL_KEY))
      .limit(1);
    if (setting?.value.trim()) return setting.value.trim().toLowerCase();
  } catch {
    // Use the private bootstrap email until the database is available.
  }
  return runtime().ADMIN_EMAIL?.trim().toLowerCase() ?? null;
}

export async function adminAccessConfigured() {
  if (!runtime().SESSION_SECRET) return false;
  const email = await getAdminEmail();
  if (!email) return false;
  try {
    const [credential] = await getDb()
      .select({ email: adminCredentials.email })
      .from(adminCredentials)
      .where(eq(adminCredentials.email, email))
      .limit(1);
    if (credential) return true;
  } catch {
    // The bootstrap credentials remain available while the database is unavailable.
  }
  return Boolean(runtime().ADMIN_PASSWORD && email === runtime().ADMIN_EMAIL?.trim().toLowerCase());
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

export async function saveAdminEmail(currentEmail: string, newEmail: string, currentPassword: string) {
  const normalizedCurrent = currentEmail.trim().toLowerCase();
  const normalizedNew = newEmail.trim().toLowerCase();
  const hash = await passwordHash(currentPassword);
  await getDb().transaction(async (transaction) => {
    await transaction
      .insert(adminCredentials)
      .values({ email: normalizedNew, passwordHash: hash, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminCredentials.email,
        set: { passwordHash: hash, updatedAt: new Date() },
      });
    if (normalizedCurrent !== normalizedNew) {
      await transaction.delete(adminCredentials).where(eq(adminCredentials.email, normalizedCurrent));
    }
    await transaction
      .insert(siteSettings)
      .values({ key: ADMIN_EMAIL_KEY, value: normalizedNew, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: normalizedNew, updatedAt: new Date() },
      });
  });
  return normalizedNew;
}
