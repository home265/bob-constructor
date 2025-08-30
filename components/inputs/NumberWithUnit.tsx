// components/inputs/NumberWithUnit.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";

type Props = {
  // --- ESTA ES LA ÚNICA LÍNEA LÓGICA QUE CAMBIA ---
  // Se cambia 'string' por 'React.ReactNode' para permitir componentes como el popover.
  label: React.ReactNode;
  name: string;
  unit?: string;
  value: number | string;
  onChange: (v: number) => void;
  step?: number;
  min?: number; // por defecto 0 = no negativos
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
  // --- TODA TU LÓGICA DE ESTADO Y FUNCIONES PERMANECE 100% INTACTA ---
  const [raw, setRaw] = useState<string>(value === 0 ? "0" : String(value ?? ""));

  const reInput = useMemo(
    () => (min < 0 ? /^-?\d*(?:[.,]\d*)?$/ : /^\d*(?:[.,]\d*)?$/),
    [min]
  );

  useEffect(() => {
    const next = value === 0 ? "0" : String(value ?? "");
    if (next !== raw) setRaw(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const toNumber = (s: string) => {
    if (s.trim() === "") return NaN;
    return parseFloat(s.replace(",", "."));
  };

  const roundToStep = (n: number) => {
    if (!step || step <= 0) return n;
    const inv = 1 / step;
    return Math.round(n * inv) / inv;
  };

  const commit = () => {
    let n = toNumber(raw);
    if (!Number.isFinite(n)) n = typeof value === "number" ? value : 0;
    if (typeof min === "number" && n < min) n = min;
    const val = roundToStep(n);
    onChange(val);
    setRaw(String(val));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setRaw(value === 0 ? "0" : String(value ?? ""));
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  const liveNumber = toNumber(raw);
  const isLiveBelowMin = Number.isFinite(liveNumber) && typeof min === "number" && liveNumber < min;

  return (
    <label className="flex flex-col gap-1 text-sm">
      {/* Pequeño ajuste visual para alinear el texto con el ícono de ayuda */}
      <span className="font-medium flex items-center">{label}</span>
      <div className="flex items-center gap-2">
        <input
          name={name}
          type="text"
          inputMode="decimal"
          className="w-40 rounded border px-3 py-2"
          step={step}
          min={min}
          value={raw}
          aria-invalid={isLiveBelowMin || undefined}
          title={isLiveBelowMin ? `Mínimo: ${min}` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (reInput.test(v) || v === "") {
              setRaw(v);
              const n = toNumber(v);
              if (Number.isFinite(n) && !(typeof min === "number" && n < min)) {
                onChange(n);
              }
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