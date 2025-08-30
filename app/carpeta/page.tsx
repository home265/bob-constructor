"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/carpeta";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow } from "@/lib/project/types";
import { toUnit } from "@/lib/project/helpers";
import { getPartida, updatePartida } from "@/lib/project/storage";
import HelpPopover from "@/components/ui/HelpPopover";

/* ----------------------------- Tipos de datos ----------------------------- */
type CarpetaOptionsFile = {
  mezclas?: { id?: string; label?: string }[];
  hidrofugo?: boolean | { key?: string; label?: string }[];
};

type MixMap = Record<string, string | Record<string, string>>;

type MortarDef = {
  id?: string;
  bolsas_cemento_por_m3?: number;
  kg_cal_por_m3?: number;
  agua_l_por_m3?: number;
  arena_m3_por_m3?: number;
  proporcion?: { cemento?: number; cal?: number; arena?: number };
};

type Morteros = MortarDef[] | Record<string, MortarDef>;

type CarpetaResult = {
  area_m2?: number;
  espesor_cm?: number;
  volumen_m3?: number;
  volumen_con_desperdicio_m3?: number;
  mortero_id?: string;
  materiales?: Record<string, number>;
  [k: string]: unknown;
};

type SavedInputs = {
  tipo: string;
  hidro: string;
  L: number;
  A: number;
  H: number;     // cm
  waste: number; // %
};

type BatchItem = {
  kind: "carpeta";
  title: string;
  materials: MaterialRow[];
  inputs: SavedInputs;
  outputs: Record<string, unknown>;
};

/* ------------------------------- Componente ------------------------------- */
function CarpetaCalculator() {
  const options = useJson<CarpetaOptionsFile>("/data/carpeta_options.json", {
    mezclas: [
      { id: "1_3", label: "Cemento 1:3" },
      { id: "1_4", label: "Cemento 1:4" },
      { id: "1_2_6", label: "Cemento y cal 1:2:6" },
    ],
    hidrofugo: true,
  });
  const mixMap = useJson<MixMap>("/data/carpeta_mix_map.json", {});
  const morteros = useJson<Morteros>("/data/mortars.json", {});

  // deep-link edición (?projectId & ?partidaId)
  const search = useSearchParams();
  const projectId = search.get("projectId");
  const partidaId = search.get("partidaId");
  const isEditMode = !!(projectId && partidaId);

  // Normalizo "mezclas" -> tipos {key,label}
  const tipos = useMemo(
    () =>
      Array.isArray(options.mezclas)
        ? options.mezclas.map((m, i) => ({
            key: m?.id ?? `mix_${i}`,
            label: m?.label ?? `Mezcla ${i + 1}`,
          }))
        : [],
    [options.mezclas]
  );

  // Normalizo hidrófugo
  const hidros = useMemo(() => {
    const h = options.hidrofugo;
    if (Array.isArray(h)) {
      return h.map((x, i) => ({
        key: x?.key ?? `hidro_${i}`,
        label: x?.label ?? `Opción ${i + 1}`,
      }));
    }
    if (h === true) {
      return [
        { key: "no", label: "Sin hidrófugo" },
        { key: "si", label: "Con hidrófugo" },
      ];
    }
    return [];
  }, [options.hidrofugo]);

  // Estado con fallback + autocorrección si cambian las opciones
  const [tipo, setTipo] = useState<string>(tipos[0]?.key ?? "1_3");
  const [hidro, setHidro] = useState<string>(hidros[0]?.key ?? "no");
  const [L, setL] = useState(4);
  const [A, setA] = useState(3);
  const [H, setH] = useState(3); // cm
  const [waste, setWaste] = useState(10);

  // Precargar si viene ?projectId&partidaId (async)
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const part = await getPartida(projectId, partidaId);
      if (!part?.inputs) return;
      const inp = part.inputs as Partial<SavedInputs>;
      if (typeof inp.tipo === "string") setTipo(inp.tipo);
      if (typeof inp.hidro === "string") setHidro(inp.hidro);
      if (typeof inp.L === "number") setL(inp.L);
      if (typeof inp.A === "number") setA(inp.A);
      if (typeof inp.H === "number") setH(inp.H); // ya guardamos H en cm
      if (typeof inp.waste === "number") setWaste(inp.waste);
    })();
  }, [projectId, partidaId]);

  useEffect(() => {
    if (tipos.length && !tipos.find((t) => t.key === tipo)) {
      setTipo(tipos[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos]);

  useEffect(() => {
    if (hidros.length && !hidros.find((h) => h.key === hidro)) {
      setHidro(hidros[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidros]);

  // Entrada para cálculo y función desacoplada
  const input = useMemo(
    () => ({ tipo, hidro, L, A, Hcm: H, wastePct: waste, mixMap, morteros }),
    [tipo, hidro, L, A, H, waste, mixMap, morteros]
  );

  type CalcInput = typeof input;
  type CalcFn = (arg: CalcInput) => CarpetaResult;
  const r: CarpetaResult = useMemo(() => {
    const mod = C as unknown as { calcCarpeta?: CalcFn; default?: CalcFn };
    const fn: CalcFn | undefined =
      typeof mod.calcCarpeta === "function"
        ? mod.calcCarpeta
        : typeof mod.default === "function"
          ? mod.default
          : undefined;
    return fn ? fn(input) : {};
  }, [input]);

  // ---- Filas para la tabla (sin 'key', qty:number)
  const rows: ResultRow[] = useMemo(() => {
    const out: ResultRow[] = [];
    if (typeof r.area_m2 === "number")
      out.push({ label: "Área", qty: Math.round(r.area_m2 * 100) / 100, unit: "m²" });
    if (typeof r.espesor_cm === "number")
      out.push({ label: "Espesor", qty: Math.round(r.espesor_cm * 100) / 100, unit: "cm" });

    const vol = typeof r.volumen_con_desperdicio_m3 === "number"
      ? r.volumen_con_desperdicio_m3
      : (typeof r.volumen_m3 === "number" ? r.volumen_m3 : 0);

    if (vol > 0)
      out.push({ label: "Volumen", qty: Math.round(vol * 100) / 100, unit: "m³" });

    const mat: Record<string, number> = {};
    if (r.materiales && typeof r.materiales === "object") {
      for (const [k, v] of Object.entries(r.materiales)) {
        mat[k] = Number(v) || 0;
      }
    }

    // identificar mortero y desglosar por m³
    const mortarIdFromRes = r.mortero_id;
    const mm = mixMap as MixMap;
    const mortarId = mortarIdFromRes ?? (() => {
      const m = mm[tipo];
      if (!m) return undefined;
      return typeof m === "string" ? m : m[hidro] ?? Object.values(m)[0];
    })();

    const mortDB = morteros as Morteros;
    const mortar: MortarDef | undefined = (() => {
      if (!mortarId) return undefined;
      return Array.isArray(mortDB)
        ? mortDB.find((m) => m.id === mortarId)
        : mortDB[mortarId];
    })();

    if (vol > 0 && mortar) {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      if (typeof mortar.bolsas_cemento_por_m3 === "number")
        mat.cemento_bolsas = round2((mat.cemento_bolsas || 0) + vol * mortar.bolsas_cemento_por_m3);
      if (typeof mortar.kg_cal_por_m3 === "number")
        mat.cal_kg = round2((mat.cal_kg || 0) + vol * mortar.kg_cal_por_m3);
      if (typeof mortar.agua_l_por_m3 === "number")
        mat.agua_l = round2((mat.agua_l || 0) + vol * mortar.agua_l_por_m3);

      if (typeof mortar.arena_m3_por_m3 === "number") {
        mat.arena_m3 = round2((mat.arena_m3 || 0) + vol * mortar.arena_m3_por_m3);
      } else {
        const p = mortar.proporcion || {};
        const total = (p.cemento ?? 0) + (p.cal ?? 0) + (p.arena ?? 0);
        if (total > 0) {
          const arenaFrac = (p.arena ?? 0) / total;
          mat.arena_m3 = round2((mat.arena_m3 || 0) + vol * arenaFrac);
        }
      }
    }

    for (const [k, v] of Object.entries(mat)) {
      const qty = Math.round((Number(v) || 0) * 100) / 100;
      out.push({ label: keyToLabel(k), qty, unit: keyToUnit(k) });
    }

    if (r.mortero_id)
      out.push({ label: "Mortero (ID)", qty: 1, unit: keyToUnit("mortero_id") ?? "" });

    return out;
  }, [r, mixMap, morteros, tipo, hidro]);

  // ---- Materiales para Proyecto (MaterialRow[])
  const itemsForProject = useMemo<MaterialRow[]>(() => {
    const list: MaterialRow[] = [];
    const mat: Record<string, number> = {};
    if (r.materiales && typeof r.materiales === "object") {
      for (const [k, v] of Object.entries(r.materiales)) {
        mat[k] = Number(v) || 0;
      }
    }

    const vol = typeof r.volumen_con_desperdicio_m3 === "number"
      ? r.volumen_con_desperdicio_m3
      : (typeof r.volumen_m3 === "number" ? r.volumen_m3 : 0);

    const mortarIdFromRes = r.mortero_id;
    const mm = mixMap as MixMap;
    const mortarId = mortarIdFromRes ?? (() => {
      const m = mm[tipo];
      if (!m) return undefined;
      return typeof m === "string" ? m : m[hidro] ?? Object.values(m)[0];
    })();

    const mortDB = morteros as Morteros;
    const mortar: MortarDef | undefined = (() => {
      if (!mortarId) return undefined;
      return Array.isArray(mortDB)
        ? mortDB.find((m) => m.id === mortarId)
        : mortDB[mortarId];
    })();

    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (vol > 0 && mortar) {
      if (typeof mortar.bolsas_cemento_por_m3 === "number")
        mat.cemento_bolsas = round2((mat.cemento_bolsas || 0) + vol * mortar.bolsas_cemento_por_m3);
      if (typeof mortar.kg_cal_por_m3 === "number")
        mat.cal_kg = round2((mat.cal_kg || 0) + vol * mortar.kg_cal_por_m3);
      if (typeof mortar.agua_l_por_m3 === "number")
        mat.agua_l = round2((mat.agua_l || 0) + vol * mortar.agua_l_por_m3);

      if (typeof mortar.arena_m3_por_m3 === "number") {
        mat.arena_m3 = round2((mat.arena_m3 || 0) + vol * mortar.arena_m3_por_m3);
      } else {
        const p = mortar.proporcion || {};
        const total = (p.cemento ?? 0) + (p.cal ?? 0) + (p.arena ?? 0);
        if (total > 0) {
          const arenaFrac = (p.arena ?? 0) / total;
          mat.arena_m3 = round2((mat.arena_m3 || 0) + vol * arenaFrac);
        }
      }
    }

    for (const [k, v] of Object.entries(mat)) {
      list.push({
        key: k,
        label: keyToLabel(k),
        qty: Math.round((Number(v) || 0) * 100) / 100,
        unit: toUnit(keyToUnit(k)),
      });
    }
    return list;
  }, [r, mixMap, morteros, tipo, hidro]);

  // Título de partida por defecto
  const defaultTitle = useMemo(
    () => `Carpeta ${L}×${A} m · e=${H} cm · ${tipo}${hidro === "si" ? " + hidrófugo" : ""}`,
    [L, A, H, tipo, hidro]
  );

  // ------------------- Lote local -------------------
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const materials: MaterialRow[] = itemsForProject.map((m) => ({
      ...m,
      unit: toUnit(m.unit),
    }));
    const outputs = r as unknown as Record<string, unknown>;
    const item: BatchItem = {
      kind: "carpeta",
      title: defaultTitle,
      materials,
      inputs: { tipo, hidro, L, A, H, waste },
      outputs,
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
    setHidro(it.inputs.hidro);
    setL(it.inputs.L);
    setA(it.inputs.A);
    setH(it.inputs.H);
    setWaste(it.inputs.waste);
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // --------- Actualizar partida (deep-link) -----------
  const handleUpdatePartida = async () => {
    if (!projectId || !partidaId) return;
    const materials: MaterialRow[] = itemsForProject.map((m) => ({
      ...m,
      unit: toUnit(m.unit),
    }));
    const outputs = r as unknown as Record<string, unknown>;
    await updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: { tipo, hidro, L, A, H, waste },
      outputs,
      materials,
    });
    alert("Partida actualizada.");
  };

  if (!options) return null;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Carpeta</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span>Tipo de carpeta</span>
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

            {!!hidros.length && (
              <label className="text-sm col-span-2">
                <span>Hidrófugo</span>
                <select
                  value={hidro}
                  onChange={(e) => setHidro(e.target.value)}
                  className="w-full px-3 py-2"
                >
                  {hidros.map((h, i) => (
                    <option key={`${h.key}-${i}`} value={h.key}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm">
              <span>Largo (m)</span>
              <input
                type="number"
                value={L}
                onChange={(e) => setL(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span>Ancho (m)</span>
              <input
                type="number"
                value={A}
                onChange={(e) => setA(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
            <label className="text-sm col-span-2">
              <span>Espesor (cm)</span>
              <input
                type="number"
                value={H}
                onChange={(e) => setH(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
            <label className="text-sm col-span-2">
              <span className="flex items-center">
                Desperdicio (%)
                <HelpPopover>
                  Este porcentaje agrega material extra para cubrir pérdidas por irregularidades en la superficie, derrames o errores. Un valor común es entre 10% y 15%.
                </HelpPopover>
              </span>
              <input
                type="number"
                value={waste}
                onChange={(e) => setWaste(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>

          {/* Acciones lote local */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={addCurrentToBatch}
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir carpeta al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir carpeta al lote"}
            </button>
            {/* --- AYUDA AÑADIDA AQUÍ --- */}
            <HelpPopover>
              La función 'Lote' te permite calcular varias carpetas (ej: una para cada habitación) y luego guardarlas todas juntas en tu proyecto en un solo paso. Es ideal para cómputos rápidos de múltiples sectores.
            </HelpPopover>
            
            {editIndex !== null && (
              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={() => setEditIndex(null)}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </div>

        {/* Card: Resultado */}
        <div className="card p-4 card--table">
          <h2 className="font-medium mb-2">Resultado</h2>
          <ResultTable title="Resultado" items={rows} />
          {(() => {
            const mm = mixMap as MixMap;
            const mortarId =
              r.mortero_id ??
              (() => {
                const m = mm[tipo];
                if (!m) return undefined;
                return typeof m === "string" ? m : m[hidro] ?? Object.values(m)[0];
              })();
            const mortDB = morteros as Morteros;
            const mortar: MortarDef | undefined = (() => {
              if (!mortarId) return undefined;
              return Array.isArray(mortDB)
                ? mortDB.find((m) => m.id === mortarId)
                : mortDB[mortarId];
            })();

            const p = mortar?.proporcion;
            const agua = mortar?.agua_l_por_m3;

            if (!p && typeof agua !== "number") return null;

            return (
              <p className="text-xs text-gray-500 mt-2">
                Proporción mortero (cemento:cal:arena): <b>{p?.cemento ?? 0} : {p?.cal ?? 0} : {p?.arena ?? 0}</b>
                {typeof agua === "number" ? <> · Agua de referencia: <b>{agua} L/m³</b></> : null}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Carpeta)</h2>
          <BatchList
            items={batch.map((b) => ({ title: b.title }))}
            onEdit={handleEditFromBatch}
            onRemove={handleRemoveFromBatch}
          />
          <AddToProjectBatch
            items={batch.map((b) => ({
              kind: b.kind,
              title: b.title,
              materials: b.materials, // MaterialRow[]
              inputs: b.inputs,
              outputs: b.outputs,
            }))}
            onSaved={() => setBatch([])}
          />
        </div>
      )}

      {/* Guardar en Proyecto (unitario) */}
      {itemsForProject.length > 0 && (
        // --- AYUDA AÑADIDA EN EL TÍTULO DE ESTA TARJETA ---
        <div className="card p-4 space-y-3">
            <h3 className="font-semibold flex items-center">
                Guardar en proyecto
                <HelpPopover>
                  Cada cálculo que realizas se guarda como una 'partida' dentro del proyecto que creaste al inicio. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo sobre la marcha.
                </HelpPopover>
            </h3>
            <AddToProject
              kind="carpeta"
              defaultTitle={defaultTitle}
              items={itemsForProject}
              raw={r as Record<string, unknown>}
            />
        </div>
      )}

      {/* Actualizar partida (deep-link) */}
      {isEditMode && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUpdatePartida}
            className="rounded bg-black text-white px-4 py-2"
            title="Actualizar partida existente"
          >
            Actualizar partida
          </button>
        </div>
      )}
    </section>
  );
}

// Página con Suspense para que useSearchParams no rompa en build
export default function CarpetaPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <CarpetaCalculator />
    </Suspense>
  );
}
