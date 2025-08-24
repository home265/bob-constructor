import "./globals.css";
import RegisterSW from "./register-sw";
import AppHeader from "@/components/layout/AppHeader";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Bob Constructor",
  description: "Cómputo de materiales - PWA",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2C3333", // <- acá ahora
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <RegisterSW />
        <AppHeader />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </body>
    </html>
  );
}
