"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type DownloadItem = {
  key: string;
  title: string;
  downloadUrl: string;
  viewUrl: string;
};

type DownloadState = {
  status: "idle" | "downloading" | "ready" | "error";
  progress?: number;
  objectUrl?: string;
  filename?: string;
  message?: string;
};

function filenameFromHeaders(disposition: string | null, title: string, contentType: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* usa el nombre alternativo */ }
  }
  const quoted = disposition?.match(/filename="([^"]+)"/i)?.[1];
  if (quoted) return quoted;
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safe = title.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return `${safe || "fotografia-original"}.${extension}`;
}

export function AccountDownloadButton({ item }: { item: DownloadItem }) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const objectUrl = useRef("");

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  async function prepare() {
    if (state.status === "downloading") return;
    setState({ status: "downloading", progress: 0 });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 300_000);
    try {
      const response = await fetch(item.downloadUrl, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error(`download_${response.status}`);
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const total = Number(response.headers.get("content-length") || 0);
      let blob: Blob;
      if (response.body && total > 0) {
        const reader = response.body.getReader();
        const chunks: ArrayBuffer[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
          received += value.byteLength;
          setState({ status: "downloading", progress: Math.min(99, Math.round((received / total) * 100)) });
        }
        blob = new Blob(chunks, { type: contentType });
      } else {
        blob = await response.blob();
      }
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      const filename = filenameFromHeaders(response.headers.get("content-disposition"), item.title, contentType);
      setState({ status: "ready", progress: 100, objectUrl: objectUrl.current, filename, message: "Archivo listo para guardar." });
      const link = document.createElement("a");
      link.href = objectUrl.current;
      link.download = filename;
      link.click();
    } catch (error) {
      setState({ status: "error", message: error instanceof Error && error.name === "AbortError" ? "La descarga demoró demasiado. Volvé a intentar." : "No pudimos preparar la foto. Volvé a intentar." });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <div className="grid gap-2">
      {state.status === "ready" && state.objectUrl && state.filename ? (
        <Button asChild className="h-11 justify-between bg-emerald-300 px-4 text-black hover:bg-emerald-200">
          <a href={state.objectUrl} download={state.filename}><span>Guardar foto</span><Download className="size-4" /></a>
        </Button>
      ) : (
        <Button type="button" onClick={() => void prepare()} disabled={state.status === "downloading"} className="h-11 justify-between bg-[#c6a56d] px-4 text-black hover:bg-[#d5bb90]">
          <span>{state.status === "downloading" ? state.progress ? `Descargando… ${state.progress}%` : "Preparando…" : state.status === "error" ? "Reintentar" : "Descargar"}</span>
          {state.status === "downloading" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
      )}
      {state.message ? <p className={`text-center text-[11px] ${state.status === "error" ? "text-red-300" : "text-emerald-200/70"}`}>{state.message}</p> : (
        <a href={item.viewUrl} target="_blank" rel="noreferrer" className="text-center text-[11px] text-white/42 underline decoration-white/20 underline-offset-4 hover:text-white/75">Abrir para guardar manualmente</a>
      )}
    </div>
  );
}
