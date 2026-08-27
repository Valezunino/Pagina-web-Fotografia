export type RuntimeBindings = {
  DATABASE_URL?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADO_PAGO_WEBHOOK_SECRET?: string;
  PUBLIC_BASE_URL?: string;
};

export function runtime(): RuntimeBindings {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
    MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  };
}

export function requireRuntimeValue(key: keyof RuntimeBindings) {
  const value = runtime()[key];
  if (!value?.trim()) throw new Error(`Falta configurar ${key}.`);
  return value.trim();
}
