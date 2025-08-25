// components/inputs/OpeningsGroup.tsx
"use client";
import React from "react";
import NumberWithUnit from "./NumberWithUnit";

export type OpeningVM = { lv: number; hv: number; sv?: number };

export default function OpeningsGroup({
  items,
  onChange,
}: {
  items: OpeningVM[];
  onChange: (next: OpeningVM[]) => void;
}) {
  const set = (i: number, key: keyof OpeningVM, v: number) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [key]: v } : it));
    onChange(next);
  };

  const add = () => {
    const next = [...items, { lv: 0, hv: 0 }];
    onChange(next);
  };

  const remove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Vanos</div>
        <button type="button" className="btn" onClick={add}>
          + Agregar vano
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {items.map((o, i) => (
          <div key={i} className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Vano {i + 1}</div>
              <button
                type="button"
                className="btn"
                onClick={() => remove(i)}
                aria-label={`Eliminar vano ${i + 1}`}
                title="Eliminar vano"
              >
                🗑 Eliminar
              </button>
            </div>

            <NumberWithUnit
              label="Longitud (LV)"
              name={`lv${i}`}
              unit="m"
              value={o.lv}
              onChange={(v) => set(i, "lv", v)}
            />
            <NumberWithUnit
              label="Altura (HV)"
              name={`hv${i}`}
              unit="m"
              value={o.hv}
              onChange={(v) => set(i, "hv", v)}
            />
            <NumberWithUnit
              label="Superficie (SV)"
              name={`sv${i}`}
              unit="m²"
              value={o.sv || 0}
              onChange={(v) => set(i, "sv", v)}
            />
            <p className="text-xs text-gray-500">
              * Si ingresás SV, se usa SV en vez de LV×HV.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
