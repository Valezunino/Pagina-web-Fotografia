"use client";

import { FormEvent, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { LoaderCircle, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountNameForm({ initialFirstName = "", initialLastName = "" }: { initialFirstName?: string; initialLastName?: string }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || loading) return;
    setLoading(true);
    setMessage("");
    try {
      await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      router.refresh();
    } catch {
      setMessage("No pudimos guardar tu nombre. Revisá los datos e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md border border-white/10 bg-[#111] p-6 sm:p-8">
      <UserRoundCheck className="size-7 text-[#c6a56d]" />
      <h2 className="mt-5 font-serif text-3xl">Completá tu nombre</h2>
      <p className="mt-3 text-sm leading-6 text-white/48">Lo usamos para identificar tu cuenta y registrar correctamente tus compras.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-first-name">Nombre</Label>
          <Input id="account-first-name" required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="h-12 border-white/15 bg-white/5" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-last-name">Apellido</Label>
          <Input id="account-last-name" required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="h-12 border-white/15 bg-white/5" />
        </div>
      </div>
      {message ? <p className="mt-4 text-xs leading-5 text-red-200">{message}</p> : null}
      <Button type="submit" disabled={!isLoaded || loading} className="mt-6 h-12 w-full bg-[#c6a56d] font-semibold text-black hover:bg-[#d5bb90]">
        {loading ? <><LoaderCircle className="animate-spin" /> Guardando…</> : "Guardar y ver mis fotos"}
      </Button>
    </form>
  );
}
