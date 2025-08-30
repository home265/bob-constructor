// components/ui/HelpPopover.tsx
"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  children: React.ReactNode; // El texto de ayuda que quieres mostrar
};

export default function HelpPopover({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cierra el popover si se hace clic fuera de él
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popoverRef]);

  return (
    <div className="relative inline-flex" ref={popoverRef}>
      {/* El ícono de ayuda (?) que activa el popover */}
      <button 
        type="button" // <--- ¡ESTA ES LA LÍNEA CLAVE DE LA SOLUCIÓN!
        onClick={() => setIsOpen(!isOpen)}
        className="ml-2 btn btn-ghost h-6 w-6 p-0 rounded-full flex items-center justify-center"
        aria-label="Mostrar ayuda"
      >
        ?
      </button>

      {/* El contenido del popover (la ventana con el texto) */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 card border-2 border-[var(--color-base)] shadow-lg z-10"
          role="tooltip"
        >
          <div className="text-sm text-foreground/90">
            {children}
          </div>
          {/* Pequeño triángulo para apuntar al botón */}
          <div 
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid var(--color-base)',
            }}
          />
        </div>
      )}
    </div>
  );
}