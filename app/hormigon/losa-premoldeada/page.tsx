"use client";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/losaPremoldeada";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";

type MeshRow = { id?: string; label?: string; kg_m2?: number };

export default function LosaPremoldeadaPage() {
  const meshes = useJson<Record<string, MeshRow>>("/data/mesh_sima.json", {
    Q131: { id: "Q131", label: "Q131 (≈2.0 kg/m²)", kg_m2: 2.0 },
    Q188: { id: "Q188", label: "Q188 (≈2.93 kg/m²)", kg_m2: 2.93 },
  });

  const meshOpts = useMemo(
    () => Object.values(meshes ?? {}).map((r, i) => ({
      key: r?.id ?? `m${i}`,
      label: r?.label ?? r?.id ?? `Malla ${i + 1}`,
      kg_m2: r?.kg_m2 ?? 0,
    })),
    [meshes]
  );

  // Estado
  const [L, setL] = useState(4.2);     // m
  const [W, setW] = useState(6.0);     // m
  const [s, setS] = useState(60);      // cm (separación viguetas)
  const [apoyo, setApoyo] = useState(7);// cm
  const [lBloque, setLBloque] = useState(0.6); // m
  const [capa, setCapa] = useState(5); // cm
  const [waste, setWaste] = useState(8);// %

  const [usaMalla, setUsaMalla] = useState(true);
  const [meshId, setMeshId] = useState(meshOpts[0]?.key ?? "");
  const [meshDouble, setMeshDouble] = useState(false);

  const meshMap = useMemo(() => {
    const m: Record<string, { kg_m2?: number; label?: string }> = {};
    meshOpts.forEach((r) => (m[r.key] = { kg_m2: r.kg_m2, label: r.label }));
    return m;
  }, [meshOpts]);

  const res = C.calcLosaPremoldeada({
    L_m: L,
    W_m: W,
    spacing_cm: s,
    apoyo_cm: apoyo,
    largo_bloque_m: lBloque,
    capa_cm: capa,
    wastePct: waste,
    mallaId: usaMalla ? meshId : "",
    meshTable: meshMap,
    meshDoubleLayer: meshDouble,
  });

  const rows: ResultRow[] = [];
  rows.push({ label: "Área", qty: res.area_m2, unit: "m²" });

  rows.push({
    label: "Viguetas",
    qty: res.viguetas.qty,
    unit: "ud",
    hint: `largo unit. ${res.viguetas.largo_unit_m} m (total ${res.viguetas.largo_total_m} m)`,
  });

  if (res.bloques) {
    rows.push({
      label: "Bloques",
      qty: res.bloques.qty,
      unit: "ud",
      hint: `${res.bloques.por_vigueta} por vigueta · largo ${res.bloques.largo_unit_m} m`,
    });
  }

  rows.push({
    label: "Capa de compresión",
    qty: res.capa.volumen_con_desperdicio_m3 ?? res.capa.volumen_m3,
    unit: "m³",
    hint: `espesor ${res.capa.espesor_cm} cm (con desperdicio)`,
  });

  if (res.malla) {
    rows.push({
      label: `Malla ${res.malla.id}`,
      qty: res.malla.kg,
      unit: "kg",
      hint: res.malla.capas === 2 ? "2 capas" : "1 capa",
    });
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Losa premoldeada</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Luz L (m)
              <input type="number" value={L} onChange={(e) => setL(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
            <label className="text-sm">Ancho W (m)
              <input type="number" value={W} onChange={(e) => setW(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">Separación viguetas (cm)
              <input type="number" value={s} onChange={(e) => setS(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
            <label className="text-sm">Apoyo por extremo (cm)
              <input type="number" value={apoyo} onChange={(e) => setApoyo(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">Largo bloque (m)
              <input type="number" value={lBloque} onChange={(e) => setLBloque(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">Capa compresión (cm)
              <input type="number" value={capa} onChange={(e) => setCapa(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm col-span-2">Desperdicio (%)
              <input type="number" value={waste} onChange={(e) => setWaste(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
          </div>

          {/* Malla en capa */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2 inline-flex items-center gap-2">
              <input type="checkbox" checked={usaMalla} onChange={(e) => setUsaMalla(e.target.checked)} />
              Incluir malla de reparto en la capa
            </label>

            {usaMalla && (
              <>
                <label className="text-sm col-span-2">
                  Malla
                  <select value={meshId} onChange={(e) => setMeshId(e.target.value)} className="w-full px-3 py-2">
                    {meshOpts.map((m, i) => (
                      <option key={`${m.key}-${i}`} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm col-span-2 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={meshDouble}
                    onChange={(e) => setMeshDouble(e.target.checked)}
                  />
                  Doble capa
                </label>
              </>
            )}
          </div>
        </div>

        {/* Resultado */}
        <ResultTable title="Resultado" items={rows} />
      </div>
    </section>
  );
}
