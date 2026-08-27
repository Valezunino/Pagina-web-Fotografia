import { del, get } from "@vercel/blob";

export async function readStoredAsset(pathname: string) {
  return get(pathname, { access: "private" });
}

export async function deleteStoredAsset(pathname: string) {
  await del(pathname);
}
