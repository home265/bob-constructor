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
import HelpPopover from "@/components/ui/HelpPopover";
import NumberWithUnit from "@/components/inputs/NumberWithUnit";

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

// Inputs guardados en la partida (tipado fuerte)
type LosaPremoldeadaInputs = {
  L_m: number;
  W_m: number;
  spacing_cm: number;
  apoyo_cm: number;
  largo_bloque_m: number;
  capa_cm: number;
  wastePct: number;
  mallaId?: string;
  meshDoubleLayer?: boolean;
  concreteClassId: string;
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

type LosaPremInput = C.LosaPremInput;
type LosaPremResult = C.LosaPremResult;

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

  // (C) Precarga si deep-link — ahora asíncrona y tipada
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const p = await getPartida(projectId, partidaId);
      const inp = (p?.inputs ?? undefined) as Partial<LosaPremoldeadaInputs> | undefined;
      if (!inp) return;

      if (typeof inp.L_m === "number") setL(inp.L_m);
      if (typeof inp.W_m === "number") setW(inp.W_m);
      if (typeof inp.spacing_cm === "number") setS(inp.spacing_cm);
      if (typeof inp.apoyo_cm === "number") setApoyo(inp.apoyo_cm);
      if (typeof inp.largo_bloque_m === "number") setLBloque(inp.largo_bloque_m);
      if (typeof inp.capa_cm === "number") setCapa(inp.capa_cm);
      if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
      if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);

      const hasMesh = typeof inp.mallaId === "string" && inp.mallaId !== "";
      setUsaMalla(hasMesh);
      if (hasMesh) {
        setMeshId(inp.mallaId!);
        setMeshDouble(!!inp.meshDoubleLayer);
      }
    })();
  }, [projectId, partidaId]);

  const meshMap = useMemo(() => {
    const m: Record<string, { kg_m2?: number; label?: string }> = {};
    meshOpts.forEach((r) => (m[r.key] = { kg_m2: r.kg_m2, label: r.label }));
    return m;
  }, [meshOpts]);

  interface LosaPremModule {
    calcLosaPremoldeada?: (x: LosaPremInput) => LosaPremResult;
    default?: (x: LosaPremInput) => LosaPremResult;
  }
  const mod = C as unknown as LosaPremModule;

  const fallbackCalc = (x: LosaPremInput): LosaPremResult => {
  const area = Math.max(0, x.L_m) * Math.max(0, x.W_m);
  const s_m = Math.max(0, x.spacing_cm) / 100;
  const apoyo_m = Math.max(0, x.apoyo_cm ?? 0) / 100;
  const nVig = s_m > 0 ? Math.floor(x.W_m / s_m) + 1 : 0;
  const largoVig = x.L_m + 2 * apoyo_m;

  // manejar largo_bloque_m opcional (default típico 0.60 m)
  const lb = typeof x.largo_bloque_m === "number" ? x.largo_bloque_m : 0.6;

  const porVig = lb > 0 ? Math.ceil(x.L_m / lb) : 0;
  const bloquesTot = nVig * porVig;

  const volCapa = area * (Math.max(0, x.capa_cm) / 100);
  const fWaste = 1 + Math.max(0, x.wastePct ?? 0) / 100;
  const volCapaW = volCapa * fWaste;

  const out: LosaPremResult = {
    area_m2: Math.round(area * 100) / 100,
    viguetas: {
      qty: nVig,
      largo_unit_m: Math.round(largoVig * 100) / 100,
      largo_total_m: Math.round(nVig * largoVig * 100) / 100,
    },
    bloques: {
      qty: bloquesTot,
      por_vigueta: porVig,
      largo_unit_m: Math.round(lb * 100) / 100,
    },
    capa: {
      volumen_m3: Math.round(volCapa * 100) / 100,
      volumen_con_desperdicio_m3: Math.round(volCapaW * 100) / 100,
      espesor_cm: Math.round(x.capa_cm * 100) / 100,
    },
  };

  const kg_m2 = x.mallaId ? x.meshTable?.[x.mallaId]?.kg_m2 : undefined;
  if (kg_m2) {
    const capas = x.meshDoubleLayer ? 2 : 1;
    const kg = kg_m2 * area * capas * fWaste;
    out.malla = { id: x.mallaId!, kg: Math.round(kg * 100) / 100, capas };
  }
  return out;
};


  const calc =
    mod.calcLosaPremoldeada ??
    mod.default ??
    fallbackCalc;

  const res = calc({
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
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const capaVol = (res?.capa?.volumen_con_desperdicio_m3 ?? res?.capa?.volumen_m3) || 0;
  const concRow: ConcreteRow | undefined = concrete[concreteId];
  const matBreakdown: Record<string, number> = {};
  if (capaVol > 0 && concRow) {
    const bolsas = concRow.bolsas_cemento_por_m3 ?? concRow.cemento_bolsas_por_m3;
    if (typeof bolsas === "number") matBreakdown.cemento_bolsas = round2(capaVol * bolsas);
    if (typeof concRow.cemento_kg_por_m3 === "number")
      matBreakdown.cemento_kg = round2(capaVol * concRow.cemento_kg_por_m3);
    if (typeof concRow.arena_m3_por_m3 === "number")
      matBreakdown.arena_m3 = round2(capaVol * concRow.arena_m3_por_m3);
    const grava = concRow.grava_m3_por_m3 ?? concRow.piedra_m3_por_m3;
    if (typeof grava === "number") matBreakdown.piedra_m3 = round2(capaVol * grava);
    if (typeof concRow.agua_l_por_m3 === "number")
      matBreakdown.agua_l = round2(capaVol * concRow.agua_l_por_m3);
  }

  // Tabla resultado
  const rows: ResultRow[] = [];
  rows.push({ label: "Área", qty: round2(res?.area_m2 ?? 0), unit: "m²" });
  if (res?.viguetas) {
    rows.push({
      label: "Viguetas",
      qty: res.viguetas.qty,
      unit: "ud",
      hint: `largo unit. ${res.viguetas.largo_unit_m} m (total ${round2(res.viguetas.largo_total_m ?? 0)} m)`,
    });
  }
  if (res?.bloques) {
    rows.push({
      label: "Bloques",
      qty: res.bloques.qty,
      unit: "ud",
      hint: `${res.bloques.por_vigueta} por vigueta · largo ${res.bloques.largo_unit_m} m`,
    });
  }
  if (res?.capa) {
    rows.push({
      label: "Capa de compresión (hormigón)",
      qty: round2(capaVol),
      unit: "m³",
      hint: `espesor ${res.capa.espesor_cm} cm (con desperdicio)`,
    });
  }
  if (res?.malla) {
    rows.push({
      label: `Malla ${res.malla.id}`,
      qty: round2(res.malla.kg ?? 0),
      unit: "kg",
      hint: res.malla.capas === 2 ? "2 capas" : "1 capa",
    });
  }
  for (const [k, v] of Object.entries(matBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Ítems para proyecto
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const out: MaterialRow[] = [];

    if (capaVol > 0) {
      out.push({
        key: "hormigon_capa_m3",
        label: `Hormigón capa de compresión ${concreteId}`,
        qty: round2(capaVol),
        unit: "m3",
      });
    }
    if (res?.malla && typeof res.malla.kg === "number" && res.malla.kg > 0) {
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
        label: `Viguetas premoldeadas ${res?.viguetas?.largo_unit_m ?? 0} m`,
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
    for (const [k, v] of Object.entries(matBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: round2(Number(v) || 0),
        unit: normalizeUnit(keyToUnit(k)),
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
    inputs: LosaPremoldeadaInputs;
    outputs: Record<string, unknown>;
  };
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs: LosaPremoldeadaInputs = {
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
      outputs: res as unknown as Record<string, unknown>,
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
    const inp = (it.inputs || {}) as Partial<LosaPremoldeadaInputs>;
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
      setMeshId(inp.mallaId!);
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
      } satisfies LosaPremoldeadaInputs,
      outputs: res as unknown as Record<string, unknown>,
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
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Luz L (m)
                  <HelpPopover>Distancia libre entre los apoyos (vigas o muros) que deben cubrir las viguetas.</HelpPopover>
                </span>
              }
              name="luz_l"
              unit="m"
              value={L}
              onChange={setL}
            />
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Ancho W (m)
                  <HelpPopover>Ancho total del área que se va a cubrir con la losa.</HelpPopover>
                </span>
              }
              name="ancho_w"
              unit="m"
              value={W}
              onChange={setW}
            />
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Separación viguetas (cm)
                  <HelpPopover>Distancia de centro a centro entre cada vigueta. Un valor estándar es 50 cm.</HelpPopover>
                </span>
              }
              name="separacion"
              unit="cm"
              value={s}
              onChange={setS}
            />
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Apoyo por extremo (cm)
                  <HelpPopover>Longitud extra de la vigueta que descansa sobre el muro o viga en cada extremo. Un valor típico es 10 cm.</HelpPopover>
                </span>
              }
              name="apoyo"
              unit="cm"
              value={apoyo}
              onChange={setApoyo}
            />
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Largo bloque (m)
                  <HelpPopover>Longitud de los bloques de relleno (ladrillo cerámico o telgopor/EPS) que van entre las viguetas.</HelpPopover>
                </span>
              }
              name="largo_bloque"
              unit="m"
              value={lBloque}
              onChange={setLBloque}
            />
            <NumberWithUnit
              label={
                <span className="flex items-center">
                  Capa compresión (cm)
                  <HelpPopover>Espesor de la capa de hormigón que se vierte sobre las viguetas y bloques. Un valor típico es 5 cm.</HelpPopover>
                </span>
              }
              name="capa_compresion"
              unit="cm"
              value={capa}
              onChange={setCapa}
            />
            <div className="col-span-2">
                <NumberWithUnit
                    label={
                        <span className="flex items-center">
                            Desperdicio (%)
                            <HelpPopover>Porcentaje de material extra (hormigón, acero) para cubrir pérdidas por cortes y derrames. Un valor común es 8-10%.</HelpPopover>
                        </span>
                    }
                    name="desperdicio"
                    unit="%"
                    value={waste}
                    onChange={setWaste}
                />
            </div>
          </div>

          {/* Malla en capa */}
          <div className="grid grid-cols-1 gap-2 pt-4 border-t border-border">
            <label className="text-sm col-span-2 inline-flex items-center gap-2">
              <input type="checkbox" checked={usaMalla} onChange={(e) => setUsaMalla(e.target.checked)} />
              <span className="flex items-center">
                Incluir malla de reparto en la capa
                <HelpPopover>Se recomienda siempre incluir una malla de acero en la capa de compresión para controlar la fisuración.</HelpPopover>
              </span>
            </label>

            {usaMalla && (
              <>
                <label className="text-sm col-span-2">
                  <span>Malla</span>
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
                  <span>Doble capa</span>
                </label>
              </>
            )}
          </div>

          {/* Clase de hormigón (para desglose de la capa) */}
          <div className="grid grid-cols-1 gap-3 pt-4 border-t border-border">
            <label className="text-sm col-span-2">
              <span className="flex items-center">
                Clase de hormigón (capa)
                <HelpPopover>Define la resistencia del hormigón para la capa de compresión. H-21 es una opción común.</HelpPopover>
              </span>
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
      <div className="card p-4 space-y-3">
          <h3 className="font-semibold flex items-center">
              Guardar en proyecto
              <HelpPopover>
                Cada cálculo se guarda como una 'partida' dentro de tu proyecto. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo.
              </HelpPopover>
          </h3>
          <AddToProject kind="losa_premoldeada" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />
      </div>


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

// Page
export default function LosaPremoldeadaPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <LosaPremoldeadaCalculator />
    </Suspense>
  );
}
