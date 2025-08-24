"use client";
import React from "react";

type Props = {
  label: string;
  name: string;
  unit?: string;
  value: number | string;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
};

export default function NumberWithUnit({ label, name, unit, value, onChange, step = 0.01, min = 0 }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          name={name}
          type="number"
          inputMode="decimal"
          className="w-40 rounded border px-3 py-2"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        />
        {unit ? <span className="text-gray-600">{unit}</span> : null}
      </div>
    </label>
  );
}
