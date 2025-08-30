"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/pilote";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import type { MaterialRow, Unit } from "@/lib/project/types";
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

type ConcreteRow = {
  id?: string;
  label?: string;
  bolsas_cemento_por_m3?: number;
  cemento_bolsas_por_m3?: number;
  cemento_kg_por_m3?: number;
  arena_m3_por_m3?: number;
  grava_m3_por_m3?: number;
  piedra_m3_por_m3?: number;
  agua_l_por_m3?: number;
};
type RebarRow = { id?: string; phi_mm?: number; kg_m?: number; label?: string };

// Inputs guardados en la partida (para deep-link)
type PiloteInputs = {
  L_m: number;
  d_cm: number;
  cover_cm: number;
  concreteClassId: string;
  wastePct: number;
  long: { phi_mm: number; n: number };
  spiral: { phi_mm: number; pitch_cm: number; extra_m: number };
};

// Unit normalizer (por si el mapper devuelve variantes)
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m") return "m";
  return "u";
}

function PiloteCalculator() {
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
    "8":  { id: "8",  phi_mm: 8,  kg_m: 0.395, label: "Φ8 (0.395 kg/m)" },
    "10": { id: "10", phi_mm: 10, kg_m: 0.617, label: "Φ10 (0.617 kg/m)" },
    "12": { id: "12", phi_mm: 12, kg_m: 0.888, label: "Φ12 (0.888 kg/m)" },
    "16": { id: "16", phi_mm: 16, kg_m: 1.58,  label: "Φ16 (1.58 kg/m)" },
  });

  const concreteOpts = useMemo(
    () =>
      Object.values(concrete ?? {}).map((r, i) => ({
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
  const [L, setL] = useState(6);        // m
  const [d, setD] = useState(40);       // cm
  const [cover, setCover] = useState(5);// cm
  const [waste, setWaste] = useState(8); // %

  // Longitudinales
  const [phiL, setPhiL] = useState<number>(rebarOpts[2]?.phi_mm ?? 12);
  const [nL, setNL] = useState(4);

  // Espiral
  const [phiS, setPhiS] = useState<number>(rebarOpts[0]?.phi_mm ?? 8);
  const [pitch, setPitch] = useState(10);  // cm
  const [extra, setExtra] = useState(0.2); // m

  // Deep-link (asíncrono + tipado)
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const p = await getPartida(projectId, partidaId);
      const inp = (p?.inputs ?? undefined) as Partial<PiloteInputs> | undefined;
      if (!inp) return;
      if (typeof inp.L_m === "number") setL(inp.L_m);
      if (typeof inp.d_cm === "number") setD(inp.d_cm);
      if (typeof inp.cover_cm === "number") setCover(inp.cover_cm);
      if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);
      if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
      if (inp.long) {
        if (typeof inp.long.phi_mm === "number") setPhiL(inp.long.phi_mm);
        if (typeof inp.long.n === "number") setNL(inp.long.n);
      }
      if (inp.spiral) {
        if (typeof inp.spiral.phi_mm === "number") setPhiS(inp.spiral.phi_mm);
        if (typeof inp.spiral.pitch_cm === "number") setPitch(inp.spiral.pitch_cm);
        if (typeof inp.spiral.extra_m === "number") setExtra(inp.spiral.extra_m);
      }
    })();
  }, [projectId, partidaId]);

  // Tablas → map
  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => (m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }));
    return m;
  }, [rebarOpts]);

  // Cálculo (fallback resistente)
  const calc = (C as any).calcPilote ?? (C as any).default ?? ((x: any) => x);
  const res = calc({
    L_m: L,
    d_cm: d,
    cover_cm: cover,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    long: { phi_mm: phiL, n: nL },
    spiral: { phi_mm: phiS, pitch_cm: pitch, extra_m: extra },
  });

  // (B) Desglose del hormigón (si tu JSON trae coeficientes por m³)
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const vol = res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3 ?? 0;
  const concRow: ConcreteRow | undefined = (concrete as any)?.[concreteId];
  const concBreakdown: Record<string, number> = {};
  if (vol > 0 && concRow) {
    const bolsas = concRow.bolsas_cemento_por_m3 ?? concRow.cemento_bolsas_por_m3;
    if (typeof bolsas === "number") concBreakdown.cemento_bolsas = round2(vol * bolsas);
    if (typeof concRow.cemento_kg_por_m3 === "number")
      concBreakdown.cemento_kg = round2(vol * concRow.cemento_kg_por_m3);
    if (typeof concRow.arena_m3_por_m3 === "number")
      concBreakdown.arena_m3 = round2(vol * concRow.arena_m3_por_m3);
    const grava = concRow.grava_m3_por_m3 ?? concRow.piedra_m3_por_m3;
    if (typeof grava === "number") concBreakdown.piedra_m3 = round2(vol * grava);
    if (typeof concRow.agua_l_por_m3 === "number")
      concBreakdown.agua_l = round2(vol * concRow.agua_l_por_m3);
  }

  // Salida visual (tabla)
  const rows: ResultRow[] = [];
  rows.push({ label: "Diámetro", qty: d, unit: "cm" });
  rows.push({ label: "Largo", qty: L, unit: "m" });
  if (res?.area_seccion_m2 != null) rows.push({ label: "Área sección", qty: round2(res.area_seccion_m2), unit: "m²" });

  if (vol > 0) rows.push({ label: "Hormigón", qty: round2(vol), unit: "m³", hint: "Con desperdicio" });

  if (res?.longitudinal) {
    const Lg = res.longitudinal;
    rows.push({
      label: `Longitudinal Φ${Lg.phi_mm}`,
      qty: round2(Lg.largo_total_m),
      unit: "m",
      hint: `${Lg.n} uds · unidad ${round2(Lg.largo_unit_m)} m`,
    });
    rows.push({ label: `Peso long. Φ${Lg.phi_mm}`, qty: round2(Lg.kg), unit: "kg" });
  }

  if (res?.espiral) {
    const Sp = res.espiral;
    rows.push({
      label: `Espiral Φ${Sp.phi_mm}`,
      qty: round2(Sp.largo_total_m),
      unit: "m",
      hint: `paso ${Sp.pitch_cm} cm · ~${round2(Sp.vueltas) } vueltas`,
    });
    rows.push({ label: `Peso espiral Φ${Sp.phi_mm}`, qty: round2(Sp.kg), unit: "kg" });
  }

  if (res?.acero_total_kg != null) {
    rows.push({ label: "Acero total", qty: round2(res.acero_total_kg), unit: "kg" });
  }

  // Añadir desglose del hormigón a la tabla (si existe)
  for (const [k, v] of Object.entries(concBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Materiales para "Agregar al proyecto"
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const out: MaterialRow[] = [];

    if (vol > 0) {
      out.push({
        key: "hormigon_pilote",
        label: `Hormigón para pilotes ${concreteId}`,
        qty: round2(vol),
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
        qty: round2(aceroTotal),
        unit: "kg",
      });
    }

    // Desglose de hormigón (opcional)
    for (const [k, v] of Object.entries(concBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: round2(Number(v) || 0),
        unit: normalizeUnit(keyToUnit(k) as any),
      });
    }

    return out;
  }, [vol, res?.acero_total_kg, res?.longitudinal?.kg, res?.espiral?.kg, concreteId, JSON.stringify(concBreakdown)]);

  const defaultTitle = `Pilote d=${d}cm · L=${L}m`;

  // (A) Lote local
  type BatchItem = {
    kind: "pilote";
    title: string;
    materials: MaterialRow[];
    inputs: PiloteInputs | any;
    outputs: Record<string, any>;
  };
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs: PiloteInputs = {
      L_m: L,
      d_cm: d,
      cover_cm: cover,
      concreteClassId: concreteId,
      wastePct: waste,
      long: { phi_mm: phiL, n: nL },
      spiral: { phi_mm: phiS, pitch_cm: pitch, extra_m: extra },
    };
    const item: BatchItem = {
      kind: "pilote",
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
    const inp = (it.inputs || {}) as Partial<PiloteInputs>;
    setL(inp.L_m ?? L);
    setD(inp.d_cm ?? d);
    setCover(inp.cover_cm ?? cover);
    setConcreteId(inp.concreteClassId ?? concreteId);
    setWaste(inp.wastePct ?? waste);
    if (inp.long) {
      setPhiL(inp.long.phi_mm ?? phiL);
      setNL(inp.long.n ?? nL);
    }
    if (inp.spiral) {
      setPhiS(inp.spiral.phi_mm ?? phiS);
      setPitch(inp.spiral.pitch_cm ?? pitch);
      setExtra(inp.spiral.extra_m ?? extra);
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
        L_m: L,
        d_cm: d,
        cover_cm: cover,
        concreteClassId: concreteId,
        wastePct: waste,
        long: { phi_mm: phiL, n: nL },
        spiral: { phi_mm: phiS, pitch_cm: pitch, extra_m: extra },
      } satisfies PiloteInputs,
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

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

          {projectId && partidaId ? (
            <button type="button" className="rounded border px-3 py-2" onClick={handleUpdatePartida}>
              Actualizar partida
            </button>
          ) : null}

          <AddToProject
            kind="pilote"
            defaultTitle={defaultTitle}
            items={itemsForProject}
            raw={res}
          />
        </div>
      </div>

      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Pilote)</h2>
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
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir pilote al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir pilote al lote"}
            </button>
            {editIndex !== null && (
              <button type="button" className="rounded border px-3 py-2 ml-2" onClick={() => setEditIndex(null)}>
                Cancelar edición
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Page
export default function PilotePage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <PiloteCalculator />
    </Suspense>
  );
}
