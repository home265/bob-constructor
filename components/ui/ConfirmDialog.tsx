// components/ui/ConfirmDialog.tsx
"use client";
import { useEffect } from "react";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Confirmar",
  message = "¿Estás seguro?",
  confirmLabel = "Sí",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    // Fondo oscuro semi-transparente (este estaba bien)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      
      {/* Contenedor del modal.
        ANTES: className="bg-white rounded-lg p-4 w-[min(92vw,420px)] shadow-lg"
        AHORA: Usamos tu clase "card" para que tome el estilo oscuro y ajustamos el padding.
      */}
      <div className="card p-6 rounded-lg w-[min(92vw,420px)] shadow-xl">
        
        {/* Título: Le agregamos un color de texto para que sea visible en fondo oscuro */}
        <h3 className="text-lg font-medium mb-2 text-foreground">{title}</h3>
        
        {/* Mensaje (este estaba bien con text-foreground/70) */}
        <p className="text-sm text-foreground/70 mb-4">{message}</p>
        
        {/* Botones (estos ya tenían las clases correctas) */}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}