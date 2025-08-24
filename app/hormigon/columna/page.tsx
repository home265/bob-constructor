"use client";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/columna";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";

type ConcreteRow = { id?: string; label?: string };
type RebarRow = { id?: string; phi_mm?: number; kg_m?: number; label?: string };

export default function ColumnaPage() {
  // JSONs
  const concrete = useJson<Record<string, ConcreteRow>>("/data/concrete_classes.json", {
    H21: { id: "H21", label: "H-21" },
    H25: { id: "H25", label: "H-25" },
    H30: { id: "H30", label: "H-30" },
  });

  const rebars = useJson<Record<string, RebarRow>>("/data/rebar_diams.json", {
    "6":  { id: "6",  phi_mm: 6,  kg_m: 0.222, label: "Φ6 (0.222 kg/m)" },
    "8":  { id: "8",  phi_mm: 8,  kg_m: 0.395, label: "Φ8 (0.395 kg/m)" },
    "10": { id: "10", phi_mm: 10, kg_m: 0.617, label: "Φ10 (0.617 kg/m)" },
    "12": { id: "12", phi_mm: 12, kg_m: 0.888, label: "Φ12 (0.888 kg/m)" },
    "16": { id: "16", phi_mm: 16, kg_m: 1.58,  label: "Φ16 (1.58 kg/m)" },
  });

  // Normalización para selects
  const concreteOpts = useMemo(
    () => Object.values(concrete ?? {}).map((r, i) => ({
      key: r?.id ?? `c${i}`,
      label: r?.label ?? r?.id ?? `Clase ${i + 1}`,
    })),
    [concrete]
  );

  const rebarOpts = useMemo(() => {
    const rows = Object.values(rebars ?? {});
    rows.sort((a, b) => (a?.phi_mm ?? 0) - (b?.phi_mm ?? 0));
    return rows.map((r, i) => ({
      key: String(r?.phi_mm ?? r?.id ?? i),
      label: r?.label ?? `Φ${r?.phi_mm ?? r?.id}`,
      phi_mm: r?.phi_mm ?? Number(r?.id) ?? 0,
      kg_m: r?.kg_m ?? 0,
    }));
  }, [rebars]);

  // Estado
  const [concreteId, setConcreteId] = useState<string>(concreteOpts[0]?.key ?? "H25");
  const [H, setH] = useState(2.7);  // m (altura)
  const [b, setB] = useState(20);   // cm
  const [h, setHsec] = useState(20);// cm
  const [cover, setCover] = useState(3); // cm
  const [waste, setWaste] = useState(8); // %

  // Verticales
  const [phiV, setPhiV] = useState<number>(rebarOpts[3]?.phi_mm ?? 12);
  const [nV, setNV] = useState(4);

  // Estribos
  const [phiS, setPhiS] = useState<number>(rebarOpts[1]?.phi_mm ?? 8);
  const [s, setS] = useState(20);       // cm
  const [hook, setHook] = useState(10); // cm

  // Map rebar table
  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => (m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }));
    return m;
  }, [rebarOpts]);

  // Cálculo
  const res = C.calcColumna({
    H_m: H,
    b_cm: b,
    h_cm: h,
    cover_cm: cover,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    vertical: {
      phi_mm: phiV,
      n: nV,
    },
    stirrups: {
      phi_mm: phiS,
      spacing_cm: s,
      hook_cm: hook,
    },
  });

  // Salida
  const rows: ResultRow[] = [];
  rows.push({ label: "Sección", qty: `${b}×${h}`, unit: "cm" as any });
  if (res?.dimensiones?.H_m != null) rows.push({ label: "Altura", qty: res.dimensiones.H_m, unit: "m" });
  if (res?.area_seccion_m2 != null) rows.push({ label: "Área sección", qty: res.area_seccion_m2, unit: "m²" });

  const vol = res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3;
  if (vol != null) rows.push({ label: "Hormigón", qty: vol, unit: "m³", hint: "Con desperdicio" });

  if (res?.acero_total_kg != null) rows.push({ label: "Acero total", qty: res.acero_total_kg, unit: "kg" });

  if (res?.vertical) {
    const V = res.vertical;
    rows.push({
      label: `Barras verticales Φ${V.phi_mm}`,
      qty: V.largo_total_m,
      unit: "m",
      hint: `${V.n} uds · unidad ${V.largo_unit_m} m`,
    });
    rows.push({ label: `Peso vertical Φ${V.phi_mm}`, qty: V.kg, unit: "kg" });
  }

  if (res?.estribos) {
    const St = res.estribos;
    rows.push({
      label: `Estribos Φ${St.phi_mm}`,
      qty: St.qty,
      unit: "ud",
      hint: `e=${St.spacing_cm} cm`,
    });
    rows.push({
      label: "Largo total estribos",
      qty: St.largo_total_m,
      unit: "m",
      hint: `Unidad ${St.largo_unit_m} m`,
    });
    rows.push({ label: `Peso estribos Φ${St.phi_mm}`, qty: St.kg, unit: "kg" });
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Columna</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              Clase de hormigón
              <select
                value={concreteId}
                onChange={(e) => setConcreteId(e.target.value)}
                className="w-full px-3 py-2"
              >
                {concreteOpts.map((c, i) => (
                  <option key={`${c.key}-${i}`} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Altura H (m)
              <input
                type="number"
                value={H}
                onChange={(e) => setH(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Lado b (cm)
              <input
                type="number"
                value={b}
                onChange={(e) => setB(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Lado h (cm)
              <input
                type="number"
                value={h}
                onChange={(e) => setHsec(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Recubrimiento (cm)
              <input
                type="number"
                value={cover}
                onChange={(e) => setCover(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
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

          {/* Verticales */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Φ vertical (mm)
              <select
                value={phiV}
                onChange={(e) => setPhiV(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {rebarOpts.map((r, i) => (
                  <option key={`v-${r.key}-${i}`} value={r.phi_mm}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Nº de barras
              <input
                type="number"
                value={nV}
                onChange={(e) => setNV(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>

          {/* Estribos */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Φ estribo (mm)
              <select
                value={phiS}
                onChange={(e) => setPhiS(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {rebarOpts.map((r, i) => (
                  <option key={`s-${r.key}-${i}`} value={r.phi_mm}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Separación e (cm)
              <input
                type="number"
                value={s}
                onChange={(e) => setS(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm col-span-2">
              Ganchos (cm)
              <input
                type="number"
                value={hook}
                onChange={(e) => setHook(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>
        </div>

        {/* Resultado */}
        <ResultTable title="Resultado" items={rows} />
      </div>
    </section>
  );
}
