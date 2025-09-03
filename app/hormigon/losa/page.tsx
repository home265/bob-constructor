"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/losa";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow, Unit } from "@/lib/project/types";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";
import HelpPopover from "@/components/ui/HelpPopover";
import NumberWithUnit from "@/components/inputs/NumberWithUnit";

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
type MeshRow = { id?: string; label?: string; kg_m2?: number };

// Inputs que guardamos en la partida (para tipado fuerte)
type LosaInputs = {
  Lx_m: number;
  Ly_m: number;
  H_cm: number;
  cover_cm: number;
  concreteClassId: string;
  wastePct: number;
  mallaId?: string;
  meshDoubleLayer?: boolean;
  bars?: {
    phi_x_mm: number;
    spacing_x_cm: number;
    phi_y_mm: number;
    spacing_y_cm: number;
    doubleLayer?: boolean;
  };
};

// helper Unit para Project
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m" || s === "metros") return "m";
  return "u";
}

function LosaCalculator() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

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

  // Estado
  const [concreteId, setConcreteId] = useState(concreteOpts[0]?.key ?? "H25");
  const [Lx, setLx] = useState(4); // m
  const [Ly, setLy] = useState(3); // m
  const [H, setH] = useState(12); // cm
  const [cover, setCover] = useState(3); // cm
  const [waste, setWaste] = useState(8); // %

  const [useMesh, setUseMesh] = useState(true);
  const [meshId, setMeshId] = useState(meshOpts[0]?.key ?? "");
  const [meshDoubleLayer, setMeshDoubleLayer] = useState(false);

  const [phiX, setPhiX] = useState<number>(rebarOpts[1]?.phi_mm ?? 10);
  const [sX, setSX] = useState(20); // cm
  const [phiY, setPhiY] = useState<number>(rebarOpts[0]?.phi_mm ?? 8);
  const [sY, setSY] = useState(20); // cm
  const [doubleLayer, setDoubleLayer] = useState(false);

  // (C) Precarga si venimos por deep-link —> ahora asíncrona y tipada
  useEffect(() => {
    if (!projectId || !partidaId) return;

    (async () => {
      const p = await getPartida(projectId, partidaId);
      const inp = (p?.inputs ?? undefined) as Partial<LosaInputs> | undefined;
      if (!inp) return;

      if (typeof inp.Lx_m === "number") setLx(inp.Lx_m);
      if (typeof inp.Ly_m === "number") setLy(inp.Ly_m);
      if (typeof inp.H_cm === "number") setH(inp.H_cm);
      if (typeof inp.cover_cm === "number") setCover(inp.cover_cm);
      if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
      if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);

      const hasMesh = typeof inp.mallaId === "string" && inp.mallaId !== "";
      setUseMesh(hasMesh);
      if (hasMesh) {
        setMeshId(inp.mallaId!);
        setMeshDoubleLayer(!!inp.meshDoubleLayer);
      } else if (inp.bars) {
        setPhiX(inp.bars.phi_x_mm ?? phiX);
        setSX(inp.bars.spacing_x_cm ?? sX);
        setPhiY(inp.bars.phi_y_mm ?? phiY);
        setSY(inp.bars.spacing_y_cm ?? sY);
        setDoubleLayer(!!inp.bars.doubleLayer);
      }
    })();
  }, [projectId, partidaId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Cálculo con fallback si la lib exporta default
  // Cálculo tipado (sin any)
const res: C.LosaResult = C.calcLosa({

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

  // (B) Desglose hormigón según concrete_classes.json
  const vol = (res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3) || 0;
  const concreteRow: ConcreteRow | undefined = concrete ? concrete[concreteId] : undefined;

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

  // Tabla de resultado
  const rows: ResultRow[] = [];
  rows.push({ label: "Área", qty: res?.area_m2 ?? 0, unit: "m²" });
  rows.push({ label: "Espesor", qty: res?.espesor_cm ?? 0, unit: "cm" });
  if (res?.espesor_sugerido_cm !== undefined) {
  rows.push({
    label: "Espesor sugerido",
    qty: res.espesor_sugerido_cm,
    unit: "cm",
    hint: res.regla_espesor ?? "H ≥ max(10 cm, L/25)",
  });
}

  if (vol > 0) rows.push({ label: "Hormigón", qty: Math.round(vol * 100) / 100, unit: "m³", hint: "Con desperdicio" });

  if (res?.modo === "malla" && res?.malla_kg != null) {
    rows.push({
      label: `Malla ${res.malla_id ?? ""}`,
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

  // volcamos desglose de materiales del hormigón
  for (const [k, v] of Object.entries(matBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Ítems para "Agregar al proyecto"
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
    if (res?.modo === "malla" && typeof res?.malla_kg === "number" && res.malla_kg > 0) {
      out.push({
        key: `malla_${res.malla_id ?? "sima"}`,
        label: `Malla ${res.malla_id}${meshDoubleLayer ? " (2 capas)" : ""}`,
        qty: Math.round(res.malla_kg * 100) / 100,
        unit: "kg",
      });
    }
    if (res?.modo === "barras" && typeof res?.barras?.acero_kg === "number" && res.barras.acero_kg > 0) {
      out.push({
        key: "acero_total_kg",
        label: "Acero total",
        qty: Math.round(res.barras.acero_kg * 100) / 100,
        unit: "kg",
      });
    }
    for (const [k, v] of Object.entries(matBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: Math.round((Number(v) || 0) * 100) / 100,
        unit: normalizeUnit(keyToUnit(k)),

      });
    }
    return out;
  }, [vol, res?.modo, res?.malla_kg, res?.barras?.acero_kg, concreteId, meshDoubleLayer, JSON.stringify(matBreakdown)]);

  const defaultTitle = `Losa ${Lx}×${Ly} · e=${H} cm`;

  // (A) Lote local
  type BatchItem = {
  kind: "losa";
  title: string;
  materials: MaterialRow[];
  inputs: LosaInputs;
  outputs: C.LosaResult;
};

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs: LosaInputs = {
      Lx_m: Lx,
      Ly_m: Ly,
      H_cm: H,
      cover_cm: cover,
      concreteClassId: concreteId,
      wastePct: waste,
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
      kind: "losa",
      title: defaultTitle,
      materials: itemsForProject,
      inputs,
      outputs: res,

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
    const inp = it.inputs || ({} as Partial<LosaInputs>);
    setLx(inp.Lx_m ?? Lx);
    setLy(inp.Ly_m ?? Ly);
    setH(inp.H_cm ?? H);
    setCover(inp.cover_cm ?? cover);
    setConcreteId(inp.concreteClassId ?? concreteId);
    setWaste(inp.wastePct ?? waste);

    const hasMesh = typeof inp.mallaId === "string" && inp.mallaId !== "";
    setUseMesh(hasMesh);
    if (hasMesh) {
      setMeshId(inp.mallaId!);
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

  // (C) Actualizar partida (si deep-link)
  const handleUpdatePartida = () => {
    if (!projectId || !partidaId) return;
    updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: {
        Lx_m: Lx,
        Ly_m: Ly,
        H_cm: H,
        cover_cm: cover,
        concreteClassId: concreteId,
        wastePct: waste,
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
      } satisfies LosaInputs,
      outputs: res,

      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Losa (in situ)</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span className="flex items-center">
                Clase de hormigón
                <HelpPopover>Define la resistencia del hormigón. H-21 es una resistencia común para losas de viviendas.</HelpPopover>
              </span>
              <select value={concreteId} onChange={(e) => setConcreteId(e.target.value)} className="w-full px-3 py-2">
                {concreteOpts.map((c, i) => (
                  <option key={`${c.key}-${i}`} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Lx (m)
                  <HelpPopover>Dimensión de la losa en la dirección X (generalmente el lado más corto).</HelpPopover>
                </span>
              }
              name="lx"
              unit="m"
              value={Lx}
              onChange={setLx}
            />
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Ly (m)
                  <HelpPopover>Dimensión de la losa en la dirección Y (generalmente el lado más largo).</HelpPopover>
                </span>
              }
              name="ly"
              unit="m"
              value={Ly}
              onChange={setLy}
            />

            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Espesor (cm)
                  <HelpPopover>Altura o espesor total de la losa de hormigón. Un valor típico puede ser de 10 a 15 cm.</HelpPopover>
                </span>
              }
              name="espesor"
              unit="cm"
              value={H}
              onChange={setH}
            />
             {res?.espesor_sugerido_cm !== undefined && (
  <div className="col-span-2 text-xs mt-1">
    Sugerido: <b>{res.espesor_sugerido_cm} cm</b>{" "}
    <HelpPopover>Regla práctica: {res.regla_espesor ?? "H ≥ max(10 cm, L/25)"}.</HelpPopover>
  </div>
)}
{res?.espesor_sugerido_cm !== undefined && H < res.espesor_sugerido_cm && (
  <div
    role="alert"
    aria-live="polite"
    className="col-span-2 mt-1 rounded-md border px-3 py-2 text-sm
               bg-amber-100 text-amber-900 border-amber-300
               dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700"
  >
    El espesor ingresado ({H} cm) es menor al recomendado ({res.espesor_sugerido_cm} cm).
  </div>
)}


            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Recubrimiento (cm)
                  <HelpPopover>Capa de hormigón que protege el acero. Es la distancia desde el borde de la losa hasta la armadura. Un valor común es 2-3 cm.</HelpPopover>
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
                    <HelpPopover>Porcentaje de hormigón y acero extra para compensar pérdidas por derrames o cortes. Un valor típico es 5-10%.</HelpPopover>
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
                <HelpPopover>Activa esta opción para usar mallas de acero pre-soldadas. Si la dejas desactivada, podrás definir el armado con barras de acero individuales.</HelpPopover>
              </span>
            </label>
          </div>

          {useMesh ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2">
                <span className="flex items-center">
                  Malla SIMA
                  <HelpPopover>Selecciona el tipo de malla electrosoldada según el cálculo estructural.</HelpPopover>
                </span>
                <select value={meshId} onChange={(e) => setMeshId(e.target.value)} className="w-full px-3 py-2">
                  {meshOpts.map((m, i) => (
                    <option key={`${m.key}-${i}`} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={meshDoubleLayer} onChange={(e) => setMeshDoubleLayer(e.target.checked)} />
                <span className="flex items-center">
                  Doble capa de malla
                  <HelpPopover>Activa si el cálculo requiere una armadura superior e inferior con mallas.</HelpPopover>
                </span>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="flex items-center">
                  Φ barras X (mm)
                  <HelpPopover>Diámetro de las barras de acero en la dirección X.</HelpPopover>
                </span>
                <select value={phiX} onChange={(e) => setPhiX(+e.target.value)} className="w-full px-3 py-2">
                  {rebarOpts.map((r, i) => (
                    <option key={`rx-${r.key}-${i}`} value={r.phi_mm}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <NumberWithUnit
                label={
                  <span className="flex items-center">
                    Separación X (cm)
                    <HelpPopover>Distancia entre cada barra de acero en la dirección X.</HelpPopover>
                  </span>
                }
                name="separacion_x"
                unit="cm"
                value={sX}
                onChange={setSX}
              />

              <label className="text-sm">
                <span className="flex items-center">
                  Φ barras Y (mm)
                  <HelpPopover>Diámetro de las barras de acero en la dirección Y.</HelpPopover>
                </span>
                <select value={phiY} onChange={(e) => setPhiY(+e.target.value)} className="w-full px-3 py-2">
                  {rebarOpts.map((r, i) => (
                    <option key={`ry-${r.key}-${i}`} value={r.phi_mm}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <NumberWithUnit
                label={
                  <span className="flex items-center">
                    Separación Y (cm)
                    <HelpPopover>Distancia entre cada barra de acero en la dirección Y.</HelpPopover>
                  </span>
                }
                name="separacion_y"
                unit="cm"
                value={sY}
                onChange={setSY}
              />

              <label className="text-sm col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={doubleLayer} onChange={(e) => setDoubleLayer(e.target.checked)} />
                <span className="flex items-center">
                  Doble capa de barras
                  <HelpPopover>Activa si el cálculo requiere una armadura superior e inferior con barras (parrilla doble).</HelpPopover>
                </span>
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
          <button type="button" className="rounded border px-3 py-2" onClick={handleUpdatePartida}>
            Actualizar partida
          </button>
        </div>
      ) : null}

      {/* Agregar al proyecto (unitario) */}
      <div className="card p-4 space-y-3">
          <h3 className="font-semibold flex items-center">
              Guardar en proyecto
              <HelpPopover>
                Cada cálculo se guarda como una 'partida' dentro de tu proyecto. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo.
              </HelpPopover>
          </h3>
        <AddToProject kind="losa" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />
      </div>


      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3 mt-4">
          <h2 className="font-medium">Lote local (Losa)</h2>
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
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir losa al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir losa al lote"}
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

export default function LosaPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <LosaCalculator />
    </Suspense>
  );
}
