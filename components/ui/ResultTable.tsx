"use client";
import React from "react";

export type ResultRow = {
  label: string;
  qty: number | string;
  unit?: string;
  hint?: string;
};

function fmt(n: number | string) {
  if (typeof n !== "number") return n;
  // 2 decimales como default
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(n);
}

export default function ResultTable({
  items,
  title,
}: {
  items: ResultRow[];
  title?: string;
}) {
  if (!items?.length) return null;

  return (
    <div className="card p-4">
      {title ? <h2 className="font-medium mb-3">{title}</h2> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-white/10">
              <th className="py-2 pr-2">Concepto</th>
              <th className="py-2 pr-2 text-right">Cantidad</th>
              <th className="py-2 pr-2">Unidad</th>
              <th className="py-2 pr-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={`${r.label}-${i}`} className="border-b border-white/5">
                <td className="py-2 pr-2">{r.label}</td>
                <td className="py-2 pr-2 text-right">{fmt(r.qty)}</td>
                <td className="py-2 pr-2">{r.unit ?? ""}</td>
                <td className="py-2 pr-2 text-xs opacity-80">{r.hint ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
