// components/inputs/NumberWithUnit.tsx
"use client";
import React, { useEffect, useState } from "react";

type Props = {
  label: string;
  name: string;
  unit?: string;
  value: number | string;
  onChange: (v: number) => void;   // sigue igual
  step?: number;
  min?: number;
};

export default function NumberWithUnit({
  label,
  name,
  unit,
  value,
  onChange,
  step = 0.01,
  min = 0,
}: Props) {
  // Estado local "raw" para permitir vacío durante la edición
  const [raw, setRaw] = useState<string>(value === 0 ? "0" : String(value ?? ""));

  // Sincronizar cuando el prop externo cambie (p.ej. reset de form)
  useEffect(() => {
    const next = value === 0 ? "0" : String(value ?? "");
    // Evita sobrescribir mientras el usuario está escribiendo lo mismo
    if (next !== raw) setRaw(next);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Normalizador a número
  const toNumber = (s: string) => {
    if (s.trim() === "") return NaN;
    return parseFloat(s.replace(",", "."));
  };

  const commit = () => {
    const n = toNumber(raw);
    const val = Number.isFinite(n) ? n : 0;
    onChange(val);
    setRaw(String(val)); // normaliza visualmente
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      (e.currentTarget as HTMLInputElement).blur(); // dispara onBlur -> commit
    } else if (e.key === "Escape") {
      // restaura el valor externo
      setRaw(value === 0 ? "0" : String(value ?? ""));
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          name={name}
          type="text"              // ← importante: permite vacío sin pelearse con el control
          inputMode="decimal"
          className="w-40 rounded border px-3 py-2"
          step={step}
          min={min}
          value={raw}
          onChange={(e) => {
            // Permitimos dígitos, coma/punto y vacío mientras escribe
            const v = e.target.value;
            if (/^-?\d*(?:[.,]\d*)?$/.test(v) || v === "") {
              setRaw(v);
              // Si ya es número válido, podemos avisar en vivo; si está vacío, no
              const n = toNumber(v);
              if (Number.isFinite(n)) onChange(n);
            }
          }}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
        {unit ? <span className="text-gray-600">{unit}</span> : null}
      </div>
    </label>
  );
}
