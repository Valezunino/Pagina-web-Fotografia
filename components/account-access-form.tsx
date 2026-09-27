"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountAccessForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/account/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No pudimos completar el acceso.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos completar el acceso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md border border-white/10 bg-[#111] p-6 sm:p-8">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
        <button type="button" onClick={() => { setMode("login"); setMessage(""); }} className={`rounded-lg px-4 py-3 text-xs font-semibold transition ${mode === "login" ? "bg-[#c6a56d] text-black" : "text-white/55 hover:text-white"}`}>Ingresar</button>
        <button type="button" onClick={() => { setMode("register"); setMessage(""); }} className={`rounded-lg px-4 py-3 text-xs font-semibold transition ${mode === "register" ? "bg-[#c6a56d] text-black" : "text-white/55 hover:text-white"}`}>Crear cuenta</button>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="customer-email" className="text-xs text-white/72">Email usado en tus compras</Label>
          <Input id="customer-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" className="h-12 border-white/15 bg-white/5" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-password" className="text-xs text-white/72">Contraseña</Label>
          <Input id="customer-password" type="password" required minLength={8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" className="h-12 border-white/15 bg-white/5" />
        </div>
        {message ? <p className="rounded-lg border border-red-300/20 bg-red-400/8 p-3 text-xs leading-5 text-red-200">{message}</p> : null}
        <Button type="submit" disabled={loading} className="h-12 w-full bg-[#c6a56d] font-semibold text-black hover:bg-[#d5bb90]">
          {loading ? <><LoaderCircle className="animate-spin" /> Procesando…</> : mode === "login" ? <><LockKeyhole /> Iniciar sesión</> : <><UserRoundPlus /> Crear mi cuenta</>}
        </Button>
      </form>
      <p className="mt-5 text-center text-[11px] leading-5 text-white/38">Usá el mismo email con el que pagaste. Las compras anteriores aprobadas aparecerán automáticamente.</p>
    </div>
  );
}
