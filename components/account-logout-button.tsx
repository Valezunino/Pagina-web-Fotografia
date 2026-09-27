"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountLogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    router.refresh();
  }
  return <Button type="button" variant="ghost" onClick={() => void logout()} className="text-white/55 hover:bg-white/5 hover:text-white"><LogOut /> Salir</Button>;
}
