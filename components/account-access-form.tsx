"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { AtSign, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountAccessForm() {
  return (
    <div className="w-full max-w-md border border-white/10 bg-[#111] p-6 sm:p-8">
      <div className="flex size-12 items-center justify-center rounded-full border border-[#c6a56d]/30 bg-[#c6a56d]/10 text-[#c6a56d]">
        <ShieldCheck className="size-6" />
      </div>
      <h2 className="mt-6 font-serif text-3xl">Ingresá de forma segura</h2>
      <p className="mt-3 text-sm leading-6 text-white/48">Elegí cómo crear tu cuenta. En ambos casos verificamos el email y guardamos tu nombre para mantener tus fotos asociadas a la persona correcta.</p>
      <SignInButton mode="modal" forceRedirectUrl="/cuenta">
        <Button type="button" className="mt-7 h-12 w-full bg-white font-semibold text-black hover:bg-white/90">
          <GoogleMark /> Continuar con Google
        </Button>
      </SignInButton>
      <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/30">
        <span className="h-px flex-1 bg-white/10" /> o <span className="h-px flex-1 bg-white/10" />
      </div>
      <SignUpButton mode="modal" forceRedirectUrl="/cuenta">
        <Button type="button" variant="outline" className="h-12 w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/8 hover:text-white">
          <AtSign /> Registrarme con email
        </Button>
      </SignUpButton>
      <p className="mt-5 text-center text-[11px] leading-5 text-white/38">El email se verifica antes de habilitar la cuenta. Tus compras aprobadas aparecerán automáticamente.</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.6 0 3 .6 4.1 1.6l3-3A10 10 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 5.9Z" />
    </svg>
  );
}
