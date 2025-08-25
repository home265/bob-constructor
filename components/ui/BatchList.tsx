// components/ui/BatchList.tsx
"use client";

import type { MaterialRow } from "@/lib/project/types";

export type BatchListItem = {
  title: string;
  subtitle?: string;   // ej.: "Área 12.8 m² — Vanos: 3"
  materials?: MaterialRow[]; // opcional, por si querés mostrar un micro-resumen
};

type Props = {
  items: BatchListItem[];
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
  emptyText?: string;
};

export default function BatchList({
  items,
  onEdit,
  onRemove,
  emptyText = "No hay ítems en el lote.",
}: Props) {
  if (!items?.length) {
    return <div className="card p-4 text-sm text-gray-600">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="card p-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{it.title}</div>
            {it.subtitle ? (
              <div className="text-xs text-gray-600 mt-1">{it.subtitle}</div>
            ) : null}
            {/* Mini-resumen de materiales (opcional):
            <div className="text-xs text-gray-500 mt-1">
              {it.materials?.slice(0, 3).map(m => `${m.label}: ${m.qty} ${m.unit}`).join(" · ")}
              {it.materials && it.materials.length > 3 ? " · …" : ""}
            </div>
            */}
          </div>

          <div className="flex gap-2 shrink-0">
            {onEdit ? (
              <button className="btn" onClick={() => onEdit(i)}>
                Editar
              </button>
            ) : null}
            {onRemove ? (
              <button className="btn" onClick={() => onRemove(i)}>
                Quitar
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
