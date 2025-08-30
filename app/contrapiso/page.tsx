"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/contrapiso";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow, Unit } from "@/lib/project/types";
import { toUnit } from "@/lib/project/helpers";

// Deep-link edición
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";
import HelpPopover from "@/components/ui/HelpPopover";

/* ----------------------------- Tipos de datos ----------------------------- */
type CptoOptions = {
  tipos?: { key?: string; label?: string }[];
  mallas?: { key?: string; label?: string }[];
};
type CptoCoeffs = Array<{
  tipo: string;
  volumen_por_m2_por_cm: number;
  desperdicio_pct_default?: number;
  // por m3 de contrapiso:
  agregado_rodado_m3_por_m3?: number;
  arena_m3_por_m3?: number;
  cemento_bolsas_por_m3?: number;
  agua_l_por_m3?: number;
  // malla:
  malla_por_tipo?: Record<string, { m2_por_m2?: number }>;
}>;

// Resultado mínimo que usamos desde el módulo de cálculo
type ContrapisoResult = {
  area_m2?: number;
  espesor_cm?: number;
  volumen_m3?: number;
  volumen_con_desperdicio_m3?: number;
  malla_m2?: number;
  materiales?: Record<string, number>;
  // permitir campos extra sin any
  [k: string]: unknown;
};

// Inputs que guardamos en la partida
type SavedInputs = {
  tipo: string;
  L: number;
  A: number;
  H: number;     // cm
  malla: string; // key o ""
  waste: number; // %
};

// Lote local
type BatchItem = {
  kind: "contrapiso";
  title: string;
  materials: MaterialRow[];
  inputs: SavedInputs;
  outputs: Record<string, unknown>;
};

/* ------------------------------- Componente ------------------------------- */
function ContrapisoCalculator() {
  // Deep-link edición
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  // opciones & coeficientes desde JSON (con fallback)
  const options = useJson<CptoOptions>("/data/contrapiso_options.json", {
    tipos: [
      { key: "cascote_terreno", label: "Cascote sobre terreno" },
      { key: "cascote_losa", label: "Cascote sobre losa" },
      { key: "armado", label: "Contrapiso armado" },
    ],
    mallas: [{ key: "sima_q188", label: "SIMA Q-188 (15x15 Ø6)" }],
  });
  const coeffs = useJson<CptoCoeffs>("/data/contrapiso_coeffs.json", []);

  // normalizo arrays (garantizo key/label siempre)
  const tipos = useMemo(
    () =>
      Array.isArray(options.tipos)
        ? options.tipos.map((t, i) => ({
            key: t?.key ?? `tipo_${i}`,
            label: t?.label ?? `Opción ${i + 1}`,
          }))
        : [],
    [options.tipos]
  );
  const mallas = useMemo(
    () =>
      Array.isArray(options.mallas)
        ? options.mallas.map((m, i) => ({
            key: m?.key ?? `malla_${i}`,
            label: m?.label ?? `Malla ${i + 1}`,
          }))
        : [],
    [options.mallas]
  );

  // inputs básicos
  const [tipo, setTipo] = useState(tipos[0]?.key ?? "cascote_terreno");
  const [L, setL] = useState(4); // m
  const [A, setA] = useState(3); // m
  const [H, setH] = useState(8); // cm
  const [malla, setMalla] = useState(mallas[0]?.key ?? "");
  const [waste, setWaste] = useState(10); // %

  // si cambian opciones y la selección actual ya no existe, ajusto
  useEffect(() => {
    if (tipos.length && !tipos.find((t) => t.key === tipo)) {
      setTipo(tipos[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos]);
  useEffect(() => {
    if (mallas.length && malla && !mallas.find((m) => m.key === malla)) {
      setMalla(mallas[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mallas]);

  // Precarga si viene deep-link: leer partida (async)
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const p = await getPartida(projectId, partidaId);
      if (!p?.inputs) return;
      const inp = p.inputs as Partial<SavedInputs>;
      if (typeof inp.tipo === "string") setTipo(inp.tipo);
      if (typeof inp.L === "number") setL(inp.L);
      if (typeof inp.A === "number") setA(inp.A);
      if (typeof inp.H === "number") setH(inp.H);
      if (typeof inp.malla === "string") setMalla(inp.malla);
      if (typeof inp.waste === "number") setWaste(inp.waste);
    })();
  }, [projectId, partidaId]);

  // cálculo (intento calcContrapiso, si no default; si no, objeto vacío)
  const r: ContrapisoResult = useMemo(() => {
    const input = { tipo, L, A, Hcm: H, malla, wastePct: waste, coeffs };
    type CalcFn = (i: typeof input) => ContrapisoResult;
    const mod = C as unknown as { calcContrapiso?: CalcFn; default?: CalcFn };
    const fn: CalcFn | undefined = typeof mod.calcContrapiso === "function"
      ? mod.calcContrapiso
      : typeof mod.default === "function"
        ? mod.default
        : undefined;
    return fn ? fn(input) : {};
  }, [tipo, L, A, H, malla, waste, coeffs]);

  // valores geométricos auxiliares
  const area_m2: number | undefined =
    typeof r.area_m2 === "number" ? r.area_m2 : (L || 0) * (A || 0);

  const volumen_m3: number = (() => {
    if (typeof r.volumen_con_desperdicio_m3 === "number")
      return r.volumen_con_desperdicio_m3;
    if (typeof r.volumen_m3 === "number") return r.volumen_m3;
    // fallback geométrico con desperdicio
    const base = (L || 0) * (A || 0) * (H || 0) / 100; // H en cm → m
    return base * (1 + (waste || 0) / 100);
  })();

  const tipoCoef = useMemo(
    () => (Array.isArray(coeffs) ? coeffs.find((c) => c.tipo === tipo) : undefined),
    [coeffs, tipo]
  );

  // desglosado de materiales acumulado
  const matAcum: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    if (r.materiales && typeof r.materiales === "object") {
      for (const [k, v] of Object.entries(r.materiales)) {
        out[k] = typeof v === "number" && Number.isFinite(v) ? v : 0;
      }
    }
    // completa por coeficientes (por m3)
    if (tipoCoef && volumen_m3 > 0) {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      if (typeof tipoCoef.cemento_bolsas_por_m3 === "number")
        out.cemento_bolsas = round2(
          (out.cemento_bolsas || 0) + volumen_m3 * tipoCoef.cemento_bolsas_por_m3
        );
      if (typeof tipoCoef.arena_m3_por_m3 === "number")
        out.arena_m3 = round2(
          (out.arena_m3 || 0) + volumen_m3 * tipoCoef.arena_m3_por_m3
        );
      if (typeof tipoCoef.agregado_rodado_m3_por_m3 === "number")
        out.agregado_rodado_m3 = round2(
          (out.agregado_rodado_m3 || 0) + volumen_m3 * tipoCoef.agregado_rodado_m3_por_m3
        );
      if (typeof tipoCoef.agua_l_por_m3 === "number")
        out.agua_l = round2(
          (out.agua_l || 0) + volumen_m3 * tipoCoef.agua_l_por_m3
        );
    }
    // malla (si el cálculo no la dio y hay coeficiente por m2)
    if (typeof r.malla_m2 !== "number" && tipoCoef?.malla_por_tipo && area_m2) {
      const mCfg = tipoCoef.malla_por_tipo[malla || ""] || undefined;
      if (mCfg?.m2_por_m2 && mCfg.m2_por_m2 > 0) {
        out.malla_sima = Math.round(area_m2 * mCfg.m2_por_m2 * 100) / 100;
      }
    }
    return out;
  }, [r.materiales, r.malla_m2, tipoCoef, volumen_m3, area_m2, malla]);

  // filas para tabla (solo números)
  const rows: ResultRow[] = useMemo(() => {
    const out: ResultRow[] = [];
    if (typeof area_m2 === "number")
      out.push({ label: "Área", qty: Math.round(area_m2 * 100) / 100, unit: "m²" });
    if (typeof r.espesor_cm === "number")
      out.push({ label: "Espesor", qty: Math.round(r.espesor_cm * 100) / 100, unit: "cm" });
    if (typeof volumen_m3 === "number" && volumen_m3 > 0)
      out.push({ label: "Volumen", qty: Math.round(volumen_m3 * 100) / 100, unit: "m³" });

    // malla resultante del cálculo (si vino)
    if (typeof r.malla_m2 === "number" && r.malla_m2 > 0)
      out.push({ label: "Malla SIMA", qty: Math.round(r.malla_m2 * 100) / 100, unit: "m²" });

    // desglosado completo
    for (const [k, v] of Object.entries(matAcum)) {
      const qty = Math.round((Number(v) || 0) * 100) / 100;
      out.push({ label: keyToLabel(k), qty, unit: keyToUnit(k) });
    }
    return out;
  }, [area_m2, r.espesor_cm, volumen_m3, r.malla_m2, matAcum]);

  // materiales para Proyecto (MaterialRow[])
  const itemsForProject = useMemo<MaterialRow[]>(() => {
    const list: MaterialRow[] = [];
    for (const [k, v] of Object.entries(matAcum)) {
      list.push({
        key: k,
        label: keyToLabel(k),
        qty: Math.round((Number(v) || 0) * 100) / 100,
        unit: toUnit(keyToUnit(k)),
      });
    }
    // si el cálculo trajo malla en m², la agrego como material (clave estable)
    if (typeof r.malla_m2 === "number" && r.malla_m2 > 0) {
      list.push({
        key: "malla_sima",
        label: "Malla SIMA",
        qty: Math.round(r.malla_m2 * 100) / 100,
        unit: "m2",
      });
    }
    return list;
  }, [matAcum, r.malla_m2]);

  // título por defecto para la partida
  const defaultTitle = useMemo(() => {
    const mallaTxt = malla
      ? ` · ${mallas.find((x) => x.key === malla)?.label ?? "malla"}`
      : "";
    return `Contrapiso ${L}×${A} m · e=${H} cm · ${tipo}${mallaTxt}`;
  }, [L, A, H, tipo, malla, mallas]);

  // Lote local
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const materials: MaterialRow[] = itemsForProject.map((m) => ({
      ...m,
      unit: toUnit(m.unit as unknown as string),
    }));
    const outputs = r as unknown as Record<string, unknown>;
    const item: BatchItem = {
      kind: "contrapiso",
      title: defaultTitle,
      materials,
      inputs: { tipo, L, A, H, malla, waste },
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
    setL(it.inputs.L);
    setA(it.inputs.A);
    setH(it.inputs.H);
    setMalla(it.inputs.malla);
    setWaste(it.inputs.waste);
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // Actualizar partida (modo edición)
  const handleUpdatePartida = async () => {
    if (!projectId || !partidaId) return;
    const materials: MaterialRow[] = itemsForProject.map((m) => ({
      ...m,
      unit: toUnit(m.unit as unknown as string),
    }));
    const outputs = r as unknown as Record<string, unknown>;
    await updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: { tipo, L, A, H, malla, waste },
      outputs,
      materials,
    });
    // feedback mínimo
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Contrapiso</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span>Tipo</span>
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

            {!!mallas.length && (
              <label className="text-sm col-span-2">
                <span>Malla SIMA</span>
                <select
                  value={malla}
                  onChange={(e) => setMalla(e.target.value)}
                  className="w-full px-3 py-2"
                >
                  <option key="malla_none" value="">
                    — Sin malla —
                  </option>
                  {mallas.map((m, i) => (
                    <option key={`${m.key}-${i}`} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm col-span-2">
              <span className="flex items-center">
                Desperdicio (%)
                <HelpPopover>
                  Este porcentaje agrega material extra para cubrir pérdidas por cortes, roturas o errores durante la obra. Un valor común es entre 5% y 15%.
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
              title={editIndex !== null ? "Guardar ítem del lote" : "Añadir contrapiso al lote"}
            >
              {editIndex !== null ? "Guardar ítem del lote" : "Añadir contrapiso al lote"}
            </button>
            {/* --- AYUDA AÑADIDA AQUÍ --- */}
            <HelpPopover>
              La función 'Lote' te permite calcular varios contrapisos (ej: uno para la cocina, otro para el baño) y luego guardarlos todos juntos en tu proyecto en un solo paso. Es ideal para cómputos rápidos de múltiples sectores.
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

          {/* Si estamos editando una partida: botón actualizar */}
          {projectId && partidaId ? (
            <div className="mt-3">
              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={handleUpdatePartida}
              >
                Actualizar partida
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Contrapiso)</h2>
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

      {/* Guardar en Proyecto (unitario) */}
      {itemsForProject.length > 0 && (
        // --- AYUDA AÑADIDA EN EL TÍTULO DE ESTA TARJETA ---
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold flex items-center">
            Guardar en proyecto
            <HelpPopover>
              Cada cálculo que realizas (un muro, un contrapiso, etc.) se guarda como una 'partida' dentro del proyecto que creaste al inicio. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo sobre la marcha.
            </HelpPopover>
          </h3>
          <AddToProject
            kind="contrapiso"
            defaultTitle={defaultTitle}
            items={itemsForProject}
            raw={r as Record<string, unknown>}
          />
        </div>
      )}
    </section>
  );
}

// Página con Suspense para que useSearchParams no rompa en build
export default function ContrapisoPage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <ContrapisoCalculator />
    </Suspense>
  );
}
