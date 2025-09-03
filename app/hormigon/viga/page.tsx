"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/viga";
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

// Inputs que guardamos en la partida (deep-link)
type VigaInputs = {
  L_m: number;
  b_cm: number;
  h_cm: number;
  cover_cm: number;
  concreteClassId: string;
  wastePct: number;
  long: { phi_mm: number; n_sup: number; n_inf: number; n_extra: number };
  stirrups: { phi_mm: number; spacing_cm: number; hook_cm: number };
};

// Normalizador de unidad al tipo Unit del proyecto
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "m") return "m";
  return "u";
}

function VigaCalculator() {
  // Deep-link (C)
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

  // Opciones normalizadas
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
  const [L, setL] = useState(3.5); // m
  const [b, setB] = useState(20);  // cm
  const [h, setH] = useState(30);  // cm
  const [cover, setCover] = useState(3); // cm
  const [waste, setWaste] = useState(8); // %

  // Longitudinales
  const [phiLong, setPhiLong] = useState<number>(rebarOpts[3]?.phi_mm ?? 12);
  const [nSup, setNSup] = useState(2);
  const [nInf, setNInf] = useState(2);
  const [nExt, setNExt] = useState(0);

  // Estribos
  const [phiSt, setPhiSt] = useState<number>(rebarOpts[1]?.phi_mm ?? 8);
  const [s, setS] = useState(15);         // cm
  const [hook, setHook] = useState(10);   // cm

  // Map rebar table
  const rebarMap = useMemo(() => {
    const m: Record<string, { kg_m?: number; label?: string }> = {};
    rebarOpts.forEach((r) => (m[String(r.phi_mm)] = { kg_m: r.kg_m, label: r.label }));
    return m;
  }, [rebarOpts]);

  // Precargar desde deep-link (C) — asíncrono y tipado
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const p = await getPartida(projectId, partidaId);
      const inp = (p?.inputs ?? undefined) as Partial<VigaInputs> | undefined;
      if (!inp) return;
      if (typeof inp.L_m === "number") setL(inp.L_m);
      if (typeof inp.b_cm === "number") setB(inp.b_cm);
      if (typeof inp.h_cm === "number") setH(inp.h_cm);
      if (typeof inp.cover_cm === "number") setCover(inp.cover_cm);
      if (typeof inp.concreteClassId === "string") setConcreteId(inp.concreteClassId);
      if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
      if (inp.long) {
        if (typeof inp.long.phi_mm === "number") setPhiLong(inp.long.phi_mm);
        if (typeof inp.long.n_sup === "number") setNSup(inp.long.n_sup);
        if (typeof inp.long.n_inf === "number") setNInf(inp.long.n_inf);
        if (typeof inp.long.n_extra === "number") setNExt(inp.long.n_extra);
      }
      if (inp.stirrups) {
        if (typeof inp.stirrups.phi_mm === "number") setPhiSt(inp.stirrups.phi_mm);
        if (typeof inp.stirrups.spacing_cm === "number") setS(inp.stirrups.spacing_cm);
        if (typeof inp.stirrups.hook_cm === "number") setHook(inp.stirrups.hook_cm);
      }
    })();
  }, [projectId, partidaId]);

  // Cálculo (con fallback resistente)
  const calc = (C as any).calcViga ?? (C as any).default ?? ((x: any) => x);
  const res = calc({
    L_m: L,
    b_cm: b,
    h_cm: h,
    cover_cm: cover,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    long: { phi_mm: phiLong, n_sup: nSup, n_inf: nInf, n_extra: nExt },
    stirrups: { phi_mm: phiSt, spacing_cm: s, hook_cm: hook },
  });

  // (B) Desglose opcional de hormigón según JSON
  const vol = res?.volumen_con_desperdicio_m3 ?? res?.volumen_m3 ?? 0;
  const concRow: ConcreteRow | undefined = (concrete as any)?.[concreteId];
  const concBreakdown: Record<string, number> = {};
  if (vol > 0 && concRow) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
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

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Salida (tabla)
  const rows: ResultRow[] = [];
  rows.push({
    label: "Sección",
    qty: (`${b}×${h}` as any),
    unit: "cm",
  });
  if (res?.area_seccion_m2 != null) rows.push({ label: "Área sección", qty: round2(res.area_seccion_m2), unit: "m²" });
  if (res?.dimensiones?.L_m != null) rows.push({ label: "Largo", qty: round2(res.dimensiones.L_m), unit: "m" });

  if (vol > 0) rows.push({ label: "Hormigón", qty: round2(vol), unit: "m³", hint: "Con desperdicio" });

  if (typeof res?.acero_total_kg === "number") rows.push({ label: "Acero total", qty: round2(res.acero_total_kg), unit: "kg" });

  if (res?.longitudinal) {
    const Lg = res.longitudinal;
    rows.push({
      label: `Longitudinal Φ${Lg.phi_mm} (${Lg.n_sup}+${Lg.n_inf}${Lg.n_extra ? `+${Lg.n_extra}` : ""})`,
      qty: round2(Lg.largo_total_m),
      unit: "m",
      hint: `Unidad ${round2(Lg.largo_unit_m)} m`,
    });
    rows.push({ label: `Peso long. Φ${Lg.phi_mm}`, qty: round2(Lg.kg), unit: "kg" });
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
      qty: round2(St.largo_total_m),
      unit: "m",
      hint: `Unidad ${round2(St.largo_unit_m)} m`,
    });
    rows.push({ label: `Peso estribos Φ${St.phi_mm}`, qty: round2(St.kg), unit: "kg" });
  }

  // Añadir desglose de hormigón a la tabla (si existe)
  for (const [k, v] of Object.entries(concBreakdown)) {
    rows.push({ label: keyToLabel(k), qty: v, unit: keyToUnit(k) });
  }

  // Ítems para proyecto (materiales unificables, con Unit válido)
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const out: MaterialRow[] = [];

    if (vol > 0) {
      out.push({
        key: "hormigon_simple",
        label: `Hormigón ${concreteId}`,
        qty: round2(vol),
        unit: "m3",
      });
    }

    // Acero: uso total si existe; si no, sumo partes
    const kgLong = Number(res?.longitudinal?.kg) || 0;
    const kgSt   = Number(res?.estribos?.kg) || 0;
    const kgTotal = Number(res?.acero_total_kg ?? (kgLong + kgSt)) || 0;
    if (kgTotal > 0) {
      out.push({
        key: "acero_corrugado",
        label: "Acero corrugado",
        qty: round2(kgTotal),
        unit: "kg",
      });
    }

    for (const [k, v] of Object.entries(concBreakdown)) {
      out.push({
        key: k,
        label: keyToLabel(k),
        qty: round2(Number(v) || 0),
        unit: normalizeUnit(keyToUnit(k) as any),
      });
    }

    return out;
  }, [vol, res?.longitudinal?.kg, res?.escribos?.kg, res?.acero_total_kg, concreteId, JSON.stringify(concBreakdown)]);

  const defaultTitle = `Viga ${b}×${h} · L=${L} m`;

  // (A) Lote local
  type BatchItem = {
    kind: "viga";
    title: string;
    materials: MaterialRow[];
    inputs: VigaInputs | any;
    outputs: Record<string, any>;
  };
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs: VigaInputs = {
      L_m: L,
      b_cm: b,
      h_cm: h,
      cover_cm: cover,
      concreteClassId: concreteId,
      wastePct: waste,
      long: { phi_mm: phiLong, n_sup: nSup, n_inf: nInf, n_extra: nExt },
      stirrups: { phi_mm: phiSt, spacing_cm: s, hook_cm: hook },
    };
    const item: BatchItem = {
      kind: "viga",
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
    const inp = (it.inputs || {}) as Partial<VigaInputs>;
    setL(inp.L_m ?? L);
    setB(inp.b_cm ?? b);
    setH(inp.h_cm ?? h);
    setCover(inp.cover_cm ?? cover);
    setConcreteId(inp.concreteClassId ?? concreteId);
    setWaste(inp.wastePct ?? waste);
    if (inp.long) {
      setPhiLong(inp.long.phi_mm ?? phiLong);
      setNSup(inp.long.n_sup ?? nSup);
      setNInf(inp.long.n_inf ?? nInf);
      setNExt(inp.long.n_extra ?? nExt);
    }
    if (inp.stirrups) {
      setPhiSt(inp.stirrups.phi_mm ?? phiSt);
      setS(inp.stirrups.spacing_cm ?? s);
      setHook(inp.stirrups.hook_cm ?? hook);
    }
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // (C) Actualizar partida (deep-link)
  const handleUpdatePartida = () => {
    if (!projectId || !partidaId) return;
    updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: {
        L_m: L,
        b_cm: b,
        h_cm: h,
        cover_cm: cover,
        concreteClassId: concreteId,
        wastePct: waste,
        long: { phi_mm: phiLong, n_sup: nSup, n_inf: nInf, n_extra: nExt },
        stirrups: { phi_mm: phiSt, spacing_cm: s, hook_cm: hook },
      } satisfies VigaInputs,
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Viga</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span className="flex items-center">
                Clase de hormigón
                <HelpPopover>Define la resistencia del hormigón. H-21 es una resistencia común para vigas de viviendas.</HelpPopover>
              </span>
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

            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Largo L (m)
                        <HelpPopover>Longitud de la viga entre sus apoyos (columnas o muros).</HelpPopover>
                    </span>
                }
                name="largo"
                unit="m"
                value={L}
                onChange={setL}
            />
            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Ancho b (cm)
                        <HelpPopover>Ancho de la sección transversal de la viga.</HelpPopover>
                    </span>
                }
                name="ancho"
                unit="cm"
                value={b}
                onChange={setB}
            />
            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Alto h (cm)
                        <HelpPopover>Altura total de la sección transversal de la viga.</HelpPopover>
                    </span>
                }
                name="alto"
                unit="cm"
                value={h}
                onChange={setH}
            />

            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Recubrimiento (cm)
                        <HelpPopover>Capa de hormigón que protege al acero. Es la distancia desde el borde de la viga hasta el estribo. Un valor típico es 2-3 cm.</HelpPopover>
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
                            <HelpPopover>Porcentaje de hormigón y acero extra para compensar pérdidas. Un valor común es 5-10%.</HelpPopover>
                        </span>
                    }
                    name="desperdicio"
                    unit="%"
                    value={waste}
                    onChange={setWaste}
                />
            </div>
          </div>

          {/* Longitudinales */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <label className="text-sm">
              <span className="flex items-center">
                Φ longitudinal (mm)
                <HelpPopover>Diámetro de las barras de acero principales que recorren la viga a lo largo.</HelpPopover>
              </span>
              <select
                value={phiLong}
                onChange={(e) => setPhiLong(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {rebarOpts.map((r, i) => (
                  <option key={`lng-${r.key}-${i}`} value={r.phi_mm}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Barras sup (uds)
                        <HelpPopover>Cantidad de barras de acero en la parte superior de la viga.</HelpPopover>
                    </span>
                }
                name="barras_sup"
                unit="uds"
                value={nSup}
                onChange={(v) => setNSup(Math.round(v))}
                step={1}
            />

            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Barras inf (uds)
                        <HelpPopover>Cantidad de barras de acero en la parte inferior de la viga.</HelpPopover>
                    </span>
                }
                name="barras_inf"
                unit="uds"
                value={nInf}
                onChange={(v) => setNInf(Math.round(v))}
                step={1}
            />

            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Barras extras (uds)
                        <HelpPopover>Cantidad de barras adicionales (ej: perchas o refuerzos en el alma de la viga).</HelpPopover>
                    </span>
                }
                name="barras_extras"
                unit="uds"
                value={nExt}
                onChange={(v) => setNExt(Math.round(v))}
                step={1}
            />
          </div>

          {/* Estribos */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <label className="text-sm">
              <span className="flex items-center">
                Φ estribo (mm)
                <HelpPopover>Diámetro de las barras de acero que envuelven las barras longitudinales (los "anillos").</HelpPopover>
              </span>
              <select
                value={phiSt}
                onChange={(e) => setPhiSt(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {rebarOpts.map((r, i) => (
                  <option key={`st-${r.key}-${i}`} value={r.phi_mm}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <NumberWithUnit
                label={
                    <span className="flex items-center">
                        Separación e (cm)
                        <HelpPopover>Distancia a lo largo de la viga entre cada estribo. Un valor común es 15 o 20 cm.</HelpPopover>
                    </span>
                }
                name="separacion_estribos"
                unit="cm"
                value={s}
                onChange={setS}
            />

            <div className="col-span-2">
                <NumberWithUnit
                    label={
                        <span className="flex items-center">
                            Ganchos (cm)
                            <HelpPopover>Longitud extra de acero en los extremos de cada estribo para asegurar el anclaje. Un valor típico es 10 cm.</HelpPopover>
                        </span>
                    }
                    name="ganchos"
                    unit="cm"
                    value={hook}
                    onChange={setHook}
                />
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="card p-4 card--table">
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>

      {/* Deep-link: actualizar partida */}
      {projectId && partidaId ? (
        <div>
          <button type="button" className="rounded border px-3 py-2" onClick={handleUpdatePartida}>
            Actualizar partida
          </button>
        </div>
      ) : null}

      {/* Agregar al proyecto (unidad) */}
      <div className="card p-4 space-y-3">
          <h3 className="font-semibold flex items-center">
              Guardar en proyecto
              <HelpPopover>
                Cada cálculo se guarda como una 'partida' dentro de tu proyecto. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo.
              </HelpPopover>
          </h3>
        <AddToProject kind="viga" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />
      </div>


      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Viga)</h2>
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
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir viga al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir viga al lote"}
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
export default function VigaPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <VigaCalculator />
    </Suspense>
  );
}
