"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore desacoplado de la firma exacta
import * as C from "@/lib/calc/revestimientos";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";

// (A) lote local
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow, Unit } from "@/lib/project/types";

// (C) deep-link edición
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

type RevestOptionsFile = {
  tipos?: (string | { key?: string; label?: string })[];
  juntas_mm?: number[];
};

type Coeffs = Record<string, any>;
type Pastina = Record<string, any>;
type Adhesivos = Record<string, any>;

// ------- helper Unit (evita errores de tipos) -------
function normalizeUnit(u: string): Unit {
  const s = (u || "").toLowerCase();
  if (s === "m²" || s === "m2") return "m2";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "kg") return "kg";
  if (s === "l" || s === "lt" || s === "litros") return "l";
  if (s === "u" || s === "unidades" || s === "caja" || s === "cajas") return "u";
  if (s === "m" || s === "metros") return "m";
  return "u";
}

// ------- pequeño lector robusto de coeficientes -------
function pickNumber(
  obj: any,
  paths: (string | number)[][]
): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const p of paths) {
    let cur: any = obj;
    let ok = true;
    for (const k of p) {
      if (cur && typeof cur === "object" && k in cur) {
        cur = cur[k as any];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && typeof cur === "number" && Number.isFinite(cur)) return cur;
  }
  return undefined;
}

// ------- tipos de lote -------
type BatchItem = {
  kind: "revestimiento";
  title: string;
  materials: MaterialRow[];
  inputs: {
    tipo: string;
    L: number; // m
    A: number; // m
    lp: number; // cm
    ap: number; // cm
    junta: number; // mm
    waste: number; // %
  };
  outputs: Record<string, any>;
};

function RevestimientosCalculator() {
  // (C) deep-link edición
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  const opts = useJson<RevestOptionsFile>("/data/revestimiento_options.json", {
    tipos: ["Cerámicas en piso", "Porcelanatos en piso", "Cerámicas en pared"],
    juntas_mm: [2, 3, 5, 8],
  });
  const coeffs = useJson<Coeffs>("/data/revestimiento_coeffs.json", {});
  const pastina = useJson<Pastina>("/data/pastina_coeffs.json", {});
  const adhesivos = useJson<Adhesivos>("/data/adhesivos.json", {});

  // Normalizo tipos
  const tipos = useMemo(() => {
    const raw = Array.isArray(opts.tipos) ? opts.tipos : [];
    return raw.map((t, i) =>
      typeof t === "string"
        ? { key: `tipo_${i}`, label: t }
        : { key: t?.key ?? `tipo_${i}`, label: t?.label ?? `Opción ${i + 1}` }
    );
  }, [opts.tipos]);

  // Normalizo juntas
  const juntas = useMemo(() => {
    return Array.isArray(opts.juntas_mm) && opts.juntas_mm.length
      ? opts.juntas_mm
      : [3, 5];
  }, [opts.juntas_mm]);

  // Estado
  const [tipo, setTipo] = useState<string>(tipos[0]?.key ?? "tipo_0");
  const [Lx, setLx] = useState(4); // m
  const [Ly, setLy] = useState(4); // m
  const [lp, setLp] = useState(33); // cm
  const [ap, setAp] = useState(33); // cm
  const [junta, setJunta] = useState<number>(juntas[0] ?? 3); // mm
  const [waste, setWaste] = useState(10);

  // Autocorrección ante cambios de JSON (mantenemos estilo actual)
  if (tipos.length && !tipos.find((t) => t.key === tipo)) {
    setTipo(tipos[0].key);
  }
  if (juntas.length && !juntas.includes(junta)) {
    setJunta(juntas[0]);
  }

  // (C) precargar desde partida si viene deep-link
  useEffect(() => {
    if (!projectId || !partidaId) return;
    const p = getPartida(projectId, partidaId);
    if (p?.inputs) {
      const inp = p.inputs as any;
      if (typeof inp.tipo === "string") setTipo(inp.tipo);
      if (typeof inp.L === "number") setLx(inp.L);
      if (typeof inp.A === "number") setLy(inp.A);
      if (typeof inp.lp === "number") setLp(inp.lp);
      if (typeof inp.ap === "number") setAp(inp.ap);
      if (typeof inp.junta === "number") setJunta(inp.junta);
      if (typeof inp.waste === "number") setWaste(inp.waste);
    }
  }, [projectId, partidaId]);

  // Cálculo (usa tu función real si existe; si no, eco del input)
  // @ts-ignore
  const calc = C.calcRevestimientos ?? C.default ?? ((x: any) => x);
  const res = calc({
    tipo,
    L: Lx,
    A: Ly,
    pieza_cm: { LP: lp, AP: ap },
    junta_mm: junta,
    wastePct: waste,
    coeffs,
    pastina,
  });

  // --------- (B) Materiales completos (pastina + adhesivo) ----------
  const areaBase = (Lx || 0) * (Ly || 0);
  const areaConDesperdicio =
    typeof res?.piezas_con_desperdicio === "number"
      ? res.piezas_con_desperdicio
      : areaBase * (1 + (waste || 0) / 100);

  // Comienzo con lo que ya venga del cálculo
  const matAcum: Record<string, number> = {};
  if (res?.materiales && typeof res.materiales === "object") {
    for (const [k, v] of Object.entries(res.materiales)) {
      matAcum[k] = Number(v) || 0;
    }
  }
  // Si el cálculo ya trajo pastina_kg/adhesivo_kg los respetamos.
  // Si NO, intentamos leer coeficientes razonables:
  const tipoKey = tipo; // usamos la key normalizada

  // Pastina (kg/m2)
  if (typeof matAcum.pastina_kg !== "number") {
    const pKg =
      pickNumber(pastina, [[tipoKey, "por_mm", junta], [tipoKey, "kg_por_m2"], ["por_mm", junta], ["kg_por_m2"]]) ??
      pickNumber(coeffs, [[tipoKey, "pastina_kg_por_m2"], ["pastina_kg_por_m2"]]);
    if (typeof pKg === "number" && areaConDesperdicio > 0) {
      matAcum.pastina_kg = Math.round(pKg * areaConDesperdicio * 100) / 100;
    }
  }

  // Adhesivo (kg/m2)
  if (typeof matAcum.adhesivo_kg !== "number") {
    const aKg =
      pickNumber(adhesivos, [[tipoKey, "kg_por_m2"], ["kg_por_m2"]]) ??
      pickNumber(coeffs, [[tipoKey, "adhesivo_kg_por_m2"], ["adhesivo_kg_por_m2"]]);
    if (typeof aKg === "number" && areaConDesperdicio > 0) {
      matAcum.adhesivo_kg = Math.round(aKg * areaConDesperdicio * 100) / 100;
    }
  }

  // --------- Filas para la tabla (visual) ----------
  const rows: ResultRow[] = (function (): ResultRow[] {
    const out: ResultRow[] = [];
    if (res?.area_m2 != null)
      out.push({ label: "Área", qty: Math.round(res.area_m2 * 100) / 100, unit: "m²" });
    if (res?.modulo_m2 != null)
      out.push({ label: "Módulo (pieza + junta)", qty: Math.round(res.modulo_m2 * 100) / 100, unit: "m²" });
    if (res?.piezas_necesarias != null)
      out.push({ label: "Piezas necesarias", qty: Math.round(res.piezas_necesarias * 100) / 100, unit: "u" });
    if (res?.piezas_con_desperdicio != null)
      out.push({ label: "Piezas con desperdicio", qty: Math.round(res.piezas_con_desperdicio * 100) / 100, unit: "u" });
    if (res?.cajas != null)
      out.push({ label: "Cajas", qty: Math.round(res.cajas * 100) / 100, unit: "u" });

    // Si el cálculo ya traía pastina/adhesivo, quedan cubiertos más abajo.
    // Volcamos matAcum (pastina/adhesivo u otros)
    for (const [k, v] of Object.entries(matAcum)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      out.push({
        label: k === "pastina_kg" ? "Pastina" : k === "adhesivo_kg" ? "Adhesivo" : k,
        qty: Math.round(v * 100) / 100,
        unit: k.endsWith("_kg") ? "kg" : "u",
      });
    }
    return out;
  })();

  // --------- Ítems para Proyecto (MaterialRow[]) ----------
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const list: MaterialRow[] = [];

    // Piezas / Cajas si vienen
    if (typeof res?.cajas === "number") {
      list.push({
        key: "cajas",
        label: "Cajas",
        qty: Math.round(res.cajas * 100) / 100,
        unit: "u",
      });
    } else if (typeof res?.piezas_con_desperdicio === "number") {
      list.push({
        key: "piezas",
        label: "Piezas",
        qty: Math.round(res.piezas_con_desperdicio * 100) / 100,
        unit: "u",
      });
    }

    // Pastina / Adhesivo (desglosado)
    if (typeof matAcum.pastina_kg === "number") {
      list.push({
        key: "pastina_kg",
        label: "Pastina",
        qty: Math.round(matAcum.pastina_kg * 100) / 100,
        unit: "kg",
      });
    }
    if (typeof matAcum.adhesivo_kg === "number") {
      list.push({
        key: "adhesivo_kg",
        label: "Adhesivo",
        qty: Math.round(matAcum.adhesivo_kg * 100) / 100,
        unit: "kg",
      });
    }

    // Normalizo units → Unit
    return list.map((m) => ({ ...m, unit: normalizeUnit(m.unit as unknown as string) }));
  }, [res?.cajas, res?.piezas_con_desperdicio, matAcum.pastina_kg, matAcum.adhesivo_kg]);

  const defaultTitle = `Revestimiento ${Lx}×${Ly} m · pieza ${lp}×${ap} cm · junta ${junta} mm`;

  // ------------------- (A) Lote local -------------------
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const item: BatchItem = {
      kind: "revestimiento",
      title: defaultTitle,
      materials: itemsForProject,
      inputs: { tipo, L: Lx, A: Ly, lp, ap, junta, waste },
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
    setTipo(it.inputs.tipo);
    setLx(it.inputs.L);
    setLy(it.inputs.A);
    setLp(it.inputs.lp);
    setAp(it.inputs.ap);
    setJunta(it.inputs.junta);
    setWaste(it.inputs.waste);
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // ------------------- (C) Actualizar partida -------------------
  const handleUpdatePartida = () => {
    if (!projectId || !partidaId) return;
    updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: { tipo, L: Lx, A: Ly, lp, ap, junta, waste },
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Revestimientos</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              Tipo
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2"
              >
                {tipos.map((t, i) => (
                  <option key={`${t.key}-${i}`} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Largo (m)
              <input
                type="number"
                value={Lx}
                onChange={(e) => setLx(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Ancho (m)
              <input
                type="number"
                value={Ly}
                onChange={(e) => setLy(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Largo pieza (cm)
              <input
                type="number"
                value={lp}
                onChange={(e) => setLp(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Ancho pieza (cm)
              <input
                type="number"
                value={ap}
                onChange={(e) => setAp(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Junta (mm)
              <select
                value={junta}
                onChange={(e) => setJunta(+e.target.value)}
                className="w-full px-3 py-2"
              >
                {juntas.map((j, i) => (
                  <option key={`j-${j}-${i}`} value={j}>
                    {j} mm
                  </option>
                ))}
              </select>
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
        </div>

        {/* Card: Resultado + Acciones */}
        <div className="space-y-4">
          <ResultTable title="Resultado" items={rows} />

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

          <AddToProject
            kind="revestimiento"
            defaultTitle={defaultTitle}
            items={itemsForProject}
            raw={res}
          />
        </div>
      </div>

      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Revestimientos)</h2>
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
        </div>
      )}
    </section>
  );
}

// Este es el componente de página que se exporta por defecto.
// Envuelve el calculador en <Suspense> para evitar el error de build.
export default function RevestimientosPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <RevestimientosCalculator />
    </Suspense>
  );
}