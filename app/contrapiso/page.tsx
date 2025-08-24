"use client";
import { useState, useMemo, useEffect } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore – desacoplado de la firma exacta
import * as C from "@/lib/calc/contrapiso";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import AddToProject from "@/components/ui/AddToProject";

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
  const [tipo, setTipo] = useState(tipos[0]?.key ?? "cascote_terreno");
  const [L, setL] = useState(4); // m
  const [A, setA] = useState(3); // m
  const [H, setH] = useState(8); // cm
  const [malla, setMalla] = useState(mallas[0]?.key ?? "");
  const [waste, setWaste] = useState(10); // %

  // si cambian opciones y la selección actual ya no existe, ajusto
  useEffect(() => {
    if (tipos.length && !tipos.find((t) => t.key === tipo)) {
      setTipo(tipos[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos]);

  useEffect(() => {
    if (mallas.length && malla && !mallas.find((m) => m.key === malla)) {
      setMalla(mallas[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mallas]);

  // cálculo
  const r = useMemo(() => {
    const input = { tipo, L, A, Hcm: H, malla, wastePct: waste, coeffs };
    // @ts-ignore
    return (C.calcContrapiso ?? C.default ?? ((x: any) => x))(input);
  }, [tipo, L, A, H, malla, waste, coeffs]);

  // filas para tabla (solo números)
  const rows: ResultRow[] = useMemo(() => {
    const out: ResultRow[] = [];
    if (typeof r?.area_m2 === "number")
      out.push({ label: "Área", qty: Math.round(r.area_m2 * 100) / 100, unit: "m²" });
    if (typeof r?.espesor_cm === "number")
      out.push({ label: "Espesor", qty: Math.round(r.espesor_cm * 100) / 100, unit: "cm" });

    const vol =
      typeof r?.volumen_con_desperdicio_m3 === "number"
        ? r.volumen_con_desperdicio_m3
        : typeof r?.volumen_m3 === "number"
        ? r.volumen_m3
        : undefined;
    if (typeof vol === "number")
      out.push({ label: "Volumen", qty: Math.round(vol * 100) / 100, unit: "m³" });

    if (typeof r?.malla_m2 === "number")
      out.push({ label: "Malla SIMA", qty: Math.round(r.malla_m2 * 100) / 100, unit: "m²" });

    if (r?.materiales && typeof r.materiales === "object") {
      for (const [k, v] of Object.entries(r.materiales)) {
        const qty = Math.round((Number(v) || 0) * 100) / 100;
        out.push({ label: keyToLabel(k), qty, unit: keyToUnit(k) });
      }
    }
    return out;
  }, [r]);

  // materiales para Proyecto (con key + qty:number)
  const itemsForProject = useMemo(() => {
    const list: { key?: string; label: string; qty: number; unit: string }[] = [];
    if (r?.materiales && typeof r.materiales === "object") {
      for (const [k, v] of Object.entries(r.materiales)) {
        list.push({
          key: k,
          label: keyToLabel(k),
          qty: Math.round((Number(v) || 0) * 100) / 100,
          unit: keyToUnit(k),
        });
      }
    }
    // si usaste malla como m², podés incluirla también como material
    if (typeof r?.malla_m2 === "number" && r.malla_m2 > 0) {
      list.push({
        key: "malla_sima",
        label: "Malla SIMA",
        qty: Math.round(r.malla_m2 * 100) / 100,
        unit: "m2",
      });
    }
    return list;
  }, [r?.materiales, r?.malla_m2]);

  // título por defecto para la partida
  const defaultTitle = useMemo(() => {
    const mallaTxt = malla
      ? ` · ${mallas.find((x) => x.key === malla)?.label ?? "malla"}`
      : "";
    return `Contrapiso ${L}×${A} m · e=${H} cm · ${tipo}${mallaTxt}`;
  }, [L, A, H, tipo, malla, mallas]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Contrapiso</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
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

        {/* Card: Resultado */}
        <div className="card p-4 card--table">
          <h2 className="font-medium mb-2">Resultado</h2>
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>

      {/* Guardar en Proyecto */}
      {itemsForProject.length > 0 && (
        <AddToProject
          kind="contrapiso"
          defaultTitle={defaultTitle}
          items={itemsForProject}
          raw={r}
        />
      )}
    </section>
  );
}
