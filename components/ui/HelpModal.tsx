// components/ui/HelpModal.tsx
"use client";

// Le pasamos dos cosas: si debe mostrarse (isOpen) y qué hacer al cerrar (onClose)
type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export default function HelpModal({ isOpen, onClose, title, children }: Props) {
  // Si no está abierto, no renderiza nada
  if (!isOpen) {
    return null;
  }

  return (
    // Contenedor principal que oscurece el fondo
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* El 'card' del modal */}
      <div className="card m-4 w-full max-w-lg p-6 space-y-4 border-2 border-border animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-base)]">{title}</h2>
          <button 
            onClick={onClose} 
            className="btn btn-ghost p-2 h-auto"
            aria-label="Cerrar"
          >
            {/* Un ícono de 'X' simple para cerrar */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        {/* Aquí se mostrará el contenido (el texto de ayuda) */}
        <div className="text-sm text-foreground/80 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}