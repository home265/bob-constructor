"use client";
import { useMemo, useState } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/losa";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";

type ConcreteRow = { id?: string; label?: string };
type RebarRow = { id?: string; phi_mm?: number; kg_m?: number; label?: string };
type MeshRow = { id?: string; label?: string; kg_m2?: number };

export default function LosaPage() {
  // JSONs
  const concrete = useJson<Record<string, ConcreteRow>>("/data/concrete_classes.json", {
    H21: { id: "H21", label: "H-21" },
    H25: { id: "H25", label: "H-25" },
  });
  const rebars = useJson<Record<string, RebarRow>>("/data/rebar_diams.json", {
    "8": { id: "8", phi_mm: 8, kg_m: 0.395, label: "Φ8 (0.395 kg/m)" },
    "10": { id: "10", phi_mm: 10, kg_m: 0.617, label: "Φ10 (0.617 kg/m)" },
    "12": { id: "12", phi_mm: 12, kg_m: 0.888, label: "Φ12 (0.888 kg/m)" },
  });
  const meshes = useJson<Record<string, MeshRow>>("/data/mesh_sima.json", {
    Q131: { id: "Q131", label: "Q131 (≈2.0 kg/m²)", kg_m2: 2.0 },
    Q188: { id: "Q188", label: "Q188 (≈2.93 kg/m²)", kg_m2: 2.93 },
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

  const meshOpts = useMemo(
    () => Object.values(meshes ?? {}).map((r, i) => ({
      key: r?.id ?? `m${i}`,
      label: r?.label ?? r?.id ?? `Malla ${i + 1}`,
      kg_m2: r?.kg_m2 ?? 0,
    })),
    [meshes]
  );

  // Estado
  const [concreteId, setConcreteId] = useState(concreteOpts[0]?.key ?? "H25");
  const [Lx, setLx] = useState(4);      // m
  const [Ly, setLy] = useState(3);      // m
  const [H, setH] = useState(12);       // cm
  const [cover, setCover] = useState(3);// cm
  const [waste, setWaste] = useState(8); // %

  const [useMesh, setUseMesh] = useState(true);
  const [meshId, setMeshId] = useState(meshOpts[0]?.key ?? "");
  const [meshDoubleLayer, setMeshDoubleLayer] = useState(false);

  const [phiX, setPhiX] = useState<number>(rebarOpts[1]?.phi_mm ?? 10);
  const [sX, setSX] = useState(20); // cm
  const [phiY, setPhiY] = useState<number>(rebarOpts[0]?.phi_mm ?? 8);
  const [sY, setSY] = useState(20); // cm
  const [doubleLayer, setDoubleLayer] = useState(false);

  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => (m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }));
    return m;
  }, [rebarOpts]);

  const meshMap = useMemo(() => {
    const m: Record<string, { kg_m2?: number; label?: string }> = {};
    meshOpts.forEach((r) => (m[r.key] = { kg_m2: r.kg_m2, label: r.label }));
    return m;
  }, [meshOpts]);

  const res = C.calcLosa({
    Lx_m: Lx,
    Ly_m: Ly,
    H_cm: H,
    cover_cm: cover,
    concreteClassId: concreteId,
    wastePct: waste,
    mallaId: useMesh ? meshId : "",
    meshTable: meshMap,
    meshDoubleLayer,
    bars: useMesh
      ? undefined
      : {
          phi_x_mm: phiX,
          spacing_x_cm: sX,
          phi_y_mm: phiY,
          spacing_y_cm: sY,
          doubleLayer,
        },
    rebarTable: rebarMap,
  });

  const rows: ResultRow[] = [];
  rows.push({ label: "Área", qty: res?.area_m2 ?? 0, unit: "m²" });
  rows.push({ label: "Espesor", qty: res?.espesor_cm ?? 0, unit: "cm" });
  const vol = res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3;
  if (vol != null) rows.push({ label: "Hormigón", qty: vol, unit: "m³", hint: "Con desperdicio" });

  if (res?.modo === "malla" && res?.malla_kg != null) {
    rows.push({
      label: `Malla ${res.malla_id}`,
      qty: res.malla_kg,
      unit: "kg",
      hint: meshDoubleLayer ? "2 capas" : "1 capa",
    });
  }
  if (res?.modo === "barras" && res?.barras) {
    const b = res.barras;
    if (b.acero_kg != null)
      rows.push({ label: "Acero total", qty: b.acero_kg, unit: "kg", hint: b.capas === 2 ? "2 capas" : "1 capa" });
    if (b.x) {
      rows.push({
        label: `Barras X Φ${b.x.phi_mm}`,
        qty: b.x.largo_total_m ?? 0,
        unit: "m",
        hint: `${b.x.n} uds · e=${b.x.spacing_cm} cm`,
      });
      if (b.x.kg != null) rows.push({ label: `Peso X Φ${b.x.phi_mm}`, qty: b.x.kg, unit: "kg" });
    }
    if (b.y) {
      rows.push({
        label: `Barras Y Φ${b.y.phi_mm}`,
        qty: b.y.largo_total_m ?? 0,
        unit: "m",
        hint: `${b.y.n} uds · e=${b.y.spacing_cm} cm`,
      });
      if (b.y.kg != null) rows.push({ label: `Peso Y Φ${b.y.phi_mm}`, qty: b.y.kg, unit: "kg" });
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Losa (in situ)</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              Clase de hormigón
              <select value={concreteId} onChange={(e) => setConcreteId(e.target.value)} className="w-full px-3 py-2">
                {concreteOpts.map((c, i) => (
                  <option key={`${c.key}-${i}`} value={c.key}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">Lx (m)
              <input type="number" value={Lx} onChange={(e) => setLx(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
            <label className="text-sm">Ly (m)
              <input type="number" value={Ly} onChange={(e) => setLy(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">Espesor (cm)
              <input type="number" value={H} onChange={(e) => setH(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">Recubrimiento (cm)
              <input type="number" value={cover} onChange={(e) => setCover(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm col-span-2">Desperdicio (%)
              <input type="number" value={waste} onChange={(e) => setWaste(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
          </div>

          {/* Selector de modo */}
          <div className="grid grid-cols-1 gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useMesh} onChange={(e) => setUseMesh(e.target.checked)} />
              Usar malla SIMA (en vez de barras)
            </label>
          </div>

          {useMesh ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2">
                Malla SIMA
                <select value={meshId} onChange={(e) => setMeshId(e.target.value)} className="w-full px-3 py-2">
                  {meshOpts.map((m, i) => (
                    <option key={`${m.key}-${i}`} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={meshDoubleLayer} onChange={(e) => setMeshDoubleLayer(e.target.checked)} />
                Doble capa de malla
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Φ barras X (mm)
                <select value={phiX} onChange={(e) => setPhiX(+e.target.value)} className="w-full px-3 py-2">
                  {rebarOpts.map((r, i) => (<option key={`rx-${r.key}-${i}`} value={r.phi_mm}>{r.label}</option>))}
                </select>
              </label>
              <label className="text-sm">Separación X (cm)
                <input type="number" value={sX} onChange={(e) => setSX(+e.target.value || 0)} className="w-full px-3 py-2" />
              </label>

              <label className="text-sm">Φ barras Y (mm)
                <select value={phiY} onChange={(e) => setPhiY(+e.target.value)} className="w-full px-3 py-2">
                  {rebarOpts.map((r, i) => (<option key={`ry-${r.key}-${i}`} value={r.phi_mm}>{r.label}</option>))}
                </select>
              </label>
              <label className="text-sm">Separación Y (cm)
                <input type="number" value={sY} onChange={(e) => setSY(+e.target.value || 0)} className="w-full px-3 py-2" />
              </label>

              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={doubleLayer} onChange={(e) => setDoubleLayer(e.target.checked)} />
                Doble capa de barras
              </label>
            </div>
          )}
        </div>

        {/* Resultado */}
        <ResultTable title="Resultado" items={rows} />
      </div>
    </section>
  );
}
