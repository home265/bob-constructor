"use client";
import { useState, useMemo } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore – desacoplado de la firma exacta
import * as C from "@/lib/calc/contrapiso";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";


type CptoOptions = {
  tipos?: { key?: string; label?: string }[];
  mallas?: { key?: string; label?: string }[];
};
type CptoCoeffs = Record<string, any>;

export default function ContrapisoPage() {
  // opciones & coeficientes desde JSON (con fallback)
  const options = useJson<CptoOptions>("/data/contrapiso_options.json", {
    tipos: [
      { key: "cascote_terreno", label: "Cascote sobre terreno" },
      { key: "cascote_losa", label: "Cascote sobre losa" },
      { key: "armado", label: "Contrapiso armado" },
    ],
    mallas: [{ key: "sima_q188", label: "SIMA Q-188 (15x15 Ø6)" }],
  });
  const coeffs = useJson<CptoCoeffs>("/data/contrapiso_coeffs.json", {});

  // normalizo arrays (garantizo key/label siempre)
  const tipos = useMemo(
    () =>
      Array.isArray(options.tipos)
        ? options.tipos.map((t, i) => ({
            key: t?.key ?? `tipo_${i}`,
            label: t?.label ?? `Opción ${i + 1}`,
          }))
        : [],
    [options.tipos]
  );

  const mallas = useMemo(
    () =>
      Array.isArray(options.mallas)
        ? options.mallas.map((m, i) => ({
            key: m?.key ?? `malla_${i}`,
            label: m?.label ?? `Malla ${i + 1}`,
          }))
        : [],
    [options.mallas]
  );

  // inputs básicos
  const [tipo, setTipo] = useState(tipos[0]?.key ?? "tipo_0");
  const [L, setL] = useState(4); // m
  const [A, setA] = useState(3); // m
  const [H, setH] = useState(8); // cm
  const [malla, setMalla] = useState(mallas[0]?.key ?? "");
  const [waste, setWaste] = useState(10); // %

  // si cambia el JSON y no existe la key actual, vuelvo al primer item
  if (tipos.length && !tipos.find((t) => t.key === tipo)) {
    setTipo(tipos[0].key);
  }
  if (mallas.length && malla && !mallas.find((m) => m.key === malla)) {
    setMalla(mallas[0].key);
  }

  const onCalc = () => {
    const input = { tipo, L, A, Hcm: H, malla, wastePct: waste, coeffs };
    // @ts-ignore
    const res = (C.calcContrapiso ?? C.default ?? ((x: any) => x))(input);
    return res;
  };

  const r = onCalc();

  return (
  <section className="space-y-6">
    <h1 className="text-2xl font-semibold">Contrapiso</h1>

    <div className="grid md:grid-cols-2 gap-4">
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2"
            >
              {tipos.map((t, i) => (
                <option key={`${t.key}-${i}`} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Largo (m)
            <input
              type="number"
              value={L}
              onChange={(e) => setL(+e.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>

          <label className="text-sm">
            Ancho (m)
            <input
              type="number"
              value={A}
              onChange={(e) => setA(+e.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>

          <label className="text-sm col-span-2">
            Espesor (cm)
            <input
              type="number"
              value={H}
              onChange={(e) => setH(+e.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>

          {!!mallas.length && (
            <label className="text-sm col-span-2">
              Malla SIMA
              <select
                value={malla}
                onChange={(e) => setMalla(e.target.value)}
                className="w-full px-3 py-2"
              >
                <option key="malla_none" value="">
                  — Sin malla —
                </option>
                {mallas.map((m, i) => (
                  <option key={`${m.key}-${i}`} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm col-span-2">
            Desperdicio (%)
            <input
              type="number"
              value={waste}
              onChange={(e) => setWaste(+e.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>
        </div>
      </div>

      <ResultTable
        title="Resultado"
        items={(function () {
          const out: any[] = [];
          if (r?.area_m2 != null) out.push({ label: "Área", qty: r.area_m2, unit: "m²" });
          if (r?.espesor_cm != null) out.push({ label: "Espesor", qty: r.espesor_cm, unit: "cm" });

          const vol = r?.volumen_con_desperdicio_m3 ?? r?.volumen_m3;
          if (vol != null) out.push({ label: "Volumen", qty: vol, unit: "m³", hint: "Con desperdicio" });

          if (r?.malla_m2) out.push({ label: "Malla SIMA", qty: r.malla_m2, unit: "m²" });

          if (r?.materiales && typeof r.materiales === "object") {
            for (const [k, v] of Object.entries(r.materiales)) {
              out.push({ label: keyToLabel(k), qty: Number(v) || 0, unit: keyToUnit(k) });
            }
          }
          return out;
        })()}
      />
    </div>
  </section>
);

}
