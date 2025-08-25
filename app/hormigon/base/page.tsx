"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/base";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";

// (A) lote local
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow, Unit } from "@/lib/project/types";

// (C) edición / deep-link
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

// helpers de etiquetas/unidades ya usados en otras páginas
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";

type ConcreteRow = {
  id?: string;
  label?: string;
  // coeficientes posibles por m³ (flexibles según tu JSON)
  bolsas_cemento_por_m3?: number;
  cemento_bolsas_por_m3?: number;
  cemento_kg_por_m3?: number;
  arena_m3_por_m3?: number;
  grava_m3_por_m3?: number;
  piedra_m3_por_m3?: number; // alias de grava
  agua_l_por_m3?: number;
};

type RebarRow = { id?: string; phi_mm?: number; kg_m?: number; label?: string };
type MeshRow = { id?: string; label?: string; kg_m2?: number };

// ------- helper Unit (evita errores de tipos) -------
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m" || s === "metros") return "m";
  // bolsas / unidades a "u"
  return "u";
}

// Componente principal que contiene toda la lógica del cliente
function BaseCalculator() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  // Opciones/coeficientes desde JSON (con fallbacks seguros)
  const concrete = useJson<Record<string, ConcreteRow>>("/data/concrete_classes.json", {
    H17: { id: "H17", label: "H-17" },
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

  // Normalizo para selects
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

  const meshOpts = useMemo(
    () =>
      Object.values(meshes ?? {}).map((r, i) => ({
        key: r?.id ?? `m${i}`,
        label: r?.label ?? r?.id ?? `Malla ${i + 1}`,
        kg_m2: r?.kg_m2 ?? 0,
      })),
    [meshes]
  );

  // Estado del formulario
  const [concreteId, setConcreteId] = useState<string>(concreteOpts[0]?.key ?? "H21");
  const [L, setL] = useState(1.5); // m
  const [B, setB] = useState(1.5); // m
  const [Hcm, setHcm] = useState(30); // cm
  const [cover, setCover] = useState(5); // cm
  const [waste, setWaste] = useState(8); // %

  // Modo malla o barras
  const [useMesh, setUseMesh] = useState(false);
  const [meshId, setMeshId] = useState<string>(meshOpts[0]?.key ?? "");
  const [meshDoubleLayer, setMeshDoubleLayer] = useState(false);

  const [phiX, setPhiX] = useState<number>(rebarOpts[0]?.phi_mm ?? 10);
  const [sX, setSX] = useState<number>(20); // cm
  const [phiY, setPhiY] = useState<number>(rebarOpts[1]?.phi_mm ?? 8);
  const [sY, setSY] = useState<number>(20); // cm
  const [doubleLayer, setDoubleLayer] = useState(false);

  // (C) Precarga si venimos por deep-link
  useEffect(() => {
    if (!projectId || !partidaId) return;
    const p = getPartida(projectId, partidaId);
    const inp = p?.inputs as any;
    if (!inp) return;
    if (typeof inp.L === "number") setL(inp.L);
    if (typeof inp.B === "number") setB(inp.B);
    if (typeof inp.Hcm === "number") setHcm(inp.Hcm);
    if (typeof inp.cover_cm === "number") setCover(inp.cover_cm);
    if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
    if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);

    if (inp.mallaId != null && typeof inp.mallaId === "string" && inp.mallaId !== "") {
      setUseMesh(true);
      setMeshId(inp.mallaId);
      setMeshDoubleLayer(!!inp.meshDoubleLayer);
    } else if (inp.bars) {
      setUseMesh(false);
      setPhiX(inp.bars.phi_x_mm ?? phiX);
      setSX(inp.bars.spacing_x_cm ?? sX);
      setPhiY(inp.bars.phi_y_mm ?? phiY);
      setSY(inp.bars.spacing_y_cm ?? sY);
      setDoubleLayer(!!inp.bars.doubleLayer);
    }
  }, [projectId, partidaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mapas para pasar a la lib
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

  // Cálculo (usamos la lib)
  const res = C.calcBase({
    L,
    B,
    Hcm,
    concreteClassId: concreteId,
    wastePct: waste,
    cover_cm: cover,
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

  // (B) Desglose de materiales del hormigón a partir de concrete_classes.json
  const vol = (res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3) || 0;
  const concreteRow: ConcreteRow | undefined = (concrete as any)?.[concreteId];

  const matBreakdown: Record<string, number> = {};
  if (vol > 0 && concreteRow) {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const bolsas =
      concreteRow.bolsas_cemento_por_m3 ??
      concreteRow.cemento_bolsas_por_m3;
    if (typeof bolsas === "number")
      matBreakdown.cemento_bolsas = round2(vol * bolsas);

    if (typeof concreteRow.cemento_kg_por_m3 === "number")
      matBreakdown.cemento_kg = round2(vol * concreteRow.cemento_kg_por_m3);

    const arena = concreteRow.arena_m3_por_m3;
    if (typeof arena === "number")
      matBreakdown.arena_m3 = round2(vol * arena);

    const grava = concreteRow.grava_m3_por_m3 ?? concreteRow.piedra_m3_por_m3;
    if (typeof grava === "number")
      matBreakdown.piedra_m3 = round2(vol * grava); // mostramos como "Piedra" si tu keyToLabel lo mapea

    if (typeof concreteRow.agua_l_por_m3 === "number")
      matBreakdown.agua_l = round2(vol * concreteRow.agua_l_por_m3);
  }

  // Filas de salida (para la tabla)
  const rows: ResultRow[] = [];
  if (res?.area_m2 != null) rows.push({ label: "Área", qty: res.area_m2, unit: "m²" });
  if (res?.espesor_cm != null) rows.push({ label: "Espesor", qty: res.espesor_cm, unit: "cm" });
  if (vol > 0) rows.push({ label: "Hormigón", qty: Math.round(vol * 100) / 100, unit: "m³", hint: "Con desperdicio" });

  // acero (malla o barras)
  if (res?.modo === "malla" && res?.malla_kg != null) {
    rows.push({
      label: `Malla ${res?.malla_id ?? ""}`,
      qty: res.malla_kg,
      unit: "kg",
      hint: meshDoubleLayer ? "2 capas" : "1 capa",
    });
  }

  if (res?.modo === "barras" && res?.barras) {
    const b = res.barras;
    if (b.acero_kg != null)
      rows.push({
        label: "Acero total",
        qty: b.acero_kg,
        unit: "kg",
        hint: b.capas === 2 ? "2 capas" : "1 capa",
      });

    if (b.x) {
      const x = b.x;
      rows.push({
        label: `Barras X Φ${x.phi_mm}`,
        qty: x.largo_total_m ?? 0,
        unit: "m",
        hint: `${x.n} uds · e=${x.spacing_cm} cm`,
      });
      if (x.kg != null) rows.push({ label: `Peso X Φ${x.phi_mm}`, qty: x.kg, unit: "kg" });
    }
    if (b.y) {
      const y = b.y;
      rows.push({
        label: `Barras Y Φ${y.phi_mm}`,
        qty: y.largo_total_m ?? 0,
        unit: "m",
        hint: `${y.n} uds · e=${y.spacing_cm} cm`,
      });
      if (y.kg != null) rows.push({ label: `Peso Y Φ${y.phi_mm}`, qty: y.kg, unit: "kg" });
    }
  }

  // volcamos desglose de materiales (cemento/cal/arena/piedra/agua) si lo hay
  for (const [k, v] of Object.entries(matBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Ítems para el proyecto (MaterialRow[])
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

    // acero
    if (res?.modo === "malla" && typeof res.malla_kg === "number") {
      out.push({
        key: `malla_${res.malla_id}_kg`,
        label: `Malla ${res.malla_id}`,
        qty: Math.round(res.malla_kg * 100) / 100,
        unit: "kg",
      });
    }
    if (res?.modo === "barras" && typeof res.barras?.acero_kg === "number") {
      out.push({
        key: "acero_barras_kg",
        label: "Acero en barras",
        qty: Math.round(res.barras.acero_kg * 100) / 100,
        unit: "kg",
      });
    }

    // desglose de hormigón
    for (const [k, v] of Object.entries(matBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: Math.round((Number(v) || 0) * 100) / 100,
        unit: normalizeUnit(keyToUnit(k) as any),
      });
    }

    return out;
  }, [vol, res?.modo, res?.malla_kg, res?.malla_id, res?.barras?.acero_kg, concreteId, JSON.stringify(matBreakdown)]);

  const defaultTitle = `Base ${L}×${B} e=${Hcm}cm`;

  // (A) Lote local
  type BatchItem = {
    kind: "base";
    title: string;
    materials: MaterialRow[];
    inputs: any;
    outputs: Record<string, any>;
  };
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs = {
      L,
      B,
      Hcm,
      concreteClassId: concreteId,
      wastePct: waste,
      cover_cm: cover,
      mallaId: useMesh ? meshId : "",
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
    };

    const item: BatchItem = {
      kind: "base",
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
    setL(inp.L ?? L);
    setB(inp.B ?? B);
    setHcm(inp.Hcm ?? Hcm);
    setConcreteId(inp.concreteClassId ?? concreteId);
    setWaste(inp.wastePct ?? waste);
    setCover(inp.cover_cm ?? cover);

    const hasMesh = !!inp.mallaId;
    setUseMesh(hasMesh);
    if (hasMesh) {
      setMeshId(inp.mallaId);
      setMeshDoubleLayer(!!inp.meshDoubleLayer);
    } else if (inp.bars) {
      setPhiX(inp.bars.phi_x_mm ?? phiX);
      setSX(inp.bars.spacing_x_cm ?? sX);
      setPhiY(inp.bars.phi_y_mm ?? phiY);
      setSY(inp.bars.spacing_y_cm ?? sY);
      setDoubleLayer(!!inp.bars.doubleLayer);
    }
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // (C) Actualizar partida (si venimos por deep-link)
  const handleUpdatePartida = () => {
    if (!projectId || !partidaId) return;
    updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: {
        L,
        B,
        Hcm,
        concreteClassId: concreteId,
        wastePct: waste,
        cover_cm: cover,
        mallaId: useMesh ? meshId : "",
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
      },
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Base</h1>

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
                value={B}
                onChange={(e) => setB(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Espesor (cm)
              <input
                type="number"
                value={Hcm}
                onChange={(e) => setHcm(+e.target.value || 0)}
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

          {/* Selector de modo: malla o barras */}
          <div className="grid grid-cols-1 gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useMesh}
                onChange={(e) => setUseMesh(e.target.checked)}
              />
              Usar malla SIMA (en vez de barras)
            </label>
          </div>

          {useMesh ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2">
                Malla SIMA
                <select
                  value={meshId}
                  onChange={(e) => setMeshId(e.target.value)}
                  className="w-full px-3 py-2"
                >
                  {meshOpts.map((m, i) => (
                    <option key={`${m.key}-${i}`} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={meshDoubleLayer}
                  onChange={(e) => setMeshDoubleLayer(e.target.checked)}
                />
                Doble capa de malla
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Φ barras X (mm)
                <select
                  value={phiX}
                  onChange={(e) => setPhiX(+e.target.value)}
                  className="w-full px-3 py-2"
                >
                  {rebarOpts.map((r, i) => (
                    <option key={`rx-${r.key}-${i}`} value={r.phi_mm}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Separación X (cm)
                <input
                  type="number"
                  value={sX}
                  onChange={(e) => setSX(+e.target.value || 0)}
                  className="w-full px-3 py-2"
                />
              </label>

              <label className="text-sm">
                Φ barras Y (mm)
                <select
                  value={phiY}
                  onChange={(e) => setPhiY(+e.target.value)}
                  className="w-full px-3 py-2"
                >
                  {rebarOpts.map((r, i) => (
                    <option key={`ry-${r.key}-${i}`} value={r.phi_mm}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Separación Y (cm)
                <input
                  type="number"
                  value={sY}
                  onChange={(e) => setSY(+e.target.value || 0)}
                  className="w-full px-3 py-2"
                />
              </label>

              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doubleLayer}
                  onChange={(e) => setDoubleLayer(e.target.checked)}
                />
                Doble capa de barras
              </label>
            </div>
          )}
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
        kind="base"
        defaultTitle={defaultTitle}
        items={itemsForProject}
        raw={res}
      />

      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3 mt-4">
          <h2 className="font-medium">Lote local (Base)</h2>
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
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir base al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir base al lote"}
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
export default function BasePage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <BaseCalculator />
    </Suspense>
  );
}