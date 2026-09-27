"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { removeCartItems } from "@/lib/cart-store";

type PurchaseItem = {
  id: string;
  title: string;
  downloadUrl?: string;
  viewUrl?: string;
};

type PurchaseState = {
  status?: string;
  title?: string;
  itemCount?: number;
  items?: PurchaseItem[];
  downloadUrl?: string | null;
  accessToken?: string;
  error?: string;
};

type FileDownloadState = {
  status: "idle" | "downloading" | "ready" | "error";
  progress?: number;
  objectUrl?: string;
  filename?: string;
  message?: string;
};

const MAX_AUTOMATIC_CHECKS = 30;

function downloadFilename(disposition: string | null, title: string, contentType: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Continúa con el nombre seguro de respaldo.
    }
  }

  const quoted = disposition?.match(/filename="([^"]+)"/i)?.[1];
  if (quoted) return quoted;

  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${safeTitle || "fotografia-original"}.${extension}`;
}

function startBrowserDownload(objectUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function OrderStatus({
  orderId,
  initialState,
  paymentId,
  accessToken,
}: {
  orderId: string;
  initialState: string;
  paymentId?: string;
  accessToken?: string;
}) {
  const [purchase, setPurchase] = useState<PurchaseState>({ status: initialState === "aprobado" ? "pending" : initialState });
  const [verifiedAccess, setVerifiedAccess] = useState(accessToken ?? "");
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(0);
  const [fileDownloads, setFileDownloads] = useState<Record<string, FileDownloadState>>({});
  const clearedCartForOrder = useRef("");
  const requestInFlight = useRef(false);
  const checkCount = useRef(0);
  const downloadsInFlight = useRef(new Set<string>());
  const objectUrls = useRef(new Map<string, string>());

  const checkPayment = useCallback(async () => {
    if (!orderId || requestInFlight.current) return;
    requestInFlight.current = true;
    setChecking(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const query = new URLSearchParams({ order: orderId });
      if (paymentId) query.set("paymentId", paymentId);
      if (verifiedAccess) query.set("access", verifiedAccess);
      const response = await fetch(`/api/order-status?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const data = (await response.json()) as PurchaseState;
      if (response.ok) {
        setPurchase(data);
        if (data.accessToken) setVerifiedAccess(data.accessToken);
      }
      else setPurchase((current) => ({ ...current, error: data.error ?? "No pudimos verificar el pago todavía." }));
    } catch {
      setPurchase((current) => ({ ...current, error: "La conexión demoró. Vamos a volver a verificar." }));
    } finally {
      window.clearTimeout(timeout);
      requestInFlight.current = false;
      setChecking(false);
      checkCount.current += 1;
      setChecks(checkCount.current);
    }
  }, [orderId, paymentId, verifiedAccess]);

  const prepareDownload = useCallback(async (item: PurchaseItem) => {
    if (!item.downloadUrl || downloadsInFlight.current.has(item.id)) return;
    downloadsInFlight.current.add(item.id);
    setFileDownloads((current) => ({
      ...current,
      [item.id]: { status: "downloading", progress: 0 },
    }));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 300_000);
    try {
      const response = await fetch(item.downloadUrl, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`download_${response.status}`);

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const total = Number(response.headers.get("content-length") || 0);
      let blob: Blob;

      if (response.body && total > 0) {
        const reader = response.body.getReader();
        const chunks: ArrayBuffer[] = [];
        let received = 0;
        let reportedProgress = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
          received += value.byteLength;
          const progress = Math.min(99, Math.round((received / total) * 100));
          if (progress >= reportedProgress + 2 || progress === 99) {
            reportedProgress = progress;
            setFileDownloads((current) => ({
              ...current,
              [item.id]: { status: "downloading", progress },
            }));
          }
        }
        blob = new Blob(chunks, { type: contentType });
      } else {
        blob = await response.blob();
      }

      const previousUrl = objectUrls.current.get(item.id);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const objectUrl = URL.createObjectURL(blob);
      objectUrls.current.set(item.id, objectUrl);
      const filename = downloadFilename(response.headers.get("content-disposition"), item.title, contentType);
      setFileDownloads((current) => ({
        ...current,
        [item.id]: {
          status: "ready",
          progress: 100,
          objectUrl,
          filename,
          message: "Archivo listo. Si no se abrió automáticamente, tocá Guardar foto.",
        },
      }));
      startBrowserDownload(objectUrl, filename);
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "La descarga demoró demasiado. Revisá tu conexión y volvé a intentar."
        : "No pudimos preparar el archivo. Volvé a intentar; no hace falta pagar otra vez.";
      setFileDownloads((current) => ({
        ...current,
        [item.id]: { status: "error", message },
      }));
    } finally {
      window.clearTimeout(timeout);
      downloadsInFlight.current.delete(item.id);
    }
  }, []);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const objectUrl of urls.values()) URL.revokeObjectURL(objectUrl);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!orderId || purchase.status === "approved") return;
    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      await checkPayment();
      if (!cancelled && checkCount.current < MAX_AUTOMATIC_CHECKS) {
        const baseDelay = checkCount.current < 6 ? 5_000 : checkCount.current < 18 ? 10_000 : 20_000;
        const visibilityDelay = document.visibilityState === "hidden" ? 30_000 : baseDelay;
        const jitter = Math.floor(Math.random() * 1_500);
        timer = window.setTimeout(() => void run(), visibilityDelay + jitter);
      }
    };
    timer = window.setTimeout(() => void run(), 1_000 + Math.floor(Math.random() * 1_000));

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkPayment, orderId, purchase.status]);

  const approved = purchase.status === "approved";
  const failed = ["error", "rejected", "cancelled", "refunded", "charged_back", "creation_failed"].includes(purchase.status ?? "");
  const downloadItems = purchase.items?.filter((item) => item.downloadUrl) ?? [];
  const itemCount = purchase.itemCount ?? Math.max(downloadItems.length, 1);

  useEffect(() => {
    if (!approved || !purchase.items?.length || clearedCartForOrder.current === orderId) return;
    clearedCartForOrder.current = orderId;
    removeCartItems(purchase.items.map((item) => item.id));
  }, [approved, orderId, purchase.items]);

  return (
    <div className="w-full max-w-xl border border-white/10 bg-[#111] p-7 text-center sm:p-10">
      <span className={`mx-auto grid size-14 place-items-center rounded-full ${
        approved ? "bg-emerald-400/12 text-emerald-300" : failed ? "bg-red-400/12 text-red-300" : "bg-[#c6a56d]/12 text-[#c6a56d]"
      }`}>
        {approved ? <Check className="size-6" /> : failed ? <X className="size-6" /> : <LoaderCircle className="size-6 animate-spin" />}
      </span>
      <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c6a56d]">
        {approved ? "Pago aprobado" : failed ? "Pago no completado" : "Confirmando pago"}
      </p>
      <h1 className="mt-3 font-serif text-4xl">
        {approved
          ? itemCount === 1 ? "Tu foto está lista." : "Tus fotos están listas."
          : failed ? "No se realizó la compra." : "Estamos preparando tus archivos."}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/48">
        {approved
          ? itemCount === 1
            ? `${purchase.title ?? "La fotografía"} ya puede descargarse en su calidad original y sin marca de agua.`
            : `Las ${itemCount} fotografías ya pueden descargarse en calidad original y sin marca de agua.`
          : failed
            ? "Podés volver a la galería e intentar nuevamente. No se habilitó ninguna descarga."
            : checks > 5
              ? "La confirmación está demorando más de lo habitual. Podés verificar nuevamente sin volver a pagar."
              : "Mercado Pago puede demorar unos segundos en confirmar la operación. Esta pantalla se actualiza automáticamente."}
      </p>
      {purchase.error ? <p className="mt-5 text-xs text-red-300">{purchase.error}</p> : null}
      <div className="mt-8">
        {approved && downloadItems.length ? (
          <div className="mx-auto grid max-w-md gap-4 text-left">
            {downloadItems.map((item, index) => {
              const download = fileDownloads[item.id] ?? { status: "idle" as const };
              const label = downloadItems.length === 1 ? "Descargar sin marca de agua" : `${index + 1}. ${item.title}`;
              return (
                <div key={item.id} className="grid gap-1.5">
                  {download.status === "ready" && download.objectUrl && download.filename ? (
                    <Button asChild className="h-auto min-h-12 justify-between rounded-xl bg-emerald-300 px-5 py-3 text-black hover:bg-emerald-200">
                      <a href={download.objectUrl} download={download.filename}>
                        <span className="min-w-0 truncate">Guardar foto</span>
                        <Download className="size-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-auto min-h-12 justify-between rounded-xl bg-[#c6a56d] px-5 py-3 text-black hover:bg-[#d5bb90]"
                      disabled={download.status === "downloading"}
                      onClick={() => void prepareDownload(item)}
                    >
                      <span className="min-w-0 truncate">
                        {download.status === "downloading"
                          ? download.progress ? `Descargando… ${download.progress}%` : "Preparando descarga…"
                          : download.status === "error" ? "Reintentar descarga" : label}
                      </span>
                      {download.status === "downloading" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                    </Button>
                  )}
                  {download.message ? (
                    <p className={`px-1 text-center text-[11px] leading-5 ${download.status === "error" ? "text-red-300" : "text-emerald-200/75"}`}>
                      {download.message}
                    </p>
                  ) : download.status === "downloading" ? (
                    <p className="px-1 text-center text-[11px] leading-5 text-white/45">No cierres esta pantalla mientras se prepara el archivo.</p>
                  ) : item.viewUrl ? (
                    <a
                      className="justify-self-center text-[11px] text-white/48 underline decoration-white/20 underline-offset-4 hover:text-white/75"
                      href={item.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir la foto para guardarla manualmente
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : failed ? (
          <Button asChild variant="outline" className="h-12 rounded-full border-white/15 bg-white/5 px-7 text-white hover:bg-white/10">
            <Link href="/#eventos"><RotateCcw /> Volver a los eventos</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full border-white/15 bg-white/5 px-7 text-white hover:bg-white/10"
            disabled={checking}
            onClick={() => void checkPayment()}
          >
            <RotateCcw className={checking ? "animate-spin" : ""} />
            {checking ? "Verificando…" : "Verificar pago ahora"}
          </Button>
        )}
      </div>
      {approved ? (
        <div className="mt-5 space-y-3 text-[11px] leading-5 text-white/35">
          <p>{itemCount > 1 ? "Descargá cada archivo usando los botones. " : ""}En iPhone, si no aparece la descarga, usá “Abrir la foto” y luego Compartir → Guardar imagen.</p>
          <Link href="/cuenta" className="inline-flex text-[#c6a56d] underline decoration-[#c6a56d]/30 underline-offset-4 hover:text-[#d5bb90]">Crear una cuenta o ver todas mis fotos compradas</Link>
        </div>
      ) : null}
    </div>
  );
}
