"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccountLogoutButton() {
  return (
    <SignOutButton redirectUrl="/cuenta">
      <Button type="button" variant="ghost" className="text-white/55 hover:bg-white/5 hover:text-white"><LogOut /> Salir</Button>
    </SignOutButton>
  );
}
