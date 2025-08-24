"use client";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore desacoplado de la firma exacta
import * as C from "@/lib/calc/revestimientos";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";


type RevestOptionsFile = {
  // Puede venir como array de strings o de objetos
  tipos?: (string | { key?: string; label?: string })[];
  juntas_mm?: number[]; // si existe
};

type Coeffs = Record<string, any>;
type Pastina = Record<string, any>;

export default function RevestimientosPage() {
  const opts = useJson<RevestOptionsFile>("/data/revestimiento_options.json", {
    tipos: ["Cerámicas en piso", "Porcelanatos en piso", "Cerámicas en pared"],
    juntas_mm: [2, 3, 5, 8],
  });
  const coeffs = useJson<Coeffs>("/data/revestimiento_coeffs.json", {});
  const pastina = useJson<Pastina>("/data/pastina_coeffs.json", {});

  // Normalizo tipos
  const tipos = useMemo(() => {
    const raw = Array.isArray(opts.tipos) ? opts.tipos : [];
    return raw.map((t, i) =>
      typeof t === "string"
        ? { key: `tipo_${i}`, label: t }
        : { key: t?.key ?? `tipo_${i}`, label: t?.label ?? `Opción ${i + 1}` }
    );
  }, [opts.tipos]);

  // Normalizo juntas
  const juntas = useMemo(() => {
    return Array.isArray(opts.juntas_mm) && opts.juntas_mm.length
      ? opts.juntas_mm
      : [3, 5];
  }, [opts.juntas_mm]);

  // Estado
  const [tipo, setTipo] = useState<string>(tipos[0]?.key ?? "tipo_0");
  const [Lx, setLx] = useState(4); // m
  const [Ly, setLy] = useState(4); // m
  const [lp, setLp] = useState(33); // cm
  const [ap, setAp] = useState(33); // cm
  const [junta, setJunta] = useState<number>(juntas[0] ?? 3); // mm
  const [waste, setWaste] = useState(10);

  // Autocorrección ante cambios de JSON
  if (tipos.length && !tipos.find((t) => t.key === tipo)) {
    setTipo(tipos[0].key);
  }
  if (juntas.length && !juntas.includes(junta)) {
    setJunta(juntas[0]);
  }

  // Cálculo (usa tu función real si existe; si no, eco del input)
  // @ts-ignore
  const calc = C.calcRevestimientos ?? C.default ?? ((x: any) => x);
  const res = calc({
    tipo,
    L: Lx,
    A: Ly,
    pieza_cm: { LP: lp, AP: ap },
    junta_mm: junta,
    wastePct: waste,
    coeffs,
    pastina,
  });

  // Filas para la tabla (solo visual)
  const rows: ResultRow[] = (function (): ResultRow[] {
    const out: ResultRow[] = [];
    if (res?.area_m2 != null) out.push({ label: "Área", qty: res.area_m2, unit: "m²" });
    if (res?.modulo_m2 != null)
      out.push({ label: "Módulo (pieza + junta)", qty: res.modulo_m2, unit: "m²" });
    if (res?.piezas_necesarias != null)
      out.push({ label: "Piezas necesarias", qty: res.piezas_necesarias, unit: "u" });
    if (res?.piezas_con_desperdicio != null)
      out.push({ label: "Piezas con desperdicio", qty: res.piezas_con_desperdicio, unit: "u" });
    if (res?.cajas != null) out.push({ label: "Cajas", qty: res.cajas, unit: "u" });
    if (res?.pastina_kg != null) out.push({ label: "Pastina", qty: res.pastina_kg, unit: "kg" });
    // si después agregamos adhesivo: out.push({ label: "Adhesivo", qty: res.adhesivo_kg, unit: "kg" });
    return out;
  })();

  // Ítems para el Proyecto (solo numéricos, con unit en string — el helper normaliza)
  const itemsForProject = rows
    .filter((r) => typeof r.qty === "number")
    .map((r) => ({
      label: r.label,
      qty: r.qty as number,
      unit: r.unit || "u",
    }));

  const defaultTitle = `Revestimiento ${Lx}×${Ly} m`;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Revestimientos</h1>

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
                value={Lx}
                onChange={(e) => setLx(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Ancho (m)
              <input
                type="number"
                value={Ly}
                onChange={(e) => setLy(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Largo pieza (cm)
              <input
                type="number"
                value={lp}
                onChange={(e) => setLp(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Ancho pieza (cm)
              <input
                type="number"
                value={ap}
                onChange={(e) => setAp(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Junta (mm)
              <select
                value={junta}
                onChange={(e) => setJunta(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {juntas.map((j, i) => (
                  <option key={`j-${j}-${i}`} value={j}>
                    {j} mm
                  </option>
                ))}
              </select>
            </label>

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

        {/* Card: Resultado + Agregar al proyecto */}
        <div className="space-y-4">
          <ResultTable title="Resultado" items={rows} />
          <AddToProject
            kind="revestimiento"
            defaultTitle={defaultTitle}
            items={itemsForProject}
            raw={res}
          />
        </div>
      </div>
    </section>
  );
}
