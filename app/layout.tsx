import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { CartExperience } from "@/components/cart-experience";
import { getCurrentCustomer } from "@/lib/customer-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Galería Fotográfica | Fotos de eventos",
  description: "Galería de fotografía profesional. Elegí fotos de tus eventos, comprá de forma segura y descargá tus imágenes originales en alta calidad.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const customer = await getCurrentCustomer();
  return (
    <html lang="es">
      <body className="antialiased">
        <ClerkProvider>
          {children}
          <CartExperience initialEmail={customer?.eligible ? customer.email : ""} />
        </ClerkProvider>
      </body>
    </html>
  );
}
