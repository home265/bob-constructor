"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

type NavItem = { label: string; href?: string; children?: { label: string; href: string }[] };

const ITEMS: NavItem[] = [
  { label: "Muros", href: "/muros" },
  { label: "Contrapiso", href: "/contrapiso" },
  { label: "Carpeta", href: "/carpeta" },
  { label: "Revoque", href: "/revoque" },
  { label: "Revestimientos", href: "/revestimientos" },
  { label: "Boceto estructural", href: "/estructura" },
  { label: "Proyecto", href: "/proyecto" },
  {
    label: "Hormigón",
    children: [
      { label: "Base", href: "/hormigon/base" },
      { label: "Pilote", href: "/hormigon/pilote" },
      { label: "Columna", href: "/hormigon/columna" },
      { label: "Viga", href: "/hormigon/viga" },
      { label: "Losa", href: "/hormigon/losa" },
      { label: "Losa premoldeada", href: "/hormigon/losa-premoldeada" },
    ],
  },
];

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

export default function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Bloquear el scroll del body mientras el drawer móvil está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = (href?: string) =>
    !!href && (pathname === href || pathname?.startsWith(href + "/"));

  return (
      // --- CAMBIO 1: Se usa la clase .header para el fondo y borde unificado ---
      <header className="header sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-4">
          {/* Se ajusta la altura a 16 para coincidir con Gasista */}
          <div className="h-16 flex items-center justify-between">
            {/* --- CAMBIO 2: Título con el estilo de Gasista (color, tamaño y peso) --- */}
            <Link href="/" className="font-bold text-lg text-foreground hover:opacity-90">
              Bob Constructor
            </Link>

            {/* Navegación desktop */}
            {/* Se ajusta el espaciado a gap-6 para coincidir */}
            <nav className="hidden md:flex items-center gap-6">
              {ITEMS.map((it) =>
                it.children ? (
                  <Link
                    key={it.label}
                    href="/hormigon"
                    // --- CAMBIO 3: Estilo de enlace activo e inactivo igual a Gasista (subrayado) ---
                    className={cx(
                      "text-sm",
                      isActive("/hormigon")
                        ? "font-medium underline decoration-[var(--color-base)] underline-offset-4"
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {it.label}
                  </Link>
                ) : (
                  <Link
                    key={it.label}
                    href={it.href!}
                    // --- CAMBIO 3 (bis): Estilo de enlace activo e inactivo igual a Gasista (subrayado) ---
                    className={cx(
                      "text-sm",
                      isActive(it.href)
                        ? "font-medium underline decoration-[var(--color-base)] underline-offset-4"
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {it.label}
                  </Link>
                )
              )}
            </nav>

            {/* Botón hamburguesa (móvil) - No requiere cambios, ya usa .btn-secondary */}
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="btn btn-secondary px-3 py-2 md:!hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
  
        {/* Drawer móvil - La estructura y lógica se mantienen intactas. Los estilos se heredan del CSS unificado */}
        {mounted &&
          open &&
          createPortal(
            <div className="fixed inset-0 z-[1000] md:hidden">
              <div
                className="absolute inset-0 bg-black/55"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <aside
                role="dialog"
                aria-label="Menú"
                className="absolute left-0 top-0 h-full w-[min(22rem,90vw)]
                           bg-background text-foreground
                           border-r border-border shadow-2xl
                           flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/70">
                  <span className="font-semibold text-[var(--color-base)]">Menú</span>
                  <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setOpen(false)}
                    className="btn btn-ghost px-3 py-2"
                  >
                    <X size={16} />
                  </button>
                </div>
  
                <nav className="px-2 py-3 overflow-y-auto">
                  <ul className="space-y-1">
                    {ITEMS.filter((i) => !i.children).map((it) => (
                      <li key={it.label}>
                        <Link
                          href={it.href!}
                          onClick={() => setOpen(false)}
                          className={cx(
                            "block rounded px-3 py-2 text-sm bg-card/60 hover:bg-muted border border-border",
                            isActive(it.href) && "bg-muted text-[var(--color-base)]"
                          )}
                        >
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
  
                  {ITEMS.filter((i) => i.children).map((group) => (
                    <div key={group.label} className="mt-4 rounded-lg border border-border">
                      <div className="px-3 py-2 text-sm font-medium bg-muted/60">{group.label}</div>
                      <ul className="p-1 space-y-1">
                        {group.children!.map((c) => (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              onClick={() => setOpen(false)}
                              className={cx(
                                "block rounded px-3 py-2 text-sm hover:bg-muted",
                                isActive(c.href) && "bg-muted text-[var(--color-base)]"
                              )}
                            >
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
  
                <div className="mt-auto px-4 py-3 text-xs text-foreground/60 border-t border-border">
                  PWA — funciona offline
                </div>
              </aside>
            </div>,
            document.body
          )}
      </header>
    );
}
