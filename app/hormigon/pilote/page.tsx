"use client";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/pilote";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";


type ConcreteRow = { id?: string; label?: string };
type RebarRow = { id?: string; phi_mm?: number; kg_m?: number; label?: string };

export default function PilotePage() {
  // JSONs
  const concrete = useJson<Record<string, ConcreteRow>>("/data/concrete_classes.json", {
    H21: { id: "H21", label: "H-21" },
    H25: { id: "H25", label: "H-25" },
    H30: { id: "H30", label: "H-30" },
  });

  const rebars = useJson<Record<string, RebarRow>>("/data/rebar_diams.json", {
    "8":  { id: "8",  phi_mm: 8,  kg_m: 0.395, label: "Φ8 (0.395 kg/m)" },
    "10": { id: "10", phi_mm: 10, kg_m: 0.617, label: "Φ10 (0.617 kg/m)" },
    "12": { id: "12", phi_mm: 12, kg_m: 0.888, label: "Φ12 (0.888 kg/m)" },
    "16": { id: "16", phi_mm: 16, kg_m: 1.58,  label: "Φ16 (1.58 kg/m)" },
  });

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
  const [L, setL] = useState(6);      // m
  const [d, setD] = useState(40);     // cm
  const [cover, setCover] = useState(5); // cm
  const [waste, setWaste] = useState(8); // %

  // Longitudinales
  const [phiL, setPhiL] = useState<number>(rebarOpts[2]?.phi_mm ?? 12);
  const [nL, setNL] = useState(4);

  // Espiral
  const [phiS, setPhiS] = useState<number>(rebarOpts[0]?.phi_mm ?? 8);
  const [pitch, setPitch] = useState(10);  // cm
  const [extra, setExtra] = useState(0.2); // m

  // Tablas → map
  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => (m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }));
    return m;
  }, [rebarOpts]);

  // Cálculo
  const res = C.calcPilote({
    L_m: L,
    d_cm: d,
    cover_cm: cover,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    long: { phi_mm: phiL, n: nL },
    spiral: { phi_mm: phiS, pitch_cm: pitch, extra_m: extra },
  });

  // Salida visual (tabla)
  const rows: ResultRow[] = [];
  rows.push({ label: "Diámetro", qty: d, unit: "cm" });
  rows.push({ label: "Largo", qty: L, unit: "m" });
  if (res?.area_seccion_m2 != null) rows.push({ label: "Área sección", qty: res.area_seccion_m2, unit: "m²" });

  const vol = res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3;
  if (vol != null) rows.push({ label: "Hormigón", qty: vol, unit: "m³", hint: "Con desperdicio" });

  if (res?.longitudinal) {
    const Lg = res.longitudinal;
    rows.push({
      label: `Longitudinal Φ${Lg.phi_mm}`,
      qty: Lg.largo_total_m,
      unit: "m",
      hint: `${Lg.n} uds · unidad ${Lg.largo_unit_m} m`,
    });
    rows.push({ label: `Peso long. Φ${Lg.phi_mm}`, qty: Lg.kg, unit: "kg" });
  }

  if (res?.espiral) {
    const Sp = res.espiral;
    rows.push({
      label: `Espiral Φ${Sp.phi_mm}`,
      qty: Sp.largo_total_m,
      unit: "m",
      hint: `paso ${Sp.pitch_cm} cm · ~${Sp.vueltas} vueltas`,
    });
    rows.push({ label: `Peso espiral Φ${Sp.phi_mm}`, qty: Sp.kg, unit: "kg" });
  }

  if (res?.acero_total_kg != null) {
    rows.push({ label: "Acero total", qty: res.acero_total_kg, unit: "kg" });
  }

  // Materiales para "Agregar al proyecto"
  const projectItems = (function (): { key?: string; label: string; qty: number; unit: string }[] {
    const out: { key?: string; label: string; qty: number; unit: string }[] = [];

    const hormigon = typeof vol === "number" ? vol : 0;
    if (hormigon > 0) {
      out.push({
        key: "hormigon_pilote",
        label: "Hormigón para pilotes",
        qty: Math.round(hormigon * 100) / 100,
        unit: "m3",
      });
    }

    const aceroTotal =
      typeof res?.acero_total_kg === "number"
        ? res.acero_total_kg
        : (res?.longitudinal?.kg ?? 0) + (res?.espiral?.kg ?? 0);

    if (aceroTotal > 0) {
      out.push({
        key: "acero_pilote_total",
        label: "Acero para pilotes",
        qty: Math.round(aceroTotal * 100) / 100,
        unit: "kg",
      });
    }

    return out;
  })();

  const defaultTitle = `Pilote d=${d}cm · L=${L}m`;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Pilote</h1>

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
              Largo L (m)
              <input
                type="number"
                value={L}
                onChange={(e) => setL(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Diámetro d (cm)
              <input
                type="number"
                value={d}
                onChange={(e) => setD(+e.target.value || 0)}
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

          {/* Longitudinales */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Φ longitudinal (mm)
              <select
                value={phiL}
                onChange={(e) => setPhiL(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {rebarOpts.map((r, i) => (
                  <option key={`lng-${r.key}-${i}`} value={r.phi_mm}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Nº de barras
              <input
                type="number"
                value={nL}
                onChange={(e) => setNL(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>

          {/* Espiral */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Φ espiral (mm)
              <select
                value={phiS}
                onChange={(e) => setPhiS(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {rebarOpts.map((r, i) => (
                  <option key={`sp-${r.key}-${i}`} value={r.phi_mm}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Paso (cm/vuelta)
              <input
                type="number"
                value={pitch}
                onChange={(e) => setPitch(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm col-span-2">
              Extra de longitud (m)
              <input
                type="number"
                value={extra}
                onChange={(e) => setExtra(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>
        </div>

        {/* Resultado + Agregar al proyecto */}
        <div className="space-y-4">
          <ResultTable title="Resultado" items={rows} />

          <AddToProject
            kind="pilote"
            defaultTitle={defaultTitle}
            items={projectItems}
            raw={res}
          />
        </div>
      </div>
    </section>
  );
}
