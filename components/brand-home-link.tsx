import Link from "next/link";

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
      className={`group inline-flex items-center ${className}`}
    >
      <img
        src="/brand/daniel-fotografia-color.png"
        alt=""
        aria-hidden="true"
        className="h-10 w-auto object-contain transition duration-300 group-hover:brightness-110 group-hover:drop-shadow-[0_0_12px_rgba(34,197,94,0.22)] sm:h-11"
      />
      <span className="sr-only">Inicio</span>
    </Link>
  );
}
