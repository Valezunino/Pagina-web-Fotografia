"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLogin({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No pudimos iniciar sesión.");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1440px] place-items-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-md border border-white/10 bg-[#111] p-7 sm:p-9">
        <span className="grid size-11 place-items-center rounded-full bg-[#c6a56d]/12 text-[#c6a56d]">
          <KeyRound className="size-5" />
        </span>
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c6a56d]">Acceso privado</p>
        <h1 className="mt-3 font-serif text-4xl">Administrar galería</h1>
        <p className="mt-3 text-sm leading-6 text-white/48">
          Solo el fotógrafo autorizado puede subir originales, aplicar la marca de agua y definir precios.
        </p>
        {!configured ? (
          <p className="mt-6 border border-amber-300/20 bg-amber-300/8 p-4 text-xs leading-5 text-amber-100/75">
            El acceso está preparado, pero todavía falta configurar el email y la contraseña del fotógrafo.
          </p>
        ) : null}
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-xs text-white/70">Email</Label>
            <Input id="admin-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 border-white/15 bg-white/5" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-xs text-white/70">Contraseña</Label>
            <Input id="admin-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 border-white/15 bg-white/5" />
          </div>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <Button type="submit" disabled={loading || !configured} className="h-12 w-full bg-[#c6a56d] text-black hover:bg-[#d5bb90]">
            {loading ? <><LoaderCircle className="animate-spin" /> Ingresando</> : "Ingresar al panel"}
          </Button>
        </form>
      </div>
    </section>
  );
}
