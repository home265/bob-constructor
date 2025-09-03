"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";
import type { MaterialLine, Unit } from "@/lib/project/types";

import type { OpeningVM } from "@/components/inputs/OpeningsGroup";
import NumberWithUnit from "@/components/inputs/NumberWithUnit";
import OpeningsGroup from "@/components/inputs/OpeningsGroup";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";

import {
  loadDefaults,
  loadMortars,
  loadWallCoefficients,
  loadWallOptions,
} from "@/lib/data/catalogs";
import { computeMuros } from "@/lib/calc/muros";
import type {
  Mortar,
  WallCoefficient,
  WallFormInput,
  WallOptions,
  WallResult,
} from "@/lib/types";
import HelpPopover from "@/components/ui/HelpPopover";

const schema = z.object({
  tipoMuroId: z.enum(["simple", "doble"]),
  ladrilloId: z.string().min(1),
  juntaMm: z.number().int().nonnegative(),
  morteroAsientoId: z.string().min(1),
  L: z.number().positive(),
  H: z.number().positive(),
  SA: z.number().min(0).default(0),
  desperdicioPct: z.number().min(0).max(30).default(7),
});

type FormValues = z.infer<typeof schema>;

type BatchItem = {
  kind: "muro";
  title: string;
  materials: { key?: string; label: string; qty: number; unit: string }[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

function MurosCalculator() {
  // ---- Deep-link edición (sin useSearchParams) ----
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [partidaId, setPartidaId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const usp = new URLSearchParams(window.location.search);
    setProjectId(usp.get("projectId"));
    setPartidaId(usp.get("partidaId"));
  }, []);
  const editMode = useMemo(() => !!(projectId && partidaId), [projectId, partidaId]);

  const [opts, setOpts] = useState<WallOptions | null>(null);
  const [coeffs, setCoeffs] = useState<WallCoefficient[] | null>(null);
  const [mortars, setMortars] = useState<Mortar[] | null>(null);
  const [defaults, setDefaults] =
    useState<Awaited<ReturnType<typeof loadDefaults>> | null>(null);
  const [vanos, setVanos] = useState<OpeningVM[]>([
    { lv: 0, hv: 0 },
    { lv: 0, hv: 0 },
    { lv: 0, hv: 0 },
  ]);
  const [res, setRes] = useState<WallResult | null>(null);

  // Lote local
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoMuroId: "simple",
      L: 0,
      H: 0,
      SA: 0,
      juntaMm: 10,
      desperdicioPct: 7,
      morteroAsientoId: "",
      ladrilloId: "",
    },
  });

  useEffect(() => {
    (async () => {
      const [o, c, m, d] = await Promise.all([
        loadWallOptions(),
        loadWallCoefficients(),
        loadMortars(),
        loadDefaults(),
      ]);
      setOpts(o);
      setCoeffs(c);
      setMortars(m);
      setDefaults(d);
      if (o.morteros_asiento_ids?.length) {
        setValue("morteroAsientoId", String(o.morteros_asiento_ids[0]));
      }
      setValue("juntaMm", 10);

    })();
  }, [setValue]);

  // Precarga si venís desde Proyecto (edición)
  useEffect(() => {
    if (!editMode) return;
    (async () => {
      const p = await getPartida(projectId as string, partidaId as string);
      if (!p) return;
      const inp = (p.inputs || {}) as Partial<WallFormInput> & { vanos?: OpeningVM[] };
      if (inp.tipoMuroId === "simple" || inp.tipoMuroId === "doble") {
        setValue("tipoMuroId", inp.tipoMuroId);
      }
      if (inp.ladrilloId) setValue("ladrilloId", String(inp.ladrilloId));
      if (typeof inp.juntaMm === "number") setValue("juntaMm", inp.juntaMm);
      if (inp.morteroAsientoId) setValue("morteroAsientoId", String(inp.morteroAsientoId));
      if (typeof inp.L === "number") setValue("L", inp.L);
      if (typeof inp.H === "number") setValue("H", inp.H);
      if (typeof inp.SA === "number") setValue("SA", inp.SA);
      if (typeof (inp as Record<string, unknown>)["desperdicioPct"] === "number") {
        setValue("desperdicioPct", Number((inp as Record<string, unknown>)["desperdicioPct"]));
      }
      if (Array.isArray(inp.vanos)) setVanos(inp.vanos);
      if (p.outputs) setRes(p.outputs as WallResult);
    })();
  }, [editMode, projectId, partidaId, setValue]);

  const onSubmit = (fv: FormValues) => {
    if (!coeffs || !mortars || !defaults) return;
    const input: WallFormInput = { ...fv, vanos };
    const r = computeMuros(input, coeffs, mortars, defaults);
    setRes(r);
  };

  // Etiquetas y unidades para mapear res → filas
  const LABELS: Record<string, { label: string; unit?: string }> = {
    // áreas
    areaNeta_m2: { label: "Área de muro", unit: "m²" },
    area_m2: { label: "Área de muro", unit: "m²" }, // alias
    S_m2: { label: "Área de muro", unit: "m²" }, // alias

    // volumen de mampostería (si existiera)
    volumen_m3: { label: "Volumen (mampostería)", unit: "m³" },

    // unidades de pieza
    ladrillos_u: { label: "Unidades ladrillo/bloque", unit: "u" },
    unidades: { label: "Unidades ladrillo/bloque", unit: "u" }, // alias

    // mortero de asiento
    mortero_asiento_m3: { label: "Mortero de asiento", unit: "m³" },
    mortero_m3: { label: "Mortero de asiento", unit: "m³" }, // alias

    // desglose de mortero
    cemento_bolsas: { label: "Cemento", unit: "bolsas" },
    cal_kg: { label: "Cal", unit: "kg" },
    arena_m3: { label: "Arena", unit: "m³" },
    agua_l: { label: "Agua", unit: "l" },

    // otras
    revoque_m3: { label: "Revoque", unit: "m³" },
  };

  // Helpers
  const getNumField = (obj: Record<string, unknown>, key: string): number | null => {
    const v = obj[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  // Filas para la tabla (ResultTable) — sin 'key', qty SIEMPRE number
  const items: ResultRow[] = useMemo(() => {
    const arr: ResultRow[] = [];
    if (!res) return arr;

    const augmented: Record<string, unknown> = { ...(res as unknown as Record<string, unknown>) };
    const mortId = watch("morteroAsientoId");
    const volMort =
      getNumField(augmented, "mortero_asiento_m3") ??
      getNumField(augmented, "mortero_m3");

    if (volMort && mortars?.length) {
      const mortar = mortars.find((m) => m.id === mortId);
      const prop = (mortar && "proporcion" in mortar ? mortar.proporcion : undefined) as
        | { cemento?: number; cal?: number; arena?: number }
        | undefined;
      const total = (prop?.cemento ?? 0) + (prop?.cal ?? 0) + (prop?.arena ?? 0);
      if (!("arena_m3" in augmented) && total > 0) {
        const arenaFrac = (prop?.arena ?? 0) / total;
        augmented["arena_m3"] = Math.round(volMort * arenaFrac * 100) / 100;
      }
    }

    for (const [k, v] of Object.entries(augmented)) {
      const meta = LABELS[k];
      if (!meta) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const qty = Math.round(v * 100) / 100;
      arr.push({ label: meta.label, qty, unit: meta.unit });
    }
    return arr;
  }, [res, mortars, watch("morteroAsientoId")]);

  // Sólo materiales reales para guardar en Proyecto
  const MATERIAL_KEYS = new Set([
    "ladrillos_u",
    "unidades",
    "mortero_asiento_m3",
    "cemento_bolsas",
    "cal_kg",
    "arena_m3",
    "agua_l",
    "revoque_m3",
  ]);

  // Normaliza las unidades al tipo Unit de Project
  const toUnit = (u?: string): Unit =>
    u === "m²"
      ? "m2"
      : u === "m³"
      ? "m3"
      : u === "bolsas"
      ? "u"
      : (["u", "m", "m2", "m3", "kg", "l"] as const).includes((u ?? "") as Unit)
      ? ((u as unknown) as Unit)
      : "u";

  // Materiales para Proyecto (alineado con items)
  const itemsForProject = useMemo(() => {
    if (!res) return [] as { key?: string; label: string; qty: number; unit: string }[];

    const augmented: Record<string, unknown> = { ...(res as unknown as Record<string, unknown>) };
    const mortId = watch("morteroAsientoId");
    const volMort =
      getNumField(augmented, "mortero_asiento_m3") ??
      getNumField(augmented, "mortero_m3");

    if (volMort && mortars?.length) {
      const mortar = mortars.find((m) => m.id === mortId);
      const prop = (mortar && "proporcion" in mortar ? mortar.proporcion : undefined) as
        | { cemento?: number; cal?: number; arena?: number }
        | undefined;
      const total = (prop?.cemento ?? 0) + (prop?.cal ?? 0) + (prop?.arena ?? 0);
      if (!("arena_m3" in augmented) && total > 0) {
        const arenaFrac = (prop?.arena ?? 0) / total;
        augmented["arena_m3"] = Math.round(volMort * arenaFrac * 100) / 100;
      }
    }

    const out: { key?: string; label: string; qty: number; unit: string }[] = [];
    for (const [k, v] of Object.entries(augmented)) {
      if (!MATERIAL_KEYS.has(k)) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const meta = LABELS[k];
      out.push({
        key: k,
        label: meta?.label ?? k,
        qty: Math.round(v * 100) / 100,
        unit: (meta?.unit ?? "u") as string,
      });
    }
    return out;
  }, [res, mortars, watch("morteroAsientoId")]);

  // Título por defecto de la partida
  const defaultTitle = useMemo(() => {
    const L = watch("L") ?? 0;
    const H = watch("H") ?? 0;
    const j = watch("juntaMm") ?? 10;
    const nVanos = vanos.filter((v) => ((v as unknown as { sv?: number }).sv ?? v.lv * v.hv) > 0).length;
    return `Muro ${L}×${H} m · junta ${j} mm${nVanos ? ` · vanos ${nVanos}` : ""}`;
  }, [watch("L"), watch("H"), watch("juntaMm"), vanos]);

  // Helpers para lote local (solo toma del resultado tal cual)
  function buildMaterialsFrom(result: WallResult) {
    const augmented: Record<string, unknown> = { ...(result as unknown as Record<string, unknown>) };
    const out: { key?: string; label: string; qty: number; unit: string }[] = [];
    for (const [k, v] of Object.entries(augmented)) {
      if (!MATERIAL_KEYS.has(k)) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const meta = LABELS[k];
      out.push({
        key: k,
        label: meta?.label ?? k,
        qty: Math.round(v * 100) / 100,
        unit: (meta?.unit ?? "u") as string,
      });
    }
    return out;
  }

  const addCurrentToBatch = () => {
    if (!coeffs || !mortars || !defaults) return;
    const fv = getValues();
    const input: WallFormInput = { ...fv, vanos };
    const r = computeMuros(input, coeffs, mortars, defaults);
    const materials = buildMaterialsFrom(r);

    const item: BatchItem = {
      kind: "muro",
      title: defaultTitle,
      materials,
      inputs: input as unknown as Record<string, unknown>,
      outputs: r as unknown as Record<string, unknown>,
    };

    setRes(r);

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
    const inp = it.inputs as FormValues & { vanos?: typeof vanos };
    setValue("tipoMuroId", inp.tipoMuroId);
    setValue("ladrilloId", inp.ladrilloId);
    setValue("juntaMm", inp.juntaMm);
    setValue("morteroAsientoId", String(inp.morteroAsientoId));
    setValue("L", inp.L);
    setValue("H", inp.H);
    setValue("SA", inp.SA ?? 0);
    setValue("desperdicioPct", inp.desperdicioPct ?? 7);
    setVanos(Array.isArray(inp.vanos) ? inp.vanos : []);
    setRes(it.outputs as WallResult);
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch((prev) => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  if (!opts) return <p>Cargando catálogos…</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Muros</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
        <div className="card p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Selecciones */}
            <div className="grid md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Tipo de muro</span>
                <select className="rounded border px-3 py-2" {...register("tipoMuroId")}>
                  {opts.tipo_muro.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Ladrillo / Bloque</span>
                <select className="rounded border px-3 py-2" {...register("ladrilloId")}>
                  <optgroup label="Comunes">
                    {opts.ladrillos_bloques
                      .filter((l) => l.familia === "comun")
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Huecos">
                    {opts.ladrillos_bloques
                      .filter((l) => l.familia === "hueco")
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Bloques cerámicos portantes">
                    {opts.ladrillos_bloques
                      .filter((l) => l.familia === "ceramico_portante")
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id === "bloque_cer_27x19x20"
                            ? "Bloque cerámico portante 27×19×20"
                            : l.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Bloques de cemento portantes">
                    {opts.ladrillos_bloques
                      .filter((l) => l.familia === "hormigon")
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Junta (mm)</span>
                <select
                  className="rounded border px-3 py-2"
                  {...register("juntaMm", { valueAsNumber: true })}
                >
                  {[10, 15, 20, 25, 30].map((j) => (
  <option key={j} value={j}>
    {j} mm
  </option>
))}

                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Mortero de asiento</span>
                <select
                  className="rounded border px-3 py-2"
                  {...register("morteroAsientoId")}
                >
                  {(opts.morteros_asiento_ids || []).map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>

              <NumberWithUnit
                label="Longitud (L)"
                name="L"
                unit="m"
                value={watch("L") ?? 0}
                onChange={(v) => setValue("L", v)}
              />
              <NumberWithUnit
                label="Altura (H)"
                name="H"
                unit="m"
                value={watch("H") ?? 0}
                onChange={(v) => setValue("H", v)}
              />
              <NumberWithUnit
                label={
                  <>
                    Superficie adicional (SA)
                    <HelpPopover>
                      Usa este campo para sumar áreas irregulares (ej: un triángulo bajo una escalera) que no se pueden calcular con 'Largo × Alto'.
                    </HelpPopover>
                  </>
                }
                name="SA"
                unit="m²"
                value={watch("SA") ?? 0}
                onChange={(v) => setValue("SA", v)}
              />
            </div>

            {/* Vanos */}
            <div className="space-y-2">
              <div className="font-medium">
                Vanos a descontar
                <HelpPopover>
                  Aquí puedes restar el área de puertas y ventanas. Ingresa Largo (LV) y Alto (HV) para que la app lo calcule, o si ya tienes el área, ingrésala directamente en Superficie (SV).
                </HelpPopover>
              </div>
              <p className="text-xs text-foreground/60">
                LV/HV en <b>m</b> · SV en <b>m²</b>
              </p>
              <div className="overflow-x-auto">
                <OpeningsGroup items={vanos} onChange={setVanos} />
              </div>
            </div>

            {/* Desperdicio */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">
                Desperdicio (%)
                <HelpPopover>
                  Este porcentaje agrega material extra para cubrir cortes, roturas y errores durante la construcción. Un valor típico es entre 5% y 10%.
                </HelpPopover>
              </label>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={watch("desperdicioPct") ?? 7}
                onChange={(e) => setValue("desperdicioPct", parseInt(e.target.value, 10))}
              />
              <span className="text-sm">{watch("desperdicioPct") ?? 7}%</span>
            </div>

            {/* Botonera */}
            <div className="flex items-center gap-3">
              {!editMode ? (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting || !coeffs || !mortars}
                    className="btn btn-primary"
                  >
                    Calcular
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addCurrentToBatch}
                    disabled={!coeffs || !mortars}
                    title={editIndex !== null ? "Guardar cambios del ítem" : "Añadir muro al lote"}
                  >
                    {editIndex !== null ? "Guardar ítem del lote" : "Añadir muro al lote"}
                  </button>

                  {editIndex !== null && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setEditIndex(null)}
                    >
                      Cancelar edición
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting || !coeffs || !mortars}
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!coeffs || !mortars || !defaults) return;
                      const fv = getValues();
                      const input: WallFormInput = { ...fv, vanos };
                      const r = computeMuros(input, coeffs, mortars, defaults);
                      setRes(r);

                      // materiales para update (alineados con itemsForProject)
                      const augmented: Record<string, unknown> = {
                        ...(r as unknown as Record<string, unknown>),
                      };
                      const volMort =
                        getNumField(augmented, "mortero_asiento_m3") ??
                        getNumField(augmented, "mortero_m3");
                      if (volMort && mortars?.length) {
                        const mortar = mortars.find((m) => m.id === fv.morteroAsientoId);
                        const prop = (mortar && "proporcion" in mortar ? mortar.proporcion : undefined) as
                          | { cemento?: number; cal?: number; arena?: number }
                          | undefined;
                        const total =
                          (prop?.cemento ?? 0) + (prop?.cal ?? 0) + (prop?.arena ?? 0);
                        if (!("arena_m3" in augmented) && total > 0) {
                          const arenaFrac = (prop?.arena ?? 0) / total;
                          augmented["arena_m3"] =
                            Math.round(volMort * arenaFrac * 100) / 100;
                        }
                      }

                      const materials = Object.entries(augmented)
                        .filter(
                          ([k, v]) =>
                            MATERIAL_KEYS.has(k) &&
                            typeof v === "number" &&
                            Number.isFinite(v as number)
                        )
                        .map(([k, v]) => {
                          const meta = LABELS[k];
                          return {
                            key: k,
                            label: meta?.label ?? k,
                            qty: Math.round((v as number) * 100) / 100,
                            unit: (meta?.unit ?? "u") as string,
                          };
                        });

                      // convierte string → Unit para cumplir MaterialLine
                      const materialsForUpdate: MaterialLine[] = materials.map((m) => ({
                        ...m,
                        unit: toUnit(m.unit),
                      }));

                      await updatePartida(projectId as string, partidaId as string, {
                        title: defaultTitle,
                        inputs: input,
                        outputs: r,
                        materials: materialsForUpdate,
                      });

                      router.push(`/proyecto/${projectId}`);
                    }}
                  >
                    Actualizar partida
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => router.push(`/proyecto/${projectId}`)}
                  >
                    Volver al proyecto
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Card: Resultado */}
        <div className="card p-4 card--table">
          <h2 className="text-lg font-semibold mb-2">Resultado</h2>
          {res ? (
            items.length ? (
              <>
                <ResultTable title="Resultado" items={items} />
                {/* leyenda de mortero */}
                {(() => {
                  const mortId = watch("morteroAsientoId");
                  const m = mortars?.find((mm) => mm.id === mortId);
                  const p = (m && "proporcion" in m ? m.proporcion : undefined) as
                    | { cemento?: number; cal?: number; arena?: number }
                    | undefined;
                  const agua =
                    (m && "agua_l_por_m3" in m ? (m as unknown as { agua_l_por_m3?: number }).agua_l_por_m3 : undefined) ??
                    undefined;
                  return p ? (
                    <p className="text-xs text-foreground/60 mt-2">
                      Proporción mortero (cemento:cal:arena):{" "}
                      <b>{p.cemento ?? 0} : {p.cal ?? 0} : {p.arena ?? 0}</b>
                      {typeof agua === "number" ? (
                        <>
                          {" "}
                          · Agua de referencia: <b>{agua} L/m³</b>
                        </>
                      ) : null}
                    </p>
                  ) : null;
                })()}
              </>
            ) : (
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(res, null, 2)}
              </pre>
            )
          ) : (
            <p className="text-sm text-foreground/60">
              Ingresá datos y presioná “Calcular” para ver el resultado.
            </p>
          )}
        </div>
      </div>

      {/* Lote local */}
      {!editMode && batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="text-lg font-semibold">Lote local (Muros)</h2>
          <BatchList
            items={batch.map((b) => ({
              title: b.title,
              subtitle: undefined,
              materials: undefined,
            }))}
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

      {/* --- ESTE ES EL BLOQUE CORREGIDO --- */}
      {/* Guardar en Proyecto (unitario) */}
      {!editMode && res && (
        <div className="card p-4 space-y-3">
            <h3 className="font-semibold flex items-center">
                Guardar en proyecto
                <HelpPopover>
                  Cada cálculo que realizas se guarda como una 'partida' dentro de tu proyecto. Usa esta sección para añadir el resultado actual a un proyecto existente o para crear uno nuevo.
                </HelpPopover>
            </h3>
            <AddToProject
              kind="muro"
              defaultTitle={defaultTitle}
              items={itemsForProject}
              raw={res}
            />
        </div>
      )}
    </section>
  );
}

// Este es el componente de página que se exporta por defecto.
// Envuelve el calculador en <Suspense> para evitar el error de build.
export default function PageMuros() {
  return (
    <Suspense fallback={<div>Cargando calculadora de muros...</div>}>
      <MurosCalculator />
    </Suspense>
  );
}
