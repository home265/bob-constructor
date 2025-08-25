// components/inputs/NumberWithUnit.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";

type Props = {
  label: string;
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
  // estado local para permitir vacío
  const [raw, setRaw] = useState<string>(value === 0 ? "0" : String(value ?? ""));

  // regex depende de si se permiten negativos o no
  const reInput = useMemo(
    () => (min < 0 ? /^-?\d*(?:[.,]\d*)?$/ : /^\d*(?:[.,]\d*)?$/),
    [min]
  );

  // sync cuando cambia value externo
  useEffect(() => {
    const next = value === 0 ? "0" : String(value ?? "");
    if (next !== raw) setRaw(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const toNumber = (s: string) => {
    if (s.trim() === "") return NaN;
    return parseFloat(s.replace(",", "."));
  };

  // Redondeo opcional al step (simple)
  const roundToStep = (n: number) => {
    if (!step || step <= 0) return n;
    const inv = 1 / step;
    return Math.round(n * inv) / inv;
  };

  const commit = () => {
    let n = toNumber(raw);
    // si no es número, caer al valor externo (o 0)
    if (!Number.isFinite(n)) n = typeof value === "number" ? value : 0;
    // clamping al mínimo
    if (typeof min === "number" && n < min) n = min;
    const val = roundToStep(n);
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

  const liveNumber = toNumber(raw);
  const isLiveBelowMin = Number.isFinite(liveNumber) && typeof min === "number" && liveNumber < min;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          name={name}
          type="text"              // permite vacío sin pelearse con el control
          inputMode="decimal"
          className="w-40 rounded border px-3 py-2"
          step={step}
          min={min}
          value={raw}
          aria-invalid={isLiveBelowMin || undefined}
          title={isLiveBelowMin ? `Mínimo: ${min}` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            // Permitimos dígitos y coma/punto; si min>=0, bloquea "-"
            if (reInput.test(v) || v === "") {
              setRaw(v);
              // si ya es número válido y no viola min, avisamos en vivo
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
