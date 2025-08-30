"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/columna";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";

// (A) lote local
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow, Unit } from "@/lib/project/types";

// (C) edición / deep-link
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

// helpers etiquetas/unidades
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";

type ConcreteRow = {
  id?: string;
  label?: string;
  bolsas_cemento_por_m3?: number;
  cemento_bolsas_por_m3?: number;
  cemento_kg_por_m3?: number;
  arena_m3_por_m3?: number;
  grava_m3_por_m3?: number;
  piedra_m3_por_m3?: number; // alias
  agua_l_por_m3?: number;
};
type RebarRow = { id?: string; phi_mm?: number; kg_m?: number; label?: string };

// Inputs guardados en la partida (para tipado fuerte)
type ColumnaInputs = {
  H_m: number;
  b_cm: number;
  h_cm: number;
  cover_cm: number;
  concreteClassId: string;
  wastePct: number;
  vertical?: { phi_mm: number; n: number };
  stirrups?: { phi_mm: number; spacing_cm: number; hook_cm: number };
};

// — helper Unit para evitar errores de tipos —
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m" || s === "metros") return "m";
  return "u"; // bolsas, unidades, etc.
}

function ColumnaCalculator() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

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

  // (C) Precarga si venimos por deep-link —> ahora asíncrona
  useEffect(() => {
    if (!projectId || !partidaId) return;

    (async () => {
      const p = await getPartida(projectId, partidaId);
      const inp = (p?.inputs ?? undefined) as Partial<ColumnaInputs> | undefined;
      if (!inp) return;

      if (typeof inp.H_m === "number") setH(inp.H_m);
      if (typeof inp.b_cm === "number") setB(inp.b_cm);
      if (typeof inp.h_cm === "number") setHsec(inp.h_cm);
      if (typeof inp.cover_cm === "number") setCover(inp.cover_cm);
      if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
      if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);

      if (inp.vertical) {
        if (typeof inp.vertical.phi_mm === "number") setPhiV(inp.vertical.phi_mm);
        if (typeof inp.vertical.n === "number") setNV(inp.vertical.n);
      }
      if (inp.stirrups) {
        if (typeof inp.stirrups.phi_mm === "number") setPhiS(inp.stirrups.phi_mm);
        if (typeof inp.stirrups.spacing_cm === "number") setS(inp.stirrups.spacing_cm);
        if (typeof inp.stirrups.hook_cm === "number") setHook(inp.stirrups.hook_cm);
      }
    })();
  }, [projectId, partidaId]);

  // Map rebar table
  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => (m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }));
    return m;
  }, [rebarOpts]);

  // Cálculo (con fallback por si exportás default en la lib)
  const calc =
    (C as any).calcColumna ??
    (C as any).default ??
    ((x: any) => x);
  const res = calc({
    H_m: H,
    b_cm: b,
    h_cm: h,
    cover_cm: cover,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    vertical: { phi_mm: phiV, n: nV },
    stirrups: { phi_mm: phiS, spacing_cm: s, hook_cm: hook },
  });

  // (B) Desglose de hormigón a partir de concrete_classes.json
  const vol = (res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3) || 0;
  const concreteRow: ConcreteRow | undefined = (concrete as any)?.[concreteId];
  const matBreakdown: Record<string, number> = {};
  if (vol > 0 && concreteRow) {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const bolsas = concreteRow.bolsas_cemento_por_m3 ?? concreteRow.cemento_bolsas_por_m3;
    if (typeof bolsas === "number") matBreakdown.cemento_bolsas = round2(vol * bolsas);

    if (typeof concreteRow.cemento_kg_por_m3 === "number")
      matBreakdown.cemento_kg = round2(vol * concreteRow.cemento_kg_por_m3);

    const arena = concreteRow.arena_m3_por_m3;
    if (typeof arena === "number") matBreakdown.arena_m3 = round2(vol * arena);

    const grava = concreteRow.grava_m3_por_m3 ?? concreteRow.piedra_m3_por_m3;
    if (typeof grava === "number") matBreakdown.piedra_m3 = round2(vol * grava);

    if (typeof concreteRow.agua_l_por_m3 === "number")
      matBreakdown.agua_l = round2(vol * concreteRow.agua_l_por_m3);
  }

  // Salida a tabla
  const rows: ResultRow[] = [];
  rows.push({ label: "Sección", qty: `${b}×${h}`, unit: "cm" as any });
  if (res?.dimensiones?.H_m != null) rows.push({ label: "Altura", qty: res.dimensiones.H_m, unit: "m" });
  if (res?.area_seccion_m2 != null) rows.push({ label: "Área sección", qty: res.area_seccion_m2, unit: "m²" });

  if (vol > 0) rows.push({ label: "Hormigón", qty: Math.round(vol * 100) / 100, unit: "m³", hint: "Con desperdicio" });

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

  // volcamos desglose de materiales de hormigón
  for (const [k, v] of Object.entries(matBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Ítems de proyecto (MaterialRow[])
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const out: MaterialRow[] = [];
    if (vol > 0) {
      out.push({
        key: "hormigon_m3",
        label: `Hormigón ${concreteId}`,
        qty: Math.round(vol * 100) / 100,
        unit: "m3",
      });
    }
    if (typeof res?.acero_total_kg === "number" && res.acero_total_kg > 0) {
      out.push({
        key: "acero_total_kg",
        label: "Acero total",
        qty: Math.round(res.acero_total_kg * 100) / 100,
        unit: "kg",
      });
    }
    for (const [k, v] of Object.entries(matBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: Math.round((Number(v) || 0) * 100) / 100,
        unit: normalizeUnit(keyToUnit(k) as any),
      });
    }
    return out;
  }, [vol, res?.acero_total_kg, concreteId, JSON.stringify(matBreakdown)]);

  const defaultTitle = `Columna ${b}×${h} · H=${H} m`;

  // (A) Lote local
  type BatchItem = {
    kind: "columna";
    title: string;
    materials: MaterialRow[];
    inputs: ColumnaInputs;
    outputs: Record<string, any>;
  };
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs: ColumnaInputs = {
      H_m: H,
      b_cm: b,
      h_cm: h,
      cover_cm: cover,
      concreteClassId: concreteId,
      wastePct: waste,
      vertical: { phi_mm: phiV, n: nV },
      stirrups: { phi_mm: phiS, spacing_cm: s, hook_cm: hook },
    };
    const item: BatchItem = {
      kind: "columna",
      title: defaultTitle,
      materials: itemsForProject,
      inputs,
      outputs: res as any,
    };
    setBatch((prev) => {
      if (editIndex !== null) {
        const next = [...prev];
        next[editIndex] = item;
        return next;
      }
      return [...prev, item];
    });
    setEditIndex(null);
  };

  const handleEditFromBatch = (index: number) => {
    const it = batch[index];
    if (!it) return;
    const inp = it.inputs || ({} as Partial<ColumnaInputs>);
    setH(inp.H_m ?? H);
    setB(inp.b_cm ?? b);
    setHsec(inp.h_cm ?? h);
    setCover(inp.cover_cm ?? cover);
    setConcreteId(inp.concreteClassId ?? concreteId);
    setWaste(inp.wastePct ?? waste);
    if (inp.vertical) {
      setPhiV(inp.vertical.phi_mm ?? phiV);
      setNV(inp.vertical.n ?? nV);
    }
    if (inp.stirrups) {
      setPhiS(inp.stirrups.phi_mm ?? phiS);
      setS(inp.stirrups.spacing_cm ?? s);
      setHook(inp.stirrups.hook_cm ?? hook);
    }
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // (C) Actualizar partida (si deep-link)
  const handleUpdatePartida = () => {
    if (!projectId || !partidaId) return;
    updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: {
        H_m: H,
        b_cm: b,
        h_cm: h,
        cover_cm: cover,
        concreteClassId: concreteId,
        wastePct: waste,
        vertical: { phi_mm: phiV, n: nV },
        stirrups: { phi_mm: phiS, spacing_cm: s, hook_cm: hook },
      } satisfies ColumnaInputs,
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

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
        <div className="card p-4 card--table">
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>

      {/* Botón actualizar cuando venimos por deep-link */}
      {projectId && partidaId ? (
        <div>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={handleUpdatePartida}
          >
            Actualizar partida
          </button>
        </div>
      ) : null}

      {/* Agregar al proyecto (unitario) */}
      <AddToProject
        kind="columna"
        defaultTitle={defaultTitle}
        items={itemsForProject}
        raw={res}
      />

      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3 mt-4">
          <h2 className="font-medium">Lote local (Columna)</h2>
          <BatchList
            items={batch.map((b) => ({ title: b.title }))}
            onEdit={handleEditFromBatch}
            onRemove={handleRemoveFromBatch}
          />
          <AddToProjectBatch
            items={batch.map((b) => ({
              kind: b.kind,
              title: b.title,
              materials: b.materials,
              inputs: b.inputs,
              outputs: b.outputs,
            }))}
            onSaved={() => setBatch([])}
          />
          <div className="pt-2">
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={addCurrentToBatch}
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir columna al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir columna al lote"}
            </button>
            {editIndex !== null && (
              <button
                type="button"
                className="rounded border px-3 py-2 ml-2"
                onClick={() => setEditIndex(null)}
              >
              Cancelar edición
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Este es el componente de página que se exporta por defecto.
// Envuelve el calculador en <Suspense> para evitar el error de build.
export default function ColumnaPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <ColumnaCalculator />
    </Suspense>
  );
}
