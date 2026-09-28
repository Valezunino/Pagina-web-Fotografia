import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { CartExperience } from "@/components/cart-experience";
import { getCurrentCustomer } from "@/lib/customer-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daniel Justiniano | Fotografía",
  description: "Galería de Daniel Justiniano. Fotografías profesionales en alta calidad, compra segura y descarga sin marca de agua.",
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
