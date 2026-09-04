"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { removeCartItems } from "@/lib/cart-store";

type PurchaseState = {
  status?: string;
  title?: string;
  itemCount?: number;
  items?: Array<{ id: string; title: string; downloadUrl?: string; viewUrl?: string }>;
  downloadUrl?: string | null;
  accessToken?: string;
  error?: string;
};

const MAX_AUTOMATIC_CHECKS = 30;

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
  const clearedCartForOrder = useRef("");
  const requestInFlight = useRef(false);
  const checkCount = useRef(0);

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
          <div className="mx-auto grid max-w-md gap-3 text-left">
            {downloadItems.map((item, index) => (
              <div key={item.id} className="grid gap-1.5">
                <Button asChild className="h-auto min-h-12 justify-between rounded-xl bg-[#c6a56d] px-5 py-3 text-black hover:bg-[#d5bb90]">
                  <a href={item.downloadUrl} download>
                    <span className="min-w-0 truncate">{downloadItems.length === 1 ? "Descargar sin marca de agua" : `${index + 1}. ${item.title}`}</span>
                    <Download className="size-4" />
                  </a>
                </Button>
                {item.viewUrl ? (
                  <a
                    className="justify-self-center text-[11px] text-white/48 underline decoration-white/20 underline-offset-4 hover:text-white/75"
                    href={item.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Si no se descarga, abrir archivo
                  </a>
                ) : null}
              </div>
            ))}
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
        <p className="mt-4 text-[11px] leading-5 text-white/35">
          {itemCount > 1 ? "Descargá cada archivo usando los botones. " : ""}En iPhone, se guardan en Archivos → Descargas.
        </p>
      ) : null}
    </div>
  );
}
