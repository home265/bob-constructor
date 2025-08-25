"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/losaPremoldeada";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import type { MaterialRow, Unit } from "@/lib/project/types";
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

type MeshRow = { id?: string; label?: string; kg_m2?: number };
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

// helper Unit → Project
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m") return "m";
  return "u";
}

function LosaPremoldeadaCalculator() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  // JSONs
  const meshes = useJson<Record<string, MeshRow>>("/data/mesh_sima.json", {
    Q131: { id: "Q131", label: "Q131 (≈2.0 kg/m²)", kg_m2: 2.0 },
    Q188: { id: "Q188", label: "Q188 (≈2.93 kg/m²)", kg_m2: 2.93 },
  });
  const concrete = useJson<Record<string, ConcreteRow>>("/data/concrete_classes.json", {
    H17: { id: "H17", label: "H-17" },
    H21: { id: "H21", label: "H-21" },
    H25: { id: "H25", label: "H-25" },
  });

  const meshOpts = useMemo(
    () =>
      Object.values(meshes ?? {}).map((r, i) => ({
        key: r?.id ?? `m${i}`,
        label: r?.label ?? r?.id ?? `Malla ${i + 1}`,
        kg_m2: r?.kg_m2 ?? 0,
      })),
    [meshes]
  );
  const concreteOpts = useMemo(
    () =>
      Object.values(concrete ?? {}).map((r, i) => ({
        key: r?.id ?? `c${i}`,
        label: r?.label ?? r?.id ?? `Clase ${i + 1}`,
      })),
    [concrete]
  );

  // Estado
  const [L, setL] = useState(4.2); // m
  const [W, setW] = useState(6.0); // m
  const [s, setS] = useState(60); // cm
  const [apoyo, setApoyo] = useState(7); // cm
  const [lBloque, setLBloque] = useState(0.6); // m
  const [capa, setCapa] = useState(5); // cm
  const [waste, setWaste] = useState(8); // %

  const [usaMalla, setUsaMalla] = useState(true);
  const [meshId, setMeshId] = useState(meshOpts[0]?.key ?? "");
  const [meshDouble, setMeshDouble] = useState(false);

  // clase de hormigón para la capa (para desglose B)
  const [concreteId, setConcreteId] = useState(concreteOpts[1]?.key ?? "H21");

  // (C) Precarga si deep-link
  useEffect(() => {
    if (!projectId || !partidaId) return;
    const p = getPartida(projectId, partidaId);
    const inp = p?.inputs as any;
    if (!inp) return;
    if (typeof inp.L_m === "number") setL(inp.L_m);
    if (typeof inp.W_m === "number") setW(inp.W_m);
    if (typeof inp.spacing_cm === "number") setS(inp.spacing_cm);
    if (typeof inp.apoyo_cm === "number") setApoyo(inp.apoyo_cm);
    if (typeof inp.largo_bloque_m === "number") setLBloque(inp.largo_bloque_m);
    if (typeof inp.capa_cm === "number") setCapa(inp.capa_cm);
    if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
    if (typeof inp.mallaId === "string") {
      setUsaMalla(!!inp.mallaId);
      setMeshId(inp.mallaId);
    }
    if (typeof inp.meshDoubleLayer === "boolean") setMeshDouble(inp.meshDoubleLayer);
    if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);
  }, [projectId, partidaId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // (B) Desglose hormigón de la capa
  const capaVol = (res?.capa?.volumen_con_desperdicio_m3 ?? res?.capa?.volumen_m3) || 0;
  const concRow: ConcreteRow | undefined = (concrete as any)?.[concreteId];
  const matBreakdown: Record<string, number> = {};
  if (capaVol > 0 && concRow) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const bolsas = concRow.bolsas_cemento_por_m3 ?? concRow.cemento_bolsas_por_m3;
    if (typeof bolsas === "number") matBreakdown.cemento_bolsas = round2(capaVol * bolsas);
    if (typeof concRow.cemento_kg_por_m3 === "number")
      matBreakdown.cemento_kg = round2(capaVol * concRow.cemento_kg_por_m3);
    const arena = concRow.arena_m3_por_m3;
    if (typeof arena === "number") matBreakdown.arena_m3 = round2(capaVol * arena);
    const grava = concRow.grava_m3_por_m3 ?? concRow.piedra_m3_por_m3;
    if (typeof grava === "number") matBreakdown.piedra_m3 = round2(capaVol * grava);
    if (typeof concRow.agua_l_por_m3 === "number")
      matBreakdown.agua_l = round2(capaVol * concRow.agua_l_por_m3);
  }

  // Tabla resultado
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
    label: "Capa de compresión (hormigón)",
    qty: capaVol,
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
  // Añadimos desglose de la capa
  for (const [k, v] of Object.entries(matBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Ítems para proyecto
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const out: MaterialRow[] = [];
    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (capaVol > 0) {
      out.push({
        key: "hormigon_capa_m3",
        label: `Hormigón capa de compresión ${concreteId}`,
        qty: round2(capaVol),
        unit: "m3",
      });
    }
    if (res.malla && typeof res.malla.kg === "number" && res.malla.kg > 0) {
      out.push({
        key: `malla_${res.malla.id ?? "sima"}`,
        label: `Malla ${res.malla.id}${meshDouble ? " (2 capas)" : ""}`,
        qty: round2(res.malla.kg),
        unit: "kg",
      });
    }
    const vigQty = typeof res?.viguetas?.qty === "number" ? res.viguetas.qty : 0;
    if (vigQty > 0) {
      out.push({
        key: "viguetas_premoldeadas",
        label: `Viguetas premoldeadas ${res.viguetas!.largo_unit_m} m`,
        qty: vigQty,
        unit: "u",
      });
    }
    const bloquesQty = typeof res?.bloques?.qty === "number" ? res.bloques.qty : 0;
    if (bloquesQty > 0) {
      out.push({
        key: "bloques_huecos_losa",
        label: "Bloques para losa premoldeada",
        qty: bloquesQty,
        unit: "u",
      });
    }
    // desglose de materiales del hormigón de la capa
    for (const [k, v] of Object.entries(matBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: round2(Number(v) || 0),
        unit: normalizeUnit(keyToUnit(k) as any),
      });
    }
    return out;
  }, [capaVol, res?.malla?.kg, res?.viguetas?.qty, res?.bloques?.qty, concreteId, meshDouble, JSON.stringify(matBreakdown)]);

  const defaultTitle = `Losa premoldeada ${L}×${W} · s=${s} cm · capa=${capa} cm`;

  // (A) Lote local
  type BatchItem = {
    kind: "losa_premoldeada";
    title: string;
    materials: MaterialRow[];
    inputs: any;
    outputs: Record<string, any>;
  };
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs = {
      L_m: L,
      W_m: W,
      spacing_cm: s,
      apoyo_cm: apoyo,
      largo_bloque_m: lBloque,
      capa_cm: capa,
      wastePct: waste,
      mallaId: usaMalla ? meshId : "",
      meshDoubleLayer: meshDouble,
      concreteClassId: concreteId,
    };
    const item: BatchItem = {
      kind: "losa_premoldeada",
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
    const inp = it.inputs || {};
    setL(inp.L_m ?? L);
    setW(inp.W_m ?? W);
    setS(inp.spacing_cm ?? s);
    setApoyo(inp.apoyo_cm ?? apoyo);
    setLBloque(inp.largo_bloque_m ?? lBloque);
    setCapa(inp.capa_cm ?? capa);
    setWaste(inp.wastePct ?? waste);
    setConcreteId(inp.concreteClassId ?? concreteId);
    const hasMesh = typeof inp.mallaId === "string" && inp.mallaId !== "";
    setUsaMalla(hasMesh);
    if (hasMesh) {
      setMeshId(inp.mallaId);
      setMeshDouble(!!inp.meshDoubleLayer);
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
        W_m: W,
        spacing_cm: s,
        apoyo_cm: apoyo,
        largo_bloque_m: lBloque,
        capa_cm: capa,
        wastePct: waste,
        mallaId: usaMalla ? meshId : "",
        meshDoubleLayer: meshDouble,
        concreteClassId: concreteId,
      },
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Losa premoldeada</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Luz L (m)
              <input type="number" value={L} onChange={(e) => setL(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
            <label className="text-sm">
              Ancho W (m)
              <input type="number" value={W} onChange={(e) => setW(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">
              Separación viguetas (cm)
              <input type="number" value={s} onChange={(e) => setS(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>
            <label className="text-sm">
              Apoyo por extremo (cm)
              <input type="number" value={apoyo} onChange={(e) => setApoyo(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">
              Largo bloque (m)
              <input type="number" value={lBloque} onChange={(e) => setLBloque(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm">
              Capa compresión (cm)
              <input type="number" value={capa} onChange={(e) => setCapa(+e.target.value || 0)} className="w-full px-3 py-2" />
            </label>

            <label className="text-sm col-span-2">
              Desperdicio (%)
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
                      <option key={`${m.key}-${i}`} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm col-span-2 inline-flex items-center gap-2">
                  <input type="checkbox" checked={meshDouble} onChange={(e) => setMeshDouble(e.target.checked)} />
                  Doble capa
                </label>
              </>
            )}
          </div>

          {/* Clase de hormigón (para desglose de la capa) */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              Clase de hormigón (capa)
              <select value={concreteId} onChange={(e) => setConcreteId(e.target.value)} className="w-full px-3 py-2">
                {concreteOpts.map((c, i) => (
                  <option key={`${c.key}-${i}`} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Resultado */}
        <div className="card p-4 card--table">
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>

      {/* (C) Actualizar partida si venimos por deep-link */}
      {projectId && partidaId ? (
        <div>
          <button type="button" className="rounded border px-3 py-2" onClick={handleUpdatePartida}>
            Actualizar partida
          </button>
        </div>
      ) : null}

      {/* Agregar al proyecto */}
      <AddToProject kind="losa_premoldeada" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />

      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3 mt-4">
          <h2 className="font-medium">Lote local (Losa premoldeada)</h2>
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
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir losa premoldeada al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir losa premoldeada al lote"}
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

// Este es el componente de página que se exporta por defecto.
// Envuelve el calculador en <Suspense> para evitar el error de build.
export default function LosaPremoldeadaPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <LosaPremoldeadaCalculator />
    </Suspense>
  );
}