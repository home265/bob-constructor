"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore – desacoplado de la firma exacta
import * as C from "@/lib/calc/revoque";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";

// (A) lote local
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow, Unit } from "@/lib/project/types";

// (B) labels/units conocidos
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";

// (C) edición / deep-link
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

type RevoqueOptionsFile = {
  lados?: { id?: string; label?: string }[];
  terminaciones_ids?: string[];
  hidrofugo?: boolean;
};

// Mapa de IDs → etiqueta legible
const TERM_LABELS: Record<string, string> = {
  revoque_grueso: "Revoque grueso",
  revoque_fino: "Revoque fino",
  revoque_grueso_fino: "Revoque grueso + fino",
  revoque_grueso_yeso: "Revoque grueso + enlucido de yeso",
  yeso_engrosado_enlucido: "Yeso (engrosado y enlucido)",
  yeso_enlucido: "Yeso (enlucido)",
};

type LadoKey = "uno" | "dos" | "ambos";
type Morteros = Record<string, any> | any[];

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

function RevoqueCalculator() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  const opts = useJson<RevoqueOptionsFile>("/data/revoque_options.json", {
    lados: [
      { id: "uno", label: "Un lado" },
      { id: "ambos", label: "Ambos lados" },
    ],
    terminaciones_ids: [
      "revoque_grueso",
      "revoque_fino",
      "revoque_grueso_fino",
      "revoque_grueso_yeso",
      "yeso_engrosado_enlucido",
      "yeso_enlucido",
    ],
    hidrofugo: true,
  });

  // Morteros (para desglosar cemento/cal/arena/agua)
  const morteros = useJson<Morteros>("/data/mortars.json", {});

  // Normalizo lados
  const ladosOpts = useMemo(
    () =>
      Array.isArray(opts.lados)
        ? opts.lados.map((l, i) => ({
            key: (l?.id as LadoKey) ?? (`lado_${i}` as LadoKey),
            label: l?.label ?? `Opción ${i + 1}`,
          }))
        : [],
    [opts.lados]
  );

  // Normalizo terminaciones_ids → {key,label}
  const terminaciones = useMemo(
    () =>
      Array.isArray(opts.terminaciones_ids)
        ? opts.terminaciones_ids.map((id, i) => ({
            key: id ?? `t_${i}`,
            label: TERM_LABELS[id] ?? id ?? `Opción ${i + 1}`,
          }))
        : [],
    [opts.terminaciones_ids]
  );

  // Estado + autocorrección
  const [lado, setLado] = useState<LadoKey>(
    (ladosOpts[0]?.key as LadoKey) ?? "uno"
  );
  const [term1, setTerm1] = useState<string>(terminaciones[0]?.key ?? "");
  const [term2, setTerm2] = useState<string>(terminaciones[1]?.key ?? "");
  const [L, setL] = useState(4);   // m
  const [H, setH] = useState(2.7); // m
  const [e, setE] = useState(2.5); // cm
  const [waste, setWaste] = useState(10); // %

  useEffect(() => {
    if (ladosOpts.length && !ladosOpts.find((l) => l.key === lado)) {
      setLado(ladosOpts[0].key as LadoKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladosOpts]);

  useEffect(() => {
    if (terminaciones.length && !terminaciones.find((t) => t.key === term1)) {
      setTerm1(terminaciones[0].key);
    }
    if (
      lado === "ambos" &&
      terminaciones.length &&
      term2 &&
      !terminaciones.find((t) => t.key === term2)
    ) {
      setTerm2(terminaciones[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminaciones, lado]);

  // (C) precargar desde partida si viene deep-link (async)
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const p = await getPartida(projectId, partidaId);
      if (!p?.inputs) return;
      const inp = p.inputs as any;
      if (inp.lados) setLado(inp.lados);
      if (inp.term1) setTerm1(inp.term1);
      if (inp.term2) setTerm2(inp.term2);
      if (typeof inp.L === "number") setL(inp.L);
      if (typeof inp.H === "number") setH(inp.H);
      if (typeof inp.e_cm === "number") setE(inp.e_cm);
      if (typeof inp.wastePct === "number") setWaste(inp.wastePct);
    })();
  }, [projectId, partidaId]);

  // Cálculo
  const calc: any =
    // @ts-ignore
    C.calcRevoque ?? C.default ?? ((x: any) => x);

  const res = calc({
    lados: lado, // "uno" | "dos" | "ambos"
    term1,
    term2: lado === "ambos" ? term2 : "",
    L,
    H,
    e_cm: e,
    wastePct: waste,
  });

  // --------- (B) Materiales completos: desglosar mortero ----------
  const area = (L || 0) * (H || 0) * (lado === "ambos" ? 2 : 1);
  const mortVol =
    (typeof res?.mortero_con_desperdicio_m3 === "number" && res.mortero_con_desperdicio_m3) ??
    (typeof res?.mortero_m3 === "number" ? res.mortero_m3 : 0);

  // Acumulo lo que ya venga del cálculo
  const matAcum: Record<string, number> = {};
  if (res?.materiales && typeof res.materiales === "object") {
    for (const [k, v] of Object.entries(res.materiales)) {
      matAcum[k] = Number(v) || 0;
    }
  }

  // Identificar mortero a partir del propio resultado o de la terminación
  const resMortarId = (res as any)?.mortero_id as string | undefined;

  let mortarIdToUse: string | undefined;
  if (resMortarId) {
    mortarIdToUse = resMortarId;
  } else if (lado !== "ambos" || term1 === term2) {
    // Un solo tipo de terminación → puedo asociar 1 mortero
    mortarIdToUse = term1;
  }

  const findMortar = (id?: string) => {
    if (!id) return undefined;
    if (Array.isArray(morteros)) return morteros.find((m: any) => m?.id === id);
    return (morteros as any)[id] || undefined;
  };

  const mortar = findMortar(mortarIdToUse);

  if (mortVol > 0 && mortar) {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (typeof mortar.bolsas_cemento_por_m3 === "number")
      matAcum.cemento_bolsas =
        round2((matAcum.cemento_bolsas || 0) + mortVol * mortar.bolsas_cemento_por_m3);

    if (typeof mortar.kg_cal_por_m3 === "number")
      matAcum.cal_kg = round2((matAcum.cal_kg || 0) + mortVol * mortar.kg_cal_por_m3);

    if (typeof mortar.agua_l_por_m3 === "number")
      matAcum.agua_l = round2((matAcum.agua_l || 0) + mortVol * mortar.agua_l_por_m3);

    if (typeof mortar.arena_m3_por_m3 === "number") {
      matAcum.arena_m3 =
        round2((matAcum.arena_m3 || 0) + mortVol * mortar.arena_m3_por_m3);
    } else {
      const p = mortar.proporcion || {};
      const total = (p.cemento ?? 0) + (p.cal ?? 0) + (p.arena ?? 0);
      if (total > 0) {
        const arenaFrac = (p.arena ?? 0) / total;
        matAcum.arena_m3 = round2((matAcum.arena_m3 || 0) + mortVol * arenaFrac);
      }
    }
  }

  // Filas para la tabla (solo visual)
  const rows: ResultRow[] = (function () {
    const out: ResultRow[] = [];
    if (res?.area_m2 != null)
      out.push({ label: "Área", qty: Math.round(res.area_m2 * 100) / 100, unit: "m²" });
    else
      out.push({ label: "Área", qty: Math.round(area * 100) / 100, unit: "m²" });

    if (res?.espesor_cm != null)
      out.push({ label: "Espesor", qty: Math.round(res.espesor_cm * 100) / 100, unit: "cm" });
    else
      out.push({ label: "Espesor", qty: Math.round(e * 100) / 100, unit: "cm" });

    if (mortVol > 0)
      out.push({ label: "Mortero", qty: Math.round(mortVol * 100) / 100, unit: "m³" });

    // volcamos desglose de materiales
    for (const [k, v] of Object.entries(matAcum)) {
      const qty = Math.round((Number(v) || 0) * 100) / 100;
      out.push({ label: keyToLabel(k), qty, unit: keyToUnit(k) });
    }

    // terminaciones (texto como nota simple)
    const t1 = TERM_LABELS[term1] ?? term1;
    const t2 = TERM_LABELS[term2] ?? term2;
    out.push({
      label: "Terminaciones",
      qty: lado === "ambos" ? (t1 === t2 ? 2 : 1) : 1,
      unit: lado === "ambos" ? (t1 === t2 ? `(${t1} ambos lados)` : `(${t1} + ${t2})`) : `(${t1})`,
    });

    return out;
  })();

  // Ítems para Proyecto (MaterialRow[])
  const itemsForProject: MaterialRow[] = useMemo(() => {
    const list: MaterialRow[] = [];

    if (mortVol > 0) {
      list.push({
        key: "mortero_revoque_m3",
        label: "Mortero de revoque",
        qty: Math.round(mortVol * 100) / 100,
        unit: "m3",
      });
    }

    for (const [k, v] of Object.entries(matAcum)) {
      list.push({
        key: k,
        label: keyToLabel(k),
        qty: Math.round((Number(v) || 0) * 100) / 100,
        unit: normalizeUnit(keyToUnit(k) as string),
      });
    }

    return list;
  }, [mortVol, matAcum]);

  const defaultTitle =
    `Revoque ${L}×${H} m` + (lado === "ambos" ? " (ambos lados)" : " (un lado)");

  // (A) Lote local
  type BatchItem = {
    kind: "revoque";
    title: string;
    materials: MaterialRow[];
    inputs: {
      lados: LadoKey;
      term1: string;
      term2?: string;
      L: number;
      H: number;
      e_cm: number;
      wastePct: number;
    };
    outputs: Record<string, any>;
  };

  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const item: BatchItem = {
      kind: "revoque",
      title: defaultTitle,
      materials: itemsForProject,
      inputs: {
        lados: lado,
        term1,
        term2: lado === "ambos" ? term2 : "",
        L,
        H,
        e_cm: e,
        wastePct: waste,
      },
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
    setLado(it.inputs.lados);
    setTerm1(it.inputs.term1);
    setTerm2(it.inputs.term2 || "");
    setL(it.inputs.L);
    setH(it.inputs.H);
    setE(it.inputs.e_cm);
    setWaste(it.inputs.wastePct);
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // (C) Actualizar partida (si venimos por deep-link)
  const handleUpdatePartida = async () => {
    if (!projectId || !partidaId) return;
    await updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: {
        lados: lado,
        term1,
        term2: lado === "ambos" ? term2 : "",
        L,
        H,
        e_cm: e,
        wastePct: waste,
      },
      outputs: res as any,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Revoque</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              Lados a revocar
              <select
                value={lado}
                onChange={(e) => setLado(e.target.value as LadoKey)}
                className="w-full px-3 py-2"
              >
                {ladosOpts.map((l, i) => (
                  <option key={`${l.key}-${i}`} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm col-span-2">
              Terminación lado 1
              <select
                value={term1}
                onChange={(e) => setTerm1(e.target.value)}
                className="w-full px-3 py-2"
              >
                {terminaciones.map((t, i) => (
                  <option key={`${t.key}-${i}`} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            {lado === "ambos" && (
              <label className="text-sm col-span-2">
                Terminación lado 2
                <select
                  value={term2}
                  onChange={(e) => setTerm2(e.target.value)}
                  className="w-full px-3 py-2"
                >
                  {terminaciones.map((t, i) => (
                    <option key={`t2-${t.key}-${i}`} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm">
              Longitud (m)
              <input
                type="number"
                value={L}
                onChange={(e) => setL(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Altura (m)
              <input
                type="number"
                value={H}
                onChange={(e) => setH(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm col-span-2">
              Espesor (cm)
              <input
                type="number"
                value={e}
                onChange={(e2) => setE(+e2.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>

            <label className="text-sm col-span-2">
              Desperdicio (%)
              <input
                type="number"
                value={waste}
                onChange={(e2) => setWaste(+e2.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>
        </div>

        {/* Card: Resultado + Acciones */}
        <div className="space-y-4">
          <div className="card p-4 card--table">
            <ResultTable title="Resultado" items={rows} />
            {/* Leyenda de proporción/agua si se identificó mortero */}
            {(() => {
              if (!mortar) return null;
              const p = mortar?.proporcion;
              const agua = mortar?.agua_l_por_m3;
              if (!p && typeof agua !== "number") return null;
              return (
                <p className="text-xs text-gray-500 mt-2">
                  Proporción mortero (cemento:cal:arena):{" "}
                  <b>{p?.cemento ?? 0} : {p?.cal ?? 0} : {p?.arena ?? 0}</b>
                  {typeof agua === "number" ? <> · Agua de referencia: <b>{agua} L/m³</b></> : null}
                </p>
              );
            })()}
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

          <AddToProject
            kind="revoque"
            defaultTitle={defaultTitle}
            items={itemsForProject}
            raw={res}
          />
        </div>
      </div>

      {/* (A) Lote local */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Revoque)</h2>
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
export default function RevoquePage() {
  return (
    <Suspense fallback={<div>Cargando calculadora...</div>}>
      <RevoqueCalculator />
    </Suspense>
  );
}
