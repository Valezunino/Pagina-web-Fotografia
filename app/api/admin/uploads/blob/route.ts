import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/lib/admin-auth";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!(await isAdmin())) throw new Error("No autorizado.");
        const payload = JSON.parse(clientPayload ?? "{}") as { uploadId?: string; kind?: string };
        if (!ID.test(payload.uploadId ?? "")) throw new Error("Carga inválida.");
        const preview = payload.kind === "preview" && pathname === `previews/${payload.uploadId}.jpg`;
        const original = payload.kind === "original" && pathname.startsWith(`originals/${payload.uploadId}/`);
        if (!preview && !original) throw new Error("Destino de carga inválido.");
        return {
          allowedContentTypes: preview ? ["image/jpeg"] : ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: preview ? 4 * 1024 * 1024 : 25 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No pudimos autorizar la carga." }, { status: 400 });
  }
}
