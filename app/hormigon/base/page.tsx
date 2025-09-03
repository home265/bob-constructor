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

// helpers
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import HelpPopover from "@/components/ui/HelpPopover";
import NumberWithUnit from "@/components/inputs/NumberWithUnit";

/* ----------------------------- Tipos auxiliares ---------------------------- */

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
type MeshRow  = { id?: string; label?: string; kg_m2?: number };

type BarsInput = {
  phi_x_mm: number;
  spacing_x_cm: number;
  phi_y_mm: number;
  spacing_y_cm: number;
  doubleLayer: boolean;
};

type BaseInputs = {
  L: number;
  B: number;
  Hcm: number;
  concreteClassId: string;
  wastePct: number;
  cover_cm: number;
  mallaId: string;          // "" si no se usa malla
  meshDoubleLayer: boolean;
  bars?: BarsInput;         // undefined si se usa malla
};

type BaseOutputs = Record<string, unknown>;

type BatchItem = {
  kind: "base";
  title: string;
  materials: MaterialRow[];
  inputs: BaseInputs;
  outputs: BaseOutputs;
};

/* ----------------------------- Helpers de unidad --------------------------- */

function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m" || s === "metros") return "m";
  return "u";
}

/* -------------------------------- Componente ------------------------------- */

function BaseCalculator() {
  const sp = useSearchParams();
  const projectId  = sp.get("projectId");
  const partidaId  = sp.get("partidaId");

  // JSONs con fallbacks seguros
  const concrete = useJson<Record<string, ConcreteRow>>("/data/concrete_classes.json", {
    H17: { id: "H17", label: "H-17" },
    H21: { id: "H21", label: "H-21" },
    H25: { id: "H25", label: "H-25" },
  });

  const rebars = useJson<Record<string, RebarRow>>("/data/rebar_diams.json", {
    "8":  { id: "8",  phi_mm: 8,  kg_m: 0.395, label: "Φ8 (0.395 kg/m)" },
    "10": { id: "10", phi_mm: 10, kg_m: 0.617, label: "Φ10 (0.617 kg/m)" },
    "12": { id: "12", phi_mm: 12, kg_m: 0.888, label: "Φ12 (0.888 kg/m)" },
  });

  const meshes = useJson<Record<string, MeshRow>>("/data/mesh_sima.json", {
    Q131: { id: "Q131", label: "Q131 (≈2.0 kg/m²)",  kg_m2: 2.0 },
    Q188: { id: "Q188", label: "Q188 (≈2.93 kg/m²)", kg_m2: 2.93 },
  });

  // Opciones para selects
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
  const [concreteId, setConcreteId] = useState<string>(concreteOpts[0]?.key ?? "H21");
  const [L, setL]       = useState(1.5);
  const [B, setB]       = useState(1.5);
  const [Hcm, setHcm]   = useState(30);
  const [cover, setCover] = useState(5);
  const [waste, setWaste] = useState(8);

  const [useMesh, setUseMesh] = useState(false);
  const [meshId, setMeshId]   = useState<string>(meshOpts[0]?.key ?? "");
  const [meshDoubleLayer, setMeshDoubleLayer] = useState(false);

  const [phiX, setPhiX] = useState<number>(rebarOpts[0]?.phi_mm ?? 10);
  const [sX, setSX]     = useState<number>(20);
  const [phiY, setPhiY] = useState<number>(rebarOpts[1]?.phi_mm ?? 8);
  const [sY, setSY]     = useState<number>(20);
  const [doubleLayer, setDoubleLayer] = useState(false);

  // Precarga desde partida (deep-link)
  useEffect(() => {
  if (!projectId || !partidaId) return;

  (async () => {
    const p = await getPartida(projectId, partidaId); // <- await
    const inp = (p?.inputs ?? undefined) as Partial<BaseInputs> | undefined;
    if (!inp) return;

    if (typeof inp.L === "number") setL(inp.L);
    if (typeof inp.B === "number") setB(inp.B);
    if (typeof inp.Hcm === "number") setHcm(inp.Hcm);
    if (typeof inp.cover_cm === "number") setCover(inp.cover_cm);
    if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
    if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);

    if (typeof inp.mallaId === "string" && inp.mallaId !== "") {
      setUseMesh(true);
      setMeshId(inp.mallaId);
      setMeshDoubleLayer(!!inp.meshDoubleLayer);
    } else if (inp.bars) {
      setUseMesh(false);
      setPhiX(inp.bars.phi_x_mm);
      setSX(inp.bars.spacing_x_cm);
      setPhiY(inp.bars.phi_y_mm);
      setSY(inp.bars.spacing_y_cm);
      setDoubleLayer(!!inp.bars.doubleLayer);
    }
  })();
}, [projectId, partidaId]);


  // Tablas para la lib
  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => { m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }; });
    return m;
  }, [rebarOpts]);

  const meshMap = useMemo(() => {
    const m: Record<string, { kg_m2?: number; label?: string }> = {};
    meshOpts.forEach((r) => { m[r.key] = { kg_m2: r.kg_m2, label: r.label }; });
    return m;
  }, [meshOpts]);

  // Cálculo (memoizado)
  const res: C.BaseResult = useMemo(() => C.calcBase({

    L, B, Hcm,
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
  }), [L, B, Hcm, concreteId, waste, cover, useMesh, meshId, meshMap, meshDoubleLayer, phiX, sX, phiY, sY, doubleLayer, rebarMap]);

  /* ------------------------ Desglose de materiales ------------------------ */

  const vol = useMemo(
    () => (res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3) || 0,
    [res?.volumen_con_desperdicio_m3, res?.volumen_m3]
  );

  const concreteRow: ConcreteRow | undefined = concrete ? concrete[concreteId] : undefined;


  const matBreakdown = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (vol > 0 && concreteRow) {
      const round2 = (n: number) => Math.round(n * 100) / 100;

      const bolsas = concreteRow.bolsas_cemento_por_m3 ?? concreteRow.cemento_bolsas_por_m3;
      if (typeof bolsas === "number") out.cemento_bolsas = round2(vol * bolsas);

      if (typeof concreteRow.cemento_kg_por_m3 === "number")
        out.cemento_kg = round2(vol * concreteRow.cemento_kg_por_m3);

      if (typeof concreteRow.arena_m3_por_m3 === "number")
        out.arena_m3 = round2(vol * concreteRow.arena_m3_por_m3);

      const grava = concreteRow.grava_m3_por_m3 ?? concreteRow.piedra_m3_por_m3;
      if (typeof grava === "number") out.piedra_m3 = round2(vol * grava);

      if (typeof concreteRow.agua_l_por_m3 === "number")
        out.agua_l = round2(vol * concreteRow.agua_l_por_m3);
    }
    return out;
  }, [vol, concreteRow]);

  /* ----------------------------- Tabla de salida -------------------------- */

  const rows: ResultRow[] = useMemo(() => {
    const r: ResultRow[] = [];
    if (res?.area_m2 != null)     r.push({ label: "Área",     qty: res.area_m2,   unit: "m²" });
    if (res?.espesor_cm != null)  r.push({ label: "Espesor",  qty: res.espesor_cm, unit: "cm" });
    if (res?.espesor_sugerido_cm !== undefined) {
  r.push({
    label: "Espesor sugerido",
    qty: res.espesor_sugerido_cm,
    unit: "cm",
    hint: res.regla_espesor ?? "H ≥ max(15 cm, L/25)",
  });
}

    if (vol > 0)                  r.push({ label: "Hormigón", qty: Math.round(vol * 100) / 100, unit: "m³", hint: "Con desperdicio" });

    if (res?.modo === "malla" && res?.malla_kg != null) {
      r.push({
        label: `Malla ${res?.malla_id ?? ""}`,
        qty: res.malla_kg,
        unit: "kg",
        hint: (res?.meshDoubleLayer || false) ? "2 capas" : "1 capa",
      });
    }

    if (res?.modo === "barras" && res?.barras) {
      const b = res.barras as {
        acero_kg?: number;
        capas?: number;
        x?: { phi_mm: number; spacing_cm: number; largo_total_m?: number; n?: number; kg?: number };
        y?: { phi_mm: number; spacing_cm: number; largo_total_m?: number; n?: number; kg?: number };
      };

      if (b.acero_kg != null)
        r.push({ label: "Acero total", qty: b.acero_kg, unit: "kg", hint: (b.capas === 2 ? "2 capas" : "1 capa") });

      if (b.x) {
        r.push({ label: `Barras X Φ${b.x.phi_mm}`, qty: b.x.largo_total_m ?? 0, unit: "m", hint: `${b.x.n ?? 0} uds · e=${b.x.spacing_cm} cm` });
        if (b.x.kg != null) r.push({ label: `Peso X Φ${b.x.phi_mm}`, qty: b.x.kg, unit: "kg" });
      }
      if (b.y) {
        r.push({ label: `Barras Y Φ${b.y.phi_mm}`, qty: b.y.largo_total_m ?? 0, unit: "m", hint: `${b.y.n ?? 0} uds · e=${b.y.spacing_cm} cm` });
        if (b.y.kg != null) r.push({ label: `Peso Y Φ${b.y.phi_mm}`, qty: b.y.kg, unit: "kg" });
      }
    }

    for (const [k, v] of Object.entries(matBreakdown)) {
      r.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
    }
    return r;
  }, [res?.area_m2, res?.espesor_cm, res?.modo, res?.malla_kg, res?.malla_id, res?.meshDoubleLayer, res?.barras, vol, matBreakdown]);

  /* -------------------------- Ítems para Proyecto ------------------------- */

  const itemsForProject = useMemo<MaterialRow[]>(() => {
    const out: MaterialRow[] = [];

    if (vol > 0) {
      out.push({ key: "hormigon_m3", label: `Hormigón ${concreteId}`, qty: Math.round(vol * 100) / 100, unit: "m3" });
    }

    if (res?.modo === "malla" && typeof res.malla_kg === "number") {
      out.push({ key: `malla_${res.malla_id}_kg`, label: `Malla ${res.malla_id}`, qty: Math.round(res.malla_kg * 100) / 100, unit: "kg" });
    }

    if (res?.modo === "barras" && typeof res.barras?.acero_kg === "number") {
      out.push({ key: "acero_barras_kg", label: "Acero en barras", qty: Math.round(res.barras.acero_kg * 100) / 100, unit: "kg" });
    }

    for (const [k, v] of Object.entries(matBreakdown)) {
      out.push({ key: k, label: keyToLabel(k), qty: Math.round((Number(v) || 0) * 100) / 100, unit: normalizeUnit(keyToUnit(k)) });
    }

    return out;
  }, [vol, res?.modo, res?.malla_kg, res?.malla_id, res?.barras?.acero_kg, concreteId, matBreakdown]);

  const defaultTitle = `Base ${L}×${B} e=${Hcm}cm`;

  /* ------------------------------- Lote local ------------------------------ */

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs: BaseInputs = {
      L, B, Hcm,
      concreteClassId: concreteId,
      wastePct: waste,
      cover_cm: cover,
      mallaId: useMesh ? meshId : "",
      meshDoubleLayer,
      bars: useMesh ? undefined : {
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
      outputs: res as BaseOutputs,
    };

    setBatch(prev => {
      if (editIndex !== null) {
        const next = [...prev]; next[editIndex] = item; return next;
      }
      return [...prev, item];
    });
    setEditIndex(null);
  };

  const handleEditFromBatch = (index: number) => {
    const it = batch[index];
    if (!it) return;
    const inp = it.inputs;

    setL(inp.L);
    setB(inp.B);
    setHcm(inp.Hcm);
    setConcreteId(inp.concreteClassId);
    setWaste(inp.wastePct);
    setCover(inp.cover_cm);

    const hasMesh = !!inp.mallaId;
    setUseMesh(hasMesh);
    if (hasMesh) {
      setMeshId(inp.mallaId);
      setMeshDoubleLayer(!!inp.meshDoubleLayer);
    } else if (inp.bars) {
      setPhiX(inp.bars.phi_x_mm);
      setSX(inp.bars.spacing_x_cm);
      setPhiY(inp.bars.phi_y_mm);
      setSY(inp.bars.spacing_y_cm);
      setDoubleLayer(!!inp.bars.doubleLayer);
    }
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch(prev => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  /* ---------------------------- Deep-link update --------------------------- */

  const handleUpdatePartida = () => {
    if (!projectId || !partidaId) return;
    const inputs: BaseInputs = {
      L, B, Hcm,
      concreteClassId: concreteId,
      wastePct: waste,
      cover_cm: cover,
      mallaId: useMesh ? meshId : "",
      meshDoubleLayer,
      bars: useMesh ? undefined : {
        phi_x_mm: phiX,
        spacing_x_cm: sX,
        phi_y_mm: phiY,
        spacing_y_cm: sY,
        doubleLayer,
      },
    };
    updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs,
      outputs: res as BaseOutputs,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  /* --------------------------------- UI ----------------------------------- */

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Base</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span>Clase de hormigón</span>
              <select value={concreteId} onChange={(e) => setConcreteId(e.target.value)} className="w-full px-3 py-2">
                {concreteOpts.map((c, i) => (
                  <option key={`${c.key}-${i}`} value={c.key}>{c.label}</option>
                ))}
              </select>
            </label>

            <NumberWithUnit
                label="Largo (m)"
                name="largo"
                unit="m"
                value={L}
                onChange={setL}
            />
            <NumberWithUnit
                label="Ancho (m)"
                name="ancho"
                unit="m"
                value={B}
                onChange={setB}
            />
            <NumberWithUnit
                label="Espesor (cm)"
                name="espesor"
                unit="cm"
                value={Hcm}
                onChange={setHcm}
            />
            {/* Sugerencia de espesor */}
{res?.espesor_sugerido_cm !== undefined && (
  <div className="col-span-2 text-xs mt-1">
    Sugerido: <b>{res.espesor_sugerido_cm} cm</b>{" "}
    <HelpPopover>{res.regla_espesor ?? "H ≥ max(15 cm, L/25)"}.</HelpPopover>
  </div>
)}
{res?.espesor_sugerido_cm !== undefined && Hcm < res.espesor_sugerido_cm && (
  <div
    role="alert"
    aria-live="polite"
    className="col-span-2 mt-1 rounded-md border px-3 py-2 text-sm
               bg-amber-100 text-amber-900 border-amber-300
               dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700"
  >
    El espesor ingresado ({Hcm} cm) es menor al recomendado ({res.espesor_sugerido_cm} cm).
  </div>
)}


            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Recubrimiento (cm)
                        <HelpPopover>
                        Es la capa de hormigón que protege al acero de la corrosión. Es la distancia desde el borde exterior de la base hasta la armadura. Un valor típico para fundaciones es de 5 cm.
                        </HelpPopover>
                    </span>
                }
                name="recubrimiento"
                unit="cm"
                value={cover}
                onChange={setCover}
            />
            <div className="col-span-2">
                <NumberWithUnit
                    label={
                        <span className="flex items-center">
                            Desperdicio (%)
                            <HelpPopover>
                            Agrega un volumen extra de hormigón para compensar el material que se pierde por derrames o queda en las herramientas. Un valor común es entre 5% y 10%.
                            </HelpPopover>
                        </span>
                    }
                    name="desperdicio"
                    unit="%"
                    value={waste}
                    onChange={setWaste}
                />
            </div>
          </div>

          {/* Selector de modo */}
          <div className="grid grid-cols-1 gap-2 pt-4 border-t border-border">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useMesh} onChange={(e) => setUseMesh(e.target.checked)} />
              <span className="flex items-center">
                Usar malla SIMA (en vez de barras)
                <HelpPopover>
                  Activa esta opción para usar mallas de acero pre-soldadas, comunes en plateas y bases. Si la dejas desactivada, podrás definir el armado con barras de acero individuales.
                </HelpPopover>
              </span>
            </label>
          </div>

          {useMesh ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2">
                <span>Malla SIMA</span>
                <select value={meshId} onChange={(e) => setMeshId(e.target.value)} className="w-full px-3 py-2">
                  {meshOpts.map((m, i) => <option key={`${m.key}-${i}`} value={m.key}>{m.label}</option>)}
                </select>
              </label>
              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={meshDoubleLayer} onChange={(e) => setMeshDoubleLayer(e.target.checked)} />
                <span>Doble capa de malla</span>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span>Φ barras X (mm)</span>
                <select value={phiX} onChange={(e) => setPhiX(+e.target.value)} className="w-full px-3 py-2">
                  {rebarOpts.map((r, i) => <option key={`rx-${r.key}-${i}`} value={r.phi_mm}>{r.label}</option>)}
                </select>
              </label>
              <NumberWithUnit
                label="Separación X (cm)"
                name="separacion_x"
                unit="cm"
                value={sX}
                onChange={setSX}
              />
              <label className="text-sm">
                <span>Φ barras Y (mm)</span>
                <select value={phiY} onChange={(e) => setPhiY(+e.target.value)} className="w-full px-3 py-2">
                  {rebarOpts.map((r, i) => <option key={`ry-${r.key}-${i}`} value={r.phi_mm}>{r.label}</option>)}
                </select>
              </label>
              <NumberWithUnit
                label="Separación Y (cm)"
                name="separacion_y"
                unit="cm"
                value={sY}
                onChange={setSY}
              />
              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={doubleLayer} onChange={(e) => setDoubleLayer(e.target.checked)} />
                <span>Doble capa de barras</span>
              </label>
            </div>
          )}
        </div>

        {/* Resultado */}
        <div className="card p-4 card--table">
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>

      {/* Deep-link update */}
      {projectId && partidaId ? (
        <div>
          <button type="button" className="rounded border px-3 py-2" onClick={handleUpdatePartida}>
            Actualizar partida
          </button>
        </div>
      ) : null}

      {/* Guardar unitario */}
      <div className="card p-4 space-y-3">
          <h3 className="font-semibold flex items-center">
              Guardar en proyecto
              <HelpPopover>
                Cada cálculo se guarda como una 'partida' dentro de tu proyecto. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo.
              </HelpPopover>
          </h3>
          <AddToProject kind="base" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />
      </div>


      {/* Lote local */}
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
            <button type="button" className="rounded border px-4 py-2" onClick={addCurrentToBatch}
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir base al lote"}>
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir base al lote"}
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

/* Wrapper con Suspense */
export default function BasePage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <BaseCalculator />
    </Suspense>
  );
}
