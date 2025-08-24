"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Menú embebido para evitar problemas de imports
type NavItem = { label: string; href?: string; children?: { label: string; href: string }[] };
const ITEMS: NavItem[] = [
  { label: "Muros", href: "/muros" },
  { label: "Contrapiso", href: "/contrapiso" },
  { label: "Carpeta", href: "/carpeta" },
  { label: "Revoque", href: "/revoque" },
  { label: "Revestimientos", href: "/revestimientos" },
  { label: "Boceto estructural", href: "/estructura" },
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

  // Bloquear scroll cuando el drawer está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const isActive = (href?: string) =>
    !!href && (pathname === href || pathname?.startsWith(href + "/"));

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)]/60 bg-secondary/40 backdrop-blur supports-[backdrop-filter]:bg-secondary/30">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight text-[var(--color-base)]">
            Bob Constructor
          </Link>

          {/* Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {ITEMS.map((it) =>
              it.children ? (
                <Link
                  key={it.label}
                  href="/hormigon"
                  className={cx(
                    "text-sm rounded px-3 py-2 hover:bg-[var(--muted)]",
                    isActive("/hormigon") && "bg-[var(--muted)] text-[var(--color-base)]"
                  )}
                >
                  {it.label}
                </Link>
              ) : (
                <Link
                  key={it.label}
                  href={it.href!}
                  className={cx(
                    "text-sm rounded px-3 py-2 hover:bg-[var(--muted)]",
                    isActive(it.href) && "bg-[var(--muted)] text-[var(--color-base)]"
                  )}
                >
                  {it.label}
                </Link>
              )
            )}
          </nav>

          {/* Mobile: hamburguesa */}
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="btn btn-secondary px-3 py-2 md:!hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Drawer móvil montado en <body> para evitar stacking del header */}
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[1000] md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Panel */}
          <aside
            role="dialog"
            aria-label="Menú"
            className="absolute left-0 top-0 h-full w-[min(22rem,90vw)]
                       bg-background text-foreground
                       border-r border-[var(--color-border)] shadow-2xl
                       flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-secondary/60">
              <span className="font-semibold text-[var(--color-base)]">Menú</span>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="btn btn-ghost px-3 py-2"
              >
                ✕
              </button>
            </div>

            <nav className="px-2 py-3 overflow-y-auto">
              {/* Ítems simples */}
              <ul className="space-y-1">
                {ITEMS.filter(i => !i.children).map((it) => (
                  <li key={it.label}>
                    <Link
                      href={it.href!}
                      onClick={() => setOpen(false)}
                      className={cx(
                        "block rounded px-3 py-2 text-sm bg-card/60 hover:bg-[var(--muted)] border border-[var(--color-border)]",
                        isActive(it.href) && "bg-[var(--muted)] text-[var(--color-base)]"
                      )}
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Grupo Hormigón */}
              {ITEMS.filter(i => i.children).map((group) => (
                <div key={group.label} className="mt-4 rounded-lg border border-[var(--color-border)]">
                  <div className="px-3 py-2 text-sm font-medium bg-[var(--muted)]/60">
                    {group.label}
                  </div>
                  <ul className="p-1 space-y-1">
                    {group.children!.map((c) => (
                      <li key={c.href}>
                        <Link
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className={cx(
                            "block rounded px-3 py-2 text-sm hover:bg-[var(--muted)]",
                            isActive(c.href) && "bg-[var(--muted)] text-[var(--color-base)]"
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

            <div className="mt-auto px-4 py-3 text-xs text-foreground/60 border-t border-[var(--color-border)]">
              PWA — funciona offline
            </div>
          </aside>
        </div>,
        document.body
      )}
    </header>
  );
}
