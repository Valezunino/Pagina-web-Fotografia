import Link from "next/link";
import { Camera } from "lucide-react";

type BrandHomeLinkProps = {
  href?: string;
  label?: string;
  className?: string;
};

export function BrandHomeLink({
  href = "/",
  label = "Ir al inicio",
  className = "",
}: BrandHomeLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      title="Inicio"
      className={`group inline-flex min-w-0 items-center gap-2.5 ${className}`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[#c6a56d]/55 bg-[#c6a56d]/[0.07] text-[#c6a56d] transition group-hover:bg-[#c6a56d]/15">
        <Camera className="size-4.5" strokeWidth={1.6} />
      </span>
      <span className="whitespace-nowrap font-serif text-sm tracking-tight text-[#f2eee7] sm:text-lg">
        Galería<span className="hidden text-[#c6a56d] sm:inline"> Fotográfica</span>
      </span>
    </Link>
  );
}
